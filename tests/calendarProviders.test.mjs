import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const cache = new Map()
function moduleUrl(path) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path)
  let source = readFileSync(path, 'utf8').replace(/^import ['"]server-only['"];?\s*$/gm, '')
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022 } })
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => {
    if (specifier.startsWith('.')) return `from '${moduleUrl(resolve(dirname(path), `${specifier}.ts`))}'`
    if (specifier.startsWith('node:')) return match
    return `from '${import.meta.resolve(specifier)}'`
  })
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  cache.set(path, url)
  return url
}
const google = await import(moduleUrl('lib/calendar/providers/google.ts'))
const icloud = await import(moduleUrl('lib/calendar/providers/icloud.ts'))
const ical = await import(moduleUrl('lib/calendar/providers/ical.ts'))
const { ProviderError } = await import(moduleUrl('lib/calendar/providers/types.ts'))
const creds = { accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: 123 }
const apple = { username: 'person@icloud.com', appSpecificPassword: 'abcd-efgh-ijkl-mnop' }
const calendar = { id: 'test@gmail.com', name: 'Work', timeZone: 'America/Chicago', writable: true }
const cloud = { id: 'https://p12-caldav.icloud.com/123/calendars/work/', name: 'Work', timeZone: 'America/Chicago', writable: true }
const draft = { title: 'Personal time', start: '2026-10-12T14:00:00Z', end: '2026-10-12T14:45:00Z', timeZone: 'America/Chicago', allDay: false }
const config = { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://example.com/api/calendar/google/callback' }
const window = { start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' }
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
const xml = (body, status = 207) => new Response(body, { status, headers: { 'Content-Type': 'application/xml' } })
const sequence = (...responses) => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, init })
    const next = responses.shift()
    assert.ok(next, `Unexpected request ${url}`)
    return typeof next === 'function' ? next(url, init) : next
  }
  return { fetcher, calls }
}
const dav = (href, prop) => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${prop}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`
const multistatus = value => `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${value}</d:multistatus>`

test('Google OAuth requests only discovery/events/email, offline access, CSRF state and S256 PKCE', () => {
  const url = new URL(google.googleAuthorizationUrl(config, 'state-value', 'verifier'))
  assert.equal(url.origin, 'https://accounts.google.com')
  assert.equal(url.searchParams.get('state'), 'state-value')
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('scope'), google.GOOGLE_CALENDAR_SCOPES.join(' '))
  assert.ok(!url.toString().includes('secret'))
})

test('Google code exchange enforces required scopes and requires offline credentials', async () => {
  const granted = sequence(json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 1000, scope: google.GOOGLE_CALENDAR_SCOPES.join(' ') }))
  const result = await google.exchangeGoogleCode(config, 'code', 'verifier', granted.fetcher)
  assert.equal(result.refreshToken, 'new-refresh')
  assert.ok(result.expiresAt > Date.now())
  assert.equal(granted.calls[0].init.body.get('code_verifier'), 'verifier')
  const denied = sequence(json({ access_token: 'x', refresh_token: 'y', scope: google.GOOGLE_CALENDAR_SCOPES[0] }))
  await assert.rejects(google.exchangeGoogleCode(config, 'code', 'v', denied.fetcher), error => error.code === 'permission_denied')
})

test('Google refresh preserves refresh token and sanitized revoked-access errors', async () => {
  const mock = sequence(json({ access_token: 'next', expires_in: 3600 }))
  const result = await google.refreshGoogleCredentials(config, creds, mock.fetcher)
  assert.equal(result.refreshToken, 'test-refresh')
  const expired = sequence(json({ error: 'invalid_grant', error_description: 'private provider payload' }, 400))
  await assert.rejects(google.refreshGoogleCredentials(config, creds, expired.fetcher), error => error.code === 'reconnect_required' && !error.message.includes('private'))
})

test('Google discovery respects read-only calendars and pagination', async () => {
  const mock = sequence(json({ items: [{ id: 'read', summary: 'Read', accessRole: 'reader' }], nextPageToken: 'next' }),
    json({ items: [{ id: 'write', accessRole: 'owner', primary: true }, { id: 'busy', accessRole: 'freeBusyReader' }] }))
  const result = await google.discoverGoogleCalendars(creds, mock.fetcher)
  assert.equal(result.length, 2)
  assert.equal(result[0].writable, false)
  assert.equal(result[1].writable, true)
  assert.ok(mock.calls[1].url.includes('pageToken=next'))
})

test('Google incremental sync has no incompatible filters and retains cancelled recurrence exceptions', async () => {
  const mock = sequence(json({ items: [
    { id: 'deleted', status: 'cancelled' },
    { id: 'exception', status: 'cancelled', recurringEventId: 'master', originalStartTime: { dateTime: '2026-10-12T14:00:00Z' } },
    { id: 'master', start: { dateTime: draft.start, timeZone: draft.timeZone }, end: { dateTime: draft.end }, recurrence: ['RRULE:FREQ=WEEKLY'] },
  ], nextSyncToken: 'next-token' }))
  const result = await google.syncGoogleCalendar(creds, calendar, window, 'previous', mock.fetcher)
  const query = new URL(mock.calls[0].url).searchParams
  assert.equal(query.get('syncToken'), 'previous')
  assert.equal(query.get('singleEvents'), 'false')
  assert.equal(query.has('timeMin'), false)
  assert.equal(result.reset, false)
  assert.deepEqual(result.deletedIds, ['deleted'])
  assert.equal(result.events[0].recurringEventId, 'master')
  assert.equal(result.nextSyncToken, 'next-token')
})

test('Google invalid sync token performs a replacement full sync', async () => {
  const mock = sequence(json({ error: {} }, 410), json({ items: [], nextSyncToken: 'fresh' }))
  const result = await google.syncGoogleCalendar(creds, calendar, window, 'expired', mock.fetcher)
  assert.equal(result.reset, true)
  assert.equal(result.nextSyncToken, 'fresh')
  assert.equal(new URL(mock.calls[1].url).searchParams.has('syncToken'), false)
})

test('Google writes use a deterministic ID and recover accepted-create retries', async () => {
  const id = google.deterministicGoogleEventId('operation-1')
  assert.match(id, /^[0-9a-v]{5,1024}$/)
  const mock = sequence(json({}, 409), json({ id, start: { dateTime: draft.start }, end: { dateTime: draft.end },
    extendedProperties: { private: { anastasisOperation: 'operation-1' } } }))
  const event = await google.createGoogleEvent(creds, calendar, draft, 'operation-1', mock.fetcher)
  assert.equal(event.id, id)
  assert.equal(JSON.parse(mock.calls[0].init.body).id, id)
  assert.equal(mock.calls.length, 2)
})

test('Google explicit edit uses If-Match, preserves unrelated fields, and surfaces conflicts', async () => {
  const mock = sequence(json({ error: {} }, 412))
  await assert.rejects(google.updateGoogleEvent(creds, calendar, 'event', draft, '"v1"', mock.fetcher), error => error.code === 'conflict')
  assert.equal(mock.calls[0].init.headers.get('If-Match'), '"v1"')
  assert.equal(mock.calls[0].init.method, 'PATCH')
  assert.equal('attendees' in JSON.parse(mock.calls[0].init.body), false)
  await assert.rejects(google.createGoogleEvent(creds, { ...calendar, writable: false }, draft, 'k', mock.fetcher), error => error.code === 'read_only')
})

test('Google edits preserve explicitly selected calendar-default reminders', async () => {
  const mock = sequence(json({ id: 'event', start: { dateTime: draft.start }, end: { dateTime: draft.end }, reminders: { useDefault: true } }))
  const event = await google.updateGoogleEvent(creds, calendar, 'event', { ...draft, reminders: [], useDefaultReminders: true }, 'etag', mock.fetcher)
  assert.deepEqual(JSON.parse(mock.calls[0].init.body).reminders, { useDefault: true })
  assert.equal(event.metadata.remindersUseDefault, true)
})

test('Google keyed edit retries reconcile accepted writes without overwriting later external edits', async () => {
  const operationKey = 'user:edit-operation'
  const original = { id: 'event', etag: '"v1"', summary: 'Original', start: { dateTime: draft.start }, end: { dateTime: draft.end },
    extendedProperties: { private: { existingPrivate: 'keep', anastasisOperation: 'create-operation' }, shared: { sharedKey: 'keep' } } }
  const updated = { ...original, etag: '"v2"', summary: 'Edited', extendedProperties: {
    ...original.extendedProperties, private: { ...original.extendedProperties.private, anastasisUpdateOperation: operationKey } } }
  const laterManualEdit = { ...updated, etag: '"v3"', summary: 'Later external change' }
  const mock = sequence(json(original), json(updated), json(laterManualEdit))
  const initial = await google.updateGoogleEvent(creds, calendar, 'event', { ...draft, title: 'Edited' }, '"v1"', mock.fetcher, operationKey)
  assert.equal(initial.title, 'Edited')
  const patch = JSON.parse(mock.calls[1].init.body)
  assert.equal(patch.extendedProperties.private.existingPrivate, 'keep')
  assert.equal(patch.extendedProperties.private.anastasisOperation, 'create-operation')
  assert.equal(patch.extendedProperties.private.anastasisUpdateOperation, operationKey)
  assert.deepEqual(patch.extendedProperties.shared, { sharedKey: 'keep' })
  const retry = await google.updateGoogleEvent(creds, calendar, 'event', { ...draft, title: 'Edited' }, '"v1"', mock.fetcher, operationKey)
  assert.equal(retry.title, 'Later external change')
  assert.equal(retry.etag, '"v3"')
  assert.equal(retry.metadata.anastasisUpdateOperation, operationKey)
  assert.deepEqual(mock.calls.map(call => call.init.method || 'GET'), ['GET', 'PATCH', 'GET'])
})

test('Google keyed edit detects a mismatched external version before attempting a mutation', async () => {
  const mock = sequence(json({ id: 'event', etag: '"newer"', start: { dateTime: draft.start }, end: { dateTime: draft.end },
    extendedProperties: { private: { anastasisUpdateOperation: 'different-operation' } } }))
  await assert.rejects(google.updateGoogleEvent(creds, calendar, 'event', draft, '"old"', mock.fetcher, 'this-operation'), error => error.code === 'conflict')
  assert.equal(mock.calls.length, 1)
  assert.equal(mock.calls[0].init.method || 'GET', 'GET')
})

test('Google handles rate limits and retry-safe deletion without leaking response details', async () => {
  const limited = sequence(json({ error: { errors: [{ reason: 'rateLimitExceeded', message: 'sensitive' }] } }, 403, { 'Retry-After': '90' }))
  await assert.rejects(google.discoverGoogleCalendars(creds, limited.fetcher), error => error.code === 'rate_limited' && error.retryAfterSeconds === 90 && !error.message.includes('sensitive'))
  const gone = sequence(new Response(null, { status: 410 }))
  await google.deleteGoogleEvent(creds, calendar, 'deleted', 'etag', gone.fetcher)
})

test('iCloud URLs reject non-Apple, lookalike, HTTP, userinfo and port destinations', () => {
  assert.equal(icloud.safeICloudUrl('/123/', cloud.id), 'https://p12-caldav.icloud.com/123/')
  for (const url of ['http://caldav.icloud.com/', 'https://caldav.icloud.com.evil.test/', 'https://localhost/', 'https://user@caldav.icloud.com/', 'https://caldav.icloud.com:8443/']) {
    assert.throws(() => icloud.safeICloudUrl(url), error => error.code === 'invalid_response')
  }
  assert.throws(() => icloud.validateICloudCredentials({ ...apple, appSpecificPassword: 'primary-password' }), /app-specific/)
})

test('iCloud discovery reads principal/home-set and privileges using namespace-aware DAV', async () => {
  const mock = sequence(
    xml(multistatus(dav('/', '<d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>'))),
    xml(multistatus(dav('/123/principal/', '<c:calendar-home-set><d:href>https://p12-caldav.icloud.com/123/calendars/</d:href></c:calendar-home-set>'))),
    xml(multistatus(dav('/123/calendars/work/', '<d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>Work</d:displayname><d:sync-token>token-1</d:sync-token><d:current-user-privilege-set><d:privilege><d:write/></d:privilege></d:current-user-privilege-set>') +
      dav('/123/calendars/read/', '<d:resourcetype><c:calendar/></d:resourcetype><d:displayname>Read</d:displayname><d:current-user-privilege-set><d:privilege><d:read/></d:privilege></d:current-user-privilege-set>'))),
  )
  const found = await icloud.discoverICloudCalendars(apple, mock.fetcher)
  assert.equal(found.length, 2)
  assert.equal(found[0].writable, true)
  assert.equal(found[1].writable, false)
  assert.equal(found[0].syncToken, 'token-1')
  assert.equal(mock.calls[0].init.redirect, 'manual')
})

test('iCloud refuses malicious redirects before forwarding credentials', async () => {
  const mock = sequence(new Response(null, { status: 302, headers: { Location: 'https://evil.test/steal' } }))
  await assert.rejects(icloud.discoverICloudCalendars(apple, mock.fetcher), error => error.code === 'invalid_response')
  assert.equal(mock.calls.length, 1)
})

test('iCloud full sync captures pre-read token and parses recurring resources', async () => {
  const ics = ical.buildICalendar({ ...draft, recurrence: ['RRULE:FREQ=WEEKLY;COUNT=2'] }, 'uid')
  const escaped = ics.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const mock = sequence(xml(multistatus(dav(cloud.id, '<d:sync-token>baseline</d:sync-token>'))),
    xml(multistatus(dav('/123/calendars/work/e.ics', `<d:getetag>"v1"</d:getetag><c:calendar-data>${escaped}</c:calendar-data>`))))
  const result = await icloud.syncICloudCalendar(apple, cloud, window, undefined, mock.fetcher)
  assert.equal(result.reset, true)
  assert.equal(result.nextSyncToken, 'baseline')
  assert.equal(result.events[0].etag, '"v1"')
  assert.equal(result.events[0].recurrence[0], 'RRULE:FREQ=WEEKLY;COUNT=2')
  assert.deepEqual(result.deletedIds, ['https://p12-caldav.icloud.com/123/calendars/work/e.ics'])
})

test('iCloud incremental cancellation deletes the complete resource and stores next token', async () => {
  const mock = sequence(xml(multistatus('<d:response><d:href>/123/calendars/work/e.ics</d:href><d:status>HTTP/1.1 404 Not Found</d:status></d:response><d:sync-token>next</d:sync-token>')))
  const result = await icloud.syncICloudCalendar(apple, cloud, window, 'old', mock.fetcher)
  assert.equal(result.events.length, 0)
  assert.equal(result.reset, false)
  assert.equal(result.nextSyncToken, 'next')
  assert.ok(mock.calls[0].init.body.includes('<d:sync-token>old</d:sync-token>'))
})

test('iCloud create retries use conditional deterministic resource and validate operation ownership', async () => {
  const resource = icloud.deterministicICloudResource(cloud, 'operation-2')
  const ics = ical.buildICalendar(draft, resource.uid, { operationKey: 'operation-2' })
  const mock = sequence(new Response(null, { status: 412 }), new Response(ics, { headers: { ETag: '"saved"' } }))
  const event = await icloud.createICloudEvent(apple, cloud, draft, 'operation-2', mock.fetcher)
  assert.equal(event.id, resource.href)
  assert.equal(event.etag, '"saved"')
  assert.equal(mock.calls[0].init.headers.get('If-None-Match'), '*')
  await assert.rejects(icloud.deleteICloudEvent(apple, cloud, 'https://p12-caldav.icloud.com/123/calendars/other/e.ics', 'etag', mock.fetcher), error => error.code === 'invalid_input')
})

test('iCloud creation confirms external read-back only after a successful conditional PUT', async () => {
  const resource = icloud.deterministicICloudResource(cloud, 'fresh-operation')
  const saved = ical.buildICalendar(draft, resource.uid, { operationKey: 'fresh-operation' })
  const mock = sequence(new Response(null, { status: 201 }), new Response(saved, { headers: { ETag: '"new"' } }))
  const event = await icloud.createICloudEvent(apple, cloud, draft, 'fresh-operation', mock.fetcher)
  assert.equal(mock.calls[0].init.method, 'PUT')
  assert.equal(mock.calls[1].init.method, 'GET')
  assert.equal(event.etag, '"new"')
  const denied = sequence(new Response(null, { status: 403 }))
  await assert.rejects(icloud.createICloudEvent(apple, cloud, draft, 'denied', denied.fetcher), error => error.code === 'permission_denied')
  assert.equal(denied.calls.length, 1)
})

test('iCloud update detects external edits and preserves external attendees on confirmed writes', async () => {
  const href = `${cloud.id}edit.ics`
  const original = ical.buildICalendar(draft, 'uid').replace('END:VEVENT', 'ATTENDEE:mailto:friend@example.com\r\nEND:VEVENT')
  const conflict = sequence(new Response(original, { headers: { ETag: '"newer"' } }))
  await assert.rejects(icloud.updateICloudEvent(apple, cloud, href, { ...draft, title: 'Changed' }, '"old"', conflict.fetcher), error => error.code === 'conflict')
  assert.equal(conflict.calls.length, 1)
  const updated = ical.buildICalendar({ ...draft, title: 'Changed' }, 'uid', { existingIcs: original })
  const mock = sequence(new Response(original, { headers: { ETag: '"old"' } }), new Response(null, { status: 204 }),
    new Response(updated, { headers: { ETag: '"updated"' } }))
  const event = await icloud.updateICloudEvent(apple, cloud, href, { ...draft, title: 'Changed' }, '"old"', mock.fetcher)
  assert.equal(mock.calls[1].init.method, 'PUT')
  assert.equal(mock.calls[1].init.headers.get('If-Match'), '"old"')
  assert.match(mock.calls[1].init.body, /ATTENDEE:mailto:friend@example.com/)
  assert.equal(event.title, 'Changed')
  assert.equal(event.etag, '"updated"')
})

test('iCloud keyed edit retries reconcile accepted writes and preserve later external changes', async () => {
  const operationKey = 'user:icloud-edit-operation', href = `${cloud.id}edit-retry.ics`
  const original = ical.buildICalendar(draft, 'uid', { operationKey: 'create-key' }).replace('END:VEVENT', 'ATTENDEE:mailto:friend@example.com\r\nEND:VEVENT')
  const updated = ical.buildICalendar({ ...draft, title: 'Edited' }, 'uid', { existingIcs: original, updateOperationKey: operationKey })
  const laterManualEdit = updated.replace('SUMMARY:Edited', 'SUMMARY:Later external change')
  const mock = sequence(new Response(original, { headers: { ETag: '"v1"' } }), new Response(null, { status: 204 }),
    new Response(updated, { headers: { ETag: '"v2"' } }), new Response(laterManualEdit, { headers: { ETag: '"v3"' } }))
  const initial = await icloud.updateICloudEvent(apple, cloud, href, { ...draft, title: 'Edited' }, '"v1"', mock.fetcher, operationKey)
  assert.equal(initial.title, 'Edited')
  assert.match(mock.calls[1].init.body, /X-ANASTASIS-UPDATE-OPERATION:user:icloud-edit-operation/)
  assert.match(mock.calls[1].init.body, /X-ANASTASIS-OPERATION:create-key/)
  assert.match(mock.calls[1].init.body, /ATTENDEE:mailto:friend@example.com/)
  const retry = await icloud.updateICloudEvent(apple, cloud, href, { ...draft, title: 'Edited' }, '"v1"', mock.fetcher, operationKey)
  assert.equal(retry.title, 'Later external change')
  assert.equal(retry.etag, '"v3"')
  assert.equal(retry.metadata.anastasisUpdateOperation, operationKey)
  assert.deepEqual(mock.calls.map(call => call.init.method), ['GET', 'PUT', 'GET', 'GET'])
})

test('iCloud keyed edit detects an unrelated newer operation without attempting a write', async () => {
  const existing = ical.buildICalendar(draft, 'uid', { updateOperationKey: 'different-operation' })
  const mock = sequence(new Response(existing, { headers: { ETag: '"newer"' } }))
  await assert.rejects(icloud.updateICloudEvent(apple, cloud, `${cloud.id}event.ics`, draft, '"old"', mock.fetcher, 'this-operation'), error => error.code === 'conflict')
  assert.equal(mock.calls.length, 1)
  assert.equal(mock.calls[0].init.method, 'GET')
})

test('iCloud deletion requires a version and safely retries an already-deleted external event', async () => {
  const mock = sequence(new Response(null, { status: 404 }))
  await icloud.deleteICloudEvent(apple, cloud, `${cloud.id}deleted.ics`, '"version"', mock.fetcher)
  assert.equal(mock.calls[0].init.method, 'DELETE')
  assert.equal(mock.calls[0].init.headers.get('If-Match'), '"version"')
  const revoked = sequence(new Response(null, { status: 401 }))
  await assert.rejects(icloud.deleteICloudEvent(apple, cloud, `${cloud.id}event.ics`, '"v"', revoked.fetcher), error => error.code === 'reconnect_required')
})

test('iCloud expired DAV token discards old snapshot and returns a fresh baseline', async () => {
  const mock = sequence(xml('<d:error xmlns:d="DAV:"><d:valid-sync-token/></d:error>', 403),
    xml(multistatus(dav(cloud.id, '<d:sync-token>fresh-baseline</d:sync-token>'))), xml(multistatus('')))
  const result = await icloud.syncICloudCalendar(apple, cloud, window, 'expired', mock.fetcher)
  assert.equal(result.reset, true)
  assert.equal(result.nextSyncToken, 'fresh-baseline')
  assert.equal(mock.calls[2].init.body.includes('calendar-query'), true)
})

test('recurrence keeps local morning hour across DST and supports cancelled/moved exceptions', () => {
  const master = { ...draft, id: 'master', calendarId: calendar.id, status: 'confirmed', busy: true,
    start: '2026-10-25T14:00:00Z', end: '2026-10-25T14:45:00Z', recurrence: ['RRULE:FREQ=WEEKLY;COUNT=3'] }
  const view = { start: '2026-10-20T00:00:00Z', end: '2026-11-15T00:00:00Z' }
  const expanded = ical.expandProviderEvents([master], view)
  assert.deepEqual(expanded.map(event => event.start), ['2026-10-25T14:00:00.000Z', '2026-11-01T15:00:00.000Z', '2026-11-08T15:00:00.000Z'])
  const cancelled = { ...master, id: 'cancel', recurrence: undefined, recurringEventId: 'master', originalStart: '2026-11-01T15:00:00Z', status: 'cancelled' }
  const moved = { ...master, id: 'moved', recurrence: undefined, recurringEventId: 'master', originalStart: '2026-11-08T15:00:00Z', start: '2026-11-09T17:00:00Z', end: '2026-11-09T17:45:00Z' }
  const withExceptions = ical.expandProviderEvents([master, cancelled, moved], view)
  assert.equal(withExceptions.length, 2)
  assert.equal(withExceptions[1].id, 'moved')
  assert.equal(withExceptions[0].metadata.editScope, 'series')
})

test('all-day dates remain exclusive local dates, with EXDATE and RDATE expansion', () => {
  const allDay = { ...draft, id: 'all-day', calendarId: calendar.id, status: 'confirmed', busy: true, allDay: true,
    start: '2026-10-12', end: '2026-10-13', recurrence: ['RRULE:FREQ=DAILY;COUNT=3', 'EXDATE;VALUE=DATE:20261013', 'RDATE;VALUE=DATE:20261016'] }
  const ics = ical.buildICalendar(allDay, 'all-day-uid')
  assert.match(ics, /DTSTART;VALUE=DATE:20261012/)
  const parsed = ical.parseICalendar(ics, calendar, 'resource')
  assert.equal(parsed[0].start, '2026-10-12')
  assert.equal(parsed[0].end, '2026-10-13')
  const expanded = ical.expandProviderEvents(parsed, window)
  assert.deepEqual(expanded.map(event => event.start), ['2026-10-12', '2026-10-14', '2026-10-16'])
  assert.deepEqual(expanded.map(event => event.end), ['2026-10-13', '2026-10-15', '2026-10-17'])
})

test('iCalendar edits preserve attendees and detached exceptions, escape notes and use display reminders', () => {
  const initial = ical.buildICalendar({ ...draft, recurrence: ['RRULE:FREQ=WEEKLY;COUNT=2'] }, 'uid')
  const existing = initial.replace('END:VEVENT', 'ATTENDEE:mailto:friend@example.com\r\nEND:VEVENT')
    .replace('END:VCALENDAR', 'BEGIN:VEVENT\r\nUID:uid\r\nRECURRENCE-ID:20261019T140000Z\r\nDTSTART:20261019T170000Z\r\nDTEND:20261019T174500Z\r\nSUMMARY:Moved\r\nEND:VEVENT\r\nEND:VCALENDAR')
  const edited = ical.buildICalendar({ ...draft, description: 'a,b; c\nnext', reminders: [{ method: 'popup', minutes: 15 }] }, 'uid', { existingIcs: existing })
  assert.match(edited, /ATTENDEE:mailto:friend@example.com/)
  assert.match(edited, /SUMMARY:Moved/)
  assert.match(edited, /TRIGGER:-PT15M/)
  assert.equal(ical.parseICalendar(edited, cloud, `${cloud.id}e.ics`).length, 2)
  assert.throws(() => ical.buildICalendar({ ...draft, recurrence: ['RRULE:FREQ=DAILY\r\nSUMMARY:injected'] }, 'uid'), error => error instanceof ProviderError && error.code === 'invalid_input')
})

test('iCalendar writes include VTIMEZONE and interpret custom embedded zones safely', () => {
  const generated = ical.buildICalendar(draft, 'uid')
  assert.match(generated, /BEGIN:VTIMEZONE/)
  assert.match(generated, /TZID:America\/Chicago/)
  const custom = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTIMEZONE\r\nTZID:CustomZone\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0500\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT\r\nUID:custom\r\nDTSTART;TZID=CustomZone:20261012T090000\r\nDTEND;TZID=CustomZone:20261012T100000\r\nSUMMARY:Custom\r\nEND:VEVENT\r\nEND:VCALENDAR'
  const parsed = ical.parseICalendar(custom, cloud, `${cloud.id}custom.ics`)
  assert.equal(parsed[0].start, '2026-10-12T14:00:00.000Z')
  assert.equal(parsed[0].timeZone, 'America/Chicago')
})

test('personal-event recurrence validation rejects malformed and unsafe repeat rules before storage', () => {
  for (const rule of ['RRULE:FREQ=INVALID', 'RRULE:COUNT=2', 'RRULE:FREQ=DAILY;COUNT=0', 'RRULE:FREQ=DAILY;INTERVAL=-1',
    'RRULE:FREQ=DAILY;COUNT=2;UNTIL=20261030T120000Z', 'RRULE:FREQ=SECONDLY', 'RRULE:FREQ=DAILY;FREQ=WEEKLY',
    'RRULE:FREQ=DAILY;BYMONTH=13', 'RRULE:FREQ=DAILY;BYDAY=BOGUS', 'RRULE:FREQ=DAILY;INJECT=1']) {
    assert.throws(() => ical.buildICalendar({ ...draft, recurrence: [rule] }, 'uid'), error => error.code === 'invalid_input', rule)
  }
  assert.throws(() => ical.validateRecurrenceRules(['RRULE:FREQ=DAILY;BYHOUR=8'], true), error => error.code === 'invalid_input')
  assert.doesNotThrow(() => ical.validateRecurrenceRules(['RRULE:FREQ=WEEKLY;COUNT=12;BYDAY=MO,WE,FR']))
})

test('existing provider minute recurrence still expands independently of stricter authoring rules', () => {
  const master = { ...draft, id: 'fast', calendarId: calendar.id, status: 'confirmed', busy: true,
    start: '2026-10-12T14:00:00Z', end: '2026-10-12T14:00:30Z', recurrence: ['RRULE:FREQ=MINUTELY;COUNT=2'] }
  const expanded = ical.expandProviderEvents([master], window)
  assert.equal(expanded.length, 2)
  assert.equal(expanded[1].start, '2026-10-12T14:01:00.000Z')
})
