import assert from 'node:assert/strict'
import { createHash, randomUUID, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))

function load(path, mocks, env) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'server-only' ? {} : mocks[name] ?? require(name), process: { env }, Buffer, Intl, Date, URL, URLSearchParams, Request, Response, Set, Map, AbortSignal }, { filename: path })
  return module.exports
}

/** Small fluent query fake; authentication/ownership filters and mutations execute the production handlers. */
class Query {
  constructor(db, table) { this.db = db; this.table = table; this.filters = []; this.operation = 'select'; this.columns = '*'; this.returning = false }
  select(columns = '*') { this.columns = columns; if (this.operation !== 'select') this.returning = true; return this }
  eq(key, value) { this.filters.push(row => row[key] === value); return this }
  neq(key, value) { this.filters.push(row => row[key] !== value); return this }
  is(key, value) { return this.eq(key, value) }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this }
  gt(key, value) { this.filters.push(row => row[key] > value); return this }
  lt(key, value) { this.filters.push(row => row[key] < value); return this }
  lte(key, value) { this.filters.push(row => row[key] <= value); return this }
  or(expression) {
    const clauses = [...expression.matchAll(/and\((\w+)\.lt\.([^,]+),(\w+)\.gt\.([^)]+)\)/g)]
    assert.ok(clauses.length, `Unsupported test query: ${expression}`)
    this.filters.push(row => clauses.some(([, startKey, end, endKey, start]) => row[startKey] < end && row[endKey] > start))
    return this
  }
  order(key) { this.orderBy = key; return this }
  range(start, end) { this.bounds = [start, end + 1]; return this }
  limit(count) { this.bounds = [0, count]; return this }
  insert(values) { this.operation = 'insert'; this.values = values; return this }
  upsert(values, options = {}) { this.operation = 'upsert'; this.values = values; this.conflict = options.onConflict; return this }
  update(values) { this.operation = 'update'; this.values = values; return this }
  delete() { this.operation = 'delete'; return this }
  project(row) { return this.columns === '*' ? copy(row) : Object.fromEntries(this.columns.split(',').map(key => [key.trim(), copy(row[key.trim()])])) }
  execute() {
    if (this.operation !== 'select') this.db.mutations[this.table] = (this.db.mutations[this.table] || 0) + 1
    if (this.db.failWhen?.(this)) { this.db.failWhen = null; return { data: null, error: { code: 'XX000' } } }
    if (this.db.failNext === `${this.table}:${this.operation}`) { this.db.failNext = null; return { data: null, error: { code: 'XX000' } } }
    const rows = this.db.tables[this.table] ||= []
    const matches = row => this.filters.every(filter => filter(row))
    let output
    if (this.operation === 'insert' || this.operation === 'upsert') {
      output = []
      for (const input of Array.isArray(this.values) ? this.values : [this.values]) {
        const key = this.conflict || (this.table === 'calendar_credentials' ? 'connection_id' : this.table === 'calendar_preferences' ? 'user_id' : 'id')
        const existing = rows.find(row => key.split(',').every(column => input[column] !== undefined && row[column] === input[column]))
        const duplicateOperation = this.table === 'calendar_write_operations' && rows.find(row => row.user_id === input.user_id && row.idempotency_key === input.idempotency_key)
        if (this.operation === 'insert' && (existing || duplicateOperation)) return { data: null, error: { code: '23505' } }
        if (existing) Object.assign(existing, copy(input))
        else rows.push({ id: randomUUID(), created_at: '2026-10-11T12:00:00Z', updated_at: '2026-10-11T12:00:00Z', ...(this.table === 'calendar_events' ? { event_type: 'personal' } : {}), ...copy(input) })
        output.push(existing || rows.at(-1))
      }
    } else if (this.operation === 'update') { output = rows.filter(matches); output.forEach(row => Object.assign(row, copy(this.values))) }
    else if (this.operation === 'delete') { output = rows.filter(matches); this.db.tables[this.table] = rows.filter(row => !matches(row)) }
    else output = rows.filter(matches)
    if (this.orderBy) output.sort((a, b) => String(a[this.orderBy]).localeCompare(String(b[this.orderBy])))
    if (this.bounds) output = output.slice(...this.bounds)
    return { data: this.operation === 'select' || this.returning ? output.map(row => this.project(row)) : null, error: null }
  }
  single() { const result = this.execute(); return Promise.resolve({ ...result, data: result.data?.[0] || null }) }
  maybeSingle() { return this.single() }
  then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject) }
}

function fixture() {
  const state = { user: { id: 'user-a', email: 'anastasis@example.test' }, calls: { create: 0, update: 0, updateWrites: 0, delete: 0, sync: 0, refresh: 0, revoke: 0, icloudDiscover: 0 }, cookies: new Map(), syncError: null, createError: null, fullReset: false }
  const db = {
    tables: { clients: [{ auth_user_id: 'user-a', client_id: 'client-a', program: 'ember', access: true, active: true }, { auth_user_id: 'user-b', client_id: 'client-b', program: 'ignite', access: true, active: true }] }, failNext: null, failWhen: null, mutations: {},
    from(table) { return new Query(this, table) }, auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    async rpc(name, args) {
      const connection = this.tables.calendar_connections?.find(row => row.id === args.p_id && row.user_id === args.p_user)
      if (name === 'claim_calendar_sync') {
        if (!connection || connection.lease_id) return { data: false, error: null }
        connection.lease_id = args.p_lease; return { data: true, error: null }
      }
      if (name === 'disconnect_calendar') {
        if (!connection) return { data: false, error: null }
        const calendarIds = (this.tables.connected_calendars || []).filter(row => row.connection_id === connection.id).map(row => row.id)
        this.tables.calendar_connections = this.tables.calendar_connections.filter(row => row !== connection)
        this.tables.calendar_credentials = (this.tables.calendar_credentials || []).filter(row => row.connection_id !== connection.id)
        this.tables.connected_calendars = (this.tables.connected_calendars || []).filter(row => row.connection_id !== connection.id)
        this.tables.calendar_events = (this.tables.calendar_events || []).filter(row => !calendarIds.includes(row.calendar_id))
        this.tables.calendar_write_operations = (this.tables.calendar_write_operations || []).filter(row => row.connection_id !== connection.id && !calendarIds.includes(row.target_calendar_id))
        for (const preference of this.tables.calendar_preferences || []) if (calendarIds.includes(preference.default_calendar_id)) preference.default_calendar_id = null
        return { data: true, error: null }
      }
      throw new Error(`Unsupported RPC ${name}`)
    },
  }
  const env = { CALENDAR_CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString('base64'), GOOGLE_CALENDAR_CLIENT_ID: 'test-client', GOOGLE_CALENDAR_CLIENT_SECRET: 'test-secret', GOOGLE_CALENDAR_REDIRECT_URI: 'https://anastasis.test/api/calendars/google/callback' }
  const json = (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
  const next = { NextResponse: { json, redirect: url => new Response(null, { status: 307, headers: { Location: String(url) } }) } }
  const timezone = load('lib/timezone.ts', {}, env)
  const time = load('lib/schedule/time.ts', { '@/lib/timezone': timezone }, env)
  const actions = load('lib/schedule/actions.ts', {}, env)
  const entitlements = load('lib/entitlements.ts', {}, env)
  const loggingRoutes = load('lib/nutrition/loggingRoutes.ts', { '@/lib/entitlements': entitlements }, env)
  const engine = load('lib/schedule/engine.ts', { './actions': actions, '@/lib/nutrition/loggingRoutes': loggingRoutes }, env)
  const types = load('lib/calendar/providers/types.ts', {}, env)
  const ical = load('lib/calendar/providers/ical.ts', { './types': types }, env)
  const access = load('lib/commerce/access.ts', {}, env)
  const context = load('lib/calendar/server-context.ts', { 'next/server': next, '@/lib/supabase/server': { createClient: async () => db }, '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/mobile/auth': {}, '@/lib/commerce/access': access, './providers/types': types }, env)
  const crypto = load('lib/calendar/crypto.ts', {}, env)
  const external = new Map([['existing-appointment', { id: 'existing-appointment', calendarId: 'google-primary', title: 'School pickup', start: '2030-06-18T20:00:00Z', end: '2030-06-18T20:30:00Z', timeZone: 'America/Chicago', allDay: false, status: 'confirmed', busy: true, etag: 'etag-v1' }]])
  const calendars = [{ id: 'google-primary', name: 'Personal', timeZone: 'America/Chicago', writable: true }, { id: 'google-readonly', name: 'Shared school', timeZone: 'America/Chicago', writable: false }]
  const cloudTransport = (assertCredentials = () => {}, resourceId = hash => hash) => ({
    sync: async (credentials, calendar) => { assertCredentials(credentials); state.calls.sync++; if (state.syncError) throw state.syncError; return { events: [...external.values()].filter(event => event.calendarId === calendar.id).map(copy), deletedIds: [], reset: state.fullReset, nextSyncToken: `sync-${state.calls.sync}` } },
    create: async (credentials, calendar, draft, key) => {
      assertCredentials(credentials); state.calls.create++; if (state.createError) throw state.createError; const id = resourceId(createHash('sha256').update(key).digest('hex'))
      if (!external.has(id)) external.set(id, { ...copy(draft), id, calendarId: calendar.id, status: 'confirmed', busy: true, etag: `create-${state.calls.create}` })
      return copy(external.get(id))
    },
    update: async (credentials, _calendar, id, draft, etag, _fetcher, operationKey) => {
      assertCredentials(credentials); state.calls.update++; const event = external.get(id)
      if (operationKey && event.metadata?.anastasisUpdateOperation === operationKey) return copy(event)
      if (event.etag !== etag) throw new types.ProviderError('conflict', 'This appointment changed externally.')
      state.calls.updateWrites++
      Object.assign(event, copy(draft), { etag: `update-${state.calls.update}`, metadata: { ...event.metadata, ...(operationKey ? { anastasisUpdateOperation: operationKey } : {}) } }); return copy(event)
    },
    delete: async (credentials, _calendar, id, etag) => { assertCredentials(credentials); state.calls.delete++; if (!external.has(id)) return; if (external.get(id).etag !== etag) throw new types.ProviderError('conflict', 'This appointment changed externally.'); external.delete(id) },
  })
  const googleTransport = cloudTransport()
  const google = {
    googleAuthorizationUrl: (config, rawState) => `https://provider.test/authorize?state=${rawState}`,
    exchangeGoogleCode: async () => ({ accessToken: 'fake-access-for-tests', refreshToken: 'fake-refresh-for-tests', expiresAt: Date.now() + 3600000 }),
    googleAccountIdentity: async () => ({ id: 'google-account-a', email: 'calendar@example.test' }),
    discoverGoogleCalendars: async () => copy(calendars),
    refreshGoogleCredentials: async (_config, credentials) => { state.calls.refresh++; return { ...credentials, expiresAt: Date.now() + 3600000 } },
    syncGoogleCalendar: googleTransport.sync,
    createGoogleEvent: googleTransport.create,
    updateGoogleEvent: googleTransport.update,
    deleteGoogleEvent: googleTransport.delete,
    revokeGoogleCredentials: async () => { state.calls.revoke++ },
  }
  const icloudCredentials = { username: 'apple@example.test', appSpecificPassword: 'abcd-efgh-ijkl-mnop' }
  const icloudCalendars = [{ id: 'https://p42-caldav.icloud.com/12345/calendars/personal/', name: 'Apple Personal', timeZone: 'America/Chicago', writable: true }, { id: 'https://p42-caldav.icloud.com/12345/calendars/shared/', name: 'Apple Shared', timeZone: 'America/Chicago', writable: false }]
  const assertICloudCredentials = credentials => assert.deepEqual(copy(credentials), icloudCredentials)
  const icloudTransport = cloudTransport(assertICloudCredentials, hash => `${icloudCalendars[0].id}${hash}.ics`)
  const icloud = {
    discoverICloudCalendars: async credentials => { assertICloudCredentials(credentials); state.calls.icloudDiscover++; return copy(icloudCalendars) },
    syncICloudCalendar: icloudTransport.sync,
    createICloudEvent: icloudTransport.create,
    updateICloudEvent: icloudTransport.update,
    deleteICloudEvent: icloudTransport.delete,
  }
  const service = load('lib/calendar/service.ts', { './crypto': crypto, './server-context': context, './providers/google': google, './providers/icloud': icloud, './providers/types': types, './providers/ical': ical, '@/lib/schedule/time': time }, env)
  const handlers = load('lib/calendar/api-handlers.ts', {
    'next/server': next, 'next/headers': { cookies: async () => ({ set: (key, value) => state.cookies.set(key, value), get: key => state.cookies.has(key) ? { value: state.cookies.get(key) } : undefined, delete: key => state.cookies.delete(key) }) },
    '@/lib/supabase/admin': { createAdminClient: () => db }, './server-context': context, './crypto': crypto, './service': service,
    './providers/google': google, './providers/icloud': icloud, './providers/types': types, './providers/ical': ical,
    '@/lib/schedule/time': time, '@/lib/schedule/engine': { getOpenWindows: (...args) => { state.windowChecks = (state.windowChecks || 0) + 1; return engine.getOpenWindows(...args) } },
    '@/lib/schedule/service': { getDailyScheduleState: async () => state.dailySchedule || { fixedEvents: [], unavailableSources: [] } }, '@/lib/timezone': timezone,
    '@/lib/dashboard/invalidateDailyPlan': { invalidateDailyPlan: () => { state.invalidations = (state.invalidations || 0) + 1 } },
  }, env)
  const request = (path, method = 'GET', body) => new Request(`https://anastasis.test${path}`, { method, headers: { Origin: 'https://anastasis.test', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const body = (overrides = {}) => ({ title: 'Anastasis activity', event_type: 'workout', start_at: '2030-06-18T14:00:00Z', end_at: '2030-06-18T14:30:00Z', timezone: 'America/Chicago', all_day: false, recurrence: [], reminders: [], idempotency_key: randomUUID(), ...overrides })
  async function connect() {
    const begin = await handlers.googleConnect(request('/api/calendars/google/connect', 'POST'))
    assert.equal(begin.status, 200)
    const rawState = new URL((await begin.json()).url).searchParams.get('state')
    const callback = await handlers.googleCallback(request(`/api/calendars/google/callback?state=${rawState}&code=test-code`))
    assert.match(callback.headers.get('Location'), /calendar_connected=1/)
    const connection = db.tables.calendar_connections[0]
    const calendar = db.tables.connected_calendars.find(row => row.provider_calendar_id === 'google-primary')
    const selected = await handlers.connectionPATCH(request(`/api/calendars/${connection.id}`, 'PATCH', { selected_calendar_ids: [calendar.id], default_calendar_id: calendar.id }), connection.id)
    assert.equal(selected.status, 200)
    return { connection, calendar }
  }
  return { state, db, external, calendars, icloudCalendars, icloudCredentials, handlers, service, context, crypto, types, request, body, connect }
}

test('inactive or missing member cannot reach external calendar providers', async () => {
  const f = fixture()
  f.db.tables.clients[0].access = false
  const response = await f.handlers.googleConnect(f.request('/api/calendars/google/connect', 'POST'))
  assert.equal(response.status, 403)
  assert.equal(f.state.calls.create, 0)
  f.db.tables.clients = []
  assert.equal((await f.handlers.stateGET(f.request('/api/calendars'))).status, 403)
})

test('availability refuses incomplete schedule sources instead of advertising unverified free time', async () => {
  const f = fixture(), path = '/api/calendars/availability?date=2030-06-18&duration=30'
  f.state.dailySchedule = { fixedEvents: [], unavailableSources: ['recurring_commitments'] }
  const unavailable = await f.handlers.availabilityGET(f.request(path))
  assert.equal(unavailable.status, 503)
  const error = await unavailable.json()
  assert.match(error.error, /full schedule could not be loaded/)
  assert.equal(error.windows, undefined)
  assert.equal(f.state.windowChecks || 0, 0)
  assert.deepEqual(f.db.mutations, {})

  // Once every source loads, the real window calculation respects the commitment.
  f.state.dailySchedule = { unavailableSources: [], fixedEvents: [{ id: 'saved-work', status: 'scheduled', flexibility_type: 'fixed', start_at: '2030-06-18T14:00:00Z', end_at: '2030-06-18T22:00:00Z' }] }
  const complete = await f.handlers.availabilityGET(f.request(path))
  assert.equal(complete.status, 200)
  const result = await complete.json()
  assert.equal(result.windows.length, 2)
  assert.ok(result.windows.every(window => window.end_at <= '2030-06-18T13:50:00.000Z' || window.start_at >= '2030-06-18T22:10:00.000Z'))
  assert.equal(f.state.windowChecks, 1)
  assert.deepEqual(f.db.mutations, {})
})

test('mocked Google authorization → selection → existing appointment → confirmed create → external change → edit/delete', async () => {
  const f = fixture(), { connection, calendar } = await f.connect()
  const state = await (await f.handlers.stateGET(f.request('/api/calendars'))).json()
  assert.equal(state.preferences.default_calendar_id, calendar.id)
  assert.equal(state.connections[0].calendars.find(row => row.id === calendar.id).selected, true)
  assert.doesNotMatch(JSON.stringify(state), /fake-access|fake-refresh|encrypted_value|appSpecificPassword/)
  const list = () => f.handlers.eventsGET(f.request('/api/calendars/events?start=2030-06-18T00:00:00Z&end=2030-06-20T00:00:00Z'))
  const appointment = (await (await list()).json()).events.find(event => event.title === 'School pickup')
  assert.ok(appointment); assert.match(appointment.source_label, /Google · Personal/)
  const draft = f.body({ calendar_id: calendar.id })
  const create = await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))
  assert.equal(create.status, 200); const created = await create.json(); assert.equal(created.synced, true)
  const cached = f.db.tables.calendar_events.find(row => row.id === created.id), providerId = cached.provider_event_id, originalEtag = cached.etag
  assert.equal(f.external.get(providerId).title, 'Anastasis activity')
  f.external.get(providerId).title = 'Updated externally'; f.external.get(providerId).etag = 'external-v2'
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 200)
  const updated = (await (await list()).json()).events.find(event => event.id === created.id)
  assert.equal(updated.title, 'Updated externally'); assert.equal(updated.etag, 'external-v2')
  const stale = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${created.id}`, 'PATCH', f.body({ title: 'Old view edit', calendar_id: calendar.id, expected_etag: originalEtag, scope: 'instance' })), created.id)
  assert.equal(stale.status, 409)
  const edit = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${created.id}`, 'PATCH', f.body({ title: 'Confirmed explicit edit', calendar_id: calendar.id, expected_etag: 'external-v2', scope: 'instance' })), created.id)
  assert.equal(edit.status, 200); assert.equal(f.external.get(providerId).title, 'Confirmed explicit edit')
  const deletion = { expected_etag: f.external.get(providerId).etag, idempotency_key: randomUUID(), scope: 'instance' }
  assert.equal((await f.handlers.eventsWrite(f.request(`/api/calendars/events/${created.id}`, 'DELETE', deletion), created.id)).status, 200)
  assert.equal(f.external.has(providerId), false)
  assert.equal((await f.handlers.eventsWrite(f.request(`/api/calendars/events/${created.id}`, 'DELETE', deletion), created.id)).status, 200)
  assert.equal(f.state.calls.delete, 1)
})

test('mocked iCloud app-password link → selection → existing appointment → create → external change → edit/delete → disconnect', async () => {
  const f = fixture(), login = f.state.user, providerCalendar = f.icloudCalendars[0]
  const resource = `${providerCalendar.id}existing-appointment.ics`
  f.external.set(resource, { id: resource, calendarId: providerCalendar.id, title: 'Existing appointment', start: '2030-06-18T20:00:00Z', end: '2030-06-18T20:30:00Z', timeZone: 'America/Chicago', allDay: false, status: 'confirmed', busy: true, etag: 'icloud-original' })
  const connected = await f.handlers.icloudConnect(f.request('/api/calendars/icloud', 'POST', { email: f.icloudCredentials.username, app_password: f.icloudCredentials.appSpecificPassword }))
  assert.equal(connected.status, 200)
  assert.equal(f.state.user, login)
  const connection = f.db.tables.calendar_connections.find(row => row.provider === 'icloud')
  const calendar = f.db.tables.connected_calendars.find(row => row.provider_calendar_id === providerCalendar.id)
  assert.equal(connection.provider_account_id, f.icloudCredentials.username)
  const encrypted = f.db.tables.calendar_credentials.find(row => row.connection_id === connection.id).encrypted_value
  assert.doesNotMatch(encrypted, /abcd-efgh|apple@example/)
  assert.deepEqual(copy(f.crypto.unseal(encrypted, `${login.id}:${connection.id}`)), f.icloudCredentials)
  assert.equal(f.db.tables.calendar_events?.length || 0, 0)
  const selection = await f.handlers.connectionPATCH(f.request(`/api/calendars/${connection.id}`, 'PATCH', { selected_calendar_ids: [calendar.id], default_calendar_id: calendar.id }), connection.id)
  assert.equal(selection.status, 200)
  const settings = await (await f.handlers.stateGET(f.request('/api/calendars'))).json()
  assert.equal(settings.preferences.default_calendar_id, calendar.id)
  assert.equal(settings.connections[0].provider, 'icloud')
  assert.equal(settings.connections[0].status, 'connected')
  assert.ok(settings.connections[0].last_synced_at)
  assert.doesNotMatch(JSON.stringify(settings), /appSpecificPassword|abcd-efgh|encrypted_value/)
  const list = async () => (await (await f.handlers.eventsGET(f.request('/api/calendars/events?start=2030-06-18T00:00:00Z&end=2030-06-20T00:00:00Z'))).json()).events
  const appointment = (await list()).find(event => event.external_event_id === resource)
  assert.equal(appointment.title, 'Existing appointment')
  assert.equal(appointment.source_label, 'iCloud · Apple Personal')
  const draft = f.body({ calendar_id: calendar.id })
  const created = await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))
  assert.equal(created.status, 200)
  const result = await created.json()
  assert.equal(result.synced, true)
  const cached = f.db.tables.calendar_events.find(row => row.id === result.id)
  const external = f.external.get(cached.provider_event_id)
  assert.match(external.id, /^https:\/\/p42-caldav\.icloud\.com\/12345\/calendars\/personal\/[a-f0-9]+\.ics$/)
  assert.equal(external.title, 'Anastasis activity')
  external.title = 'Edited in Apple Calendar'; external.etag = 'icloud-external-v2'
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 200)
  const changed = (await list()).find(event => event.id === result.id)
  assert.equal(changed.title, 'Edited in Apple Calendar')
  assert.equal(changed.etag, 'icloud-external-v2')
  const edit = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${result.id}`, 'PATCH', f.body({ title: 'Explicit Anastasis edit', calendar_id: calendar.id, expected_etag: changed.etag, scope: 'series' })), result.id)
  assert.equal(edit.status, 200)
  assert.equal(external.title, 'Explicit Anastasis edit')
  const deleted = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${result.id}`, 'DELETE', { expected_etag: external.etag, idempotency_key: randomUUID(), scope: 'series' }), result.id)
  assert.equal(deleted.status, 200)
  assert.equal((await deleted.json()).synced, true)
  assert.equal(f.external.has(external.id), false)
  const deleteCalls = f.state.calls.delete
  assert.equal((await f.handlers.connectionDELETE(f.request(`/api/calendars/${connection.id}`, 'DELETE'), connection.id)).status, 200)
  assert.equal(f.db.tables.calendar_credentials.length, 0)
  assert.equal(f.db.tables.calendar_events.length, 0)
  assert.equal(f.db.tables.connected_calendars.length, 0)
  assert.equal(f.db.tables.calendar_write_operations.length, 0)
  assert.equal(f.db.tables.calendar_preferences[0].default_calendar_id, null)
  assert.equal(f.external.has(resource), true)
  assert.equal(f.state.calls.delete, deleteCalls)
  assert.equal(f.state.calls.revoke, 0)
  assert.equal(f.state.user, login)
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 404)
})

test('repeated creation and retry after a local persistence failure do not duplicate external events', async () => {
  const f = fixture(), { calendar } = await f.connect(), draft = f.body({ calendar_id: calendar.id })
  const write = () => f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))
  f.db.failNext = 'calendar_events:upsert'
  assert.equal((await write()).status, 503)
  assert.equal((await write()).status, 200)
  assert.equal((await write()).status, 200)
  assert.equal(f.external.size, 2)
  assert.equal(f.db.tables.calendar_events.filter(row => row.provider_payload.title === draft.title).length, 1)
  assert.equal(f.state.calls.create, 2)
  const changed = await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', { ...draft, title: 'Different request' }))
  assert.equal(changed.status, 409); assert.equal(f.external.size, 2)
})

test('read-only and revoked accounts reject writes; reconnect restores access; disconnect removes imports only', async () => {
  const f = fixture(), { connection, calendar } = await f.connect()
  const readOnly = f.db.tables.connected_calendars.find(row => !row.writable); readOnly.selected = true
  assert.equal((await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', f.body({ calendar_id: readOnly.id })))).status, 403)
  assert.equal(f.state.calls.create, 0)
  connection.status = 'reconnect_required'
  assert.equal((await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', f.body({ calendar_id: calendar.id })))).status, 401)
  const restored = await f.service.linkAccount(f.db, 'user-a', 'google', connection.provider_account_id, connection.account_label, { accessToken: 'relinked-access', refreshToken: 'relinked-refresh', expiresAt: Date.now() + 3600000 })
  assert.equal(restored.id, connection.id); assert.equal(restored.status, 'connected')
  assert.equal((await f.handlers.connectionDELETE(f.request(`/api/calendars/${connection.id}`, 'DELETE'), connection.id)).status, 200)
  assert.equal(f.db.tables.calendar_credentials.length, 0); assert.equal(f.db.tables.calendar_events.length, 0)
  assert.equal(f.external.has('existing-appointment'), true); assert.equal(f.state.calls.delete, 0)
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 404)
})

test('cross-user event/connection/calendar operations cannot reach the provider', async () => {
  const f = fixture(), { connection, calendar } = await f.connect(), event = f.db.tables.calendar_events[0]
  f.state.user = { id: 'user-b', email: 'other@example.test' }
  const callsBefore = copy(f.state.calls)
  assert.equal((await f.handlers.eventsWrite(f.request(`/api/calendars/events/${event.id}`, 'PATCH', f.body({ calendar_id: calendar.id, expected_etag: event.etag })), event.id)).status, 404)
  assert.equal((await f.handlers.eventsWrite(f.request(`/api/calendars/events/${event.id}`, 'DELETE', { expected_etag: event.etag, idempotency_key: randomUUID() }), event.id)).status, 404)
  assert.equal((await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', f.body({ calendar_id: calendar.id })))).status, 404)
  assert.equal((await f.handlers.connectionPATCH(f.request(`/api/calendars/${connection.id}`, 'PATCH', { selected_calendar_ids: [calendar.id] }), connection.id)).status, 404)
  assert.equal((await f.handlers.connectionDELETE(f.request(`/api/calendars/${connection.id}`, 'DELETE'), connection.id)).status, 404)
  const visible = await (await f.handlers.eventsGET(f.request('/api/calendars/events?start=2030-06-18T00:00:00Z&end=2030-06-20T00:00:00Z'))).json()
  assert.deepEqual(visible.events, []); assert.deepEqual(f.state.calls, callsBefore)
})

test('full-sync reset removes appointments no longer present and keeps surviving mapping IDs stable', async () => {
  const f = fixture(), { connection } = await f.connect(), original = f.db.tables.calendar_events[0].id
  f.state.fullReset = true
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 200)
  assert.equal(f.db.tables.calendar_events[0].id, original)
  f.external.delete('existing-appointment')
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 200)
  assert.equal(f.db.tables.calendar_events.length, 0)
})

test('revoked sync records actionable reconnect status; invalid Apple primary-password input is rejected before discovery', async () => {
  const f = fixture(), { connection } = await f.connect()
  f.state.syncError = new f.types.ProviderError('reconnect_required', 'Reconnect this calendar account.')
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 401)
  assert.equal(connection.status, 'reconnect_required'); assert.equal(connection.lease_id, null)
  const invalidApple = await f.handlers.icloudConnect(f.request('/api/calendars/icloud', 'POST', { email: 'apple@example.test', app_password: 'a-primary-password' }))
  assert.equal(invalidApple.status, 400); assert.equal(f.state.calls.icloudDiscover, 0)
})

test('unconfirmed provider creation stays out of the unified calendar; the identical retry succeeds later', async () => {
  const f = fixture(), { calendar } = await f.connect(), draft = f.body({ calendar_id: calendar.id })
  f.state.createError = new f.types.ProviderError('temporary_failure', 'Provider is temporarily unavailable.')
  const write = () => f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))
  assert.equal((await write()).status, 503)
  assert.equal(f.external.size, 1); assert.equal(f.db.tables.calendar_events.length, 1)
  f.state.createError = null
  assert.equal((await write()).status, 200)
  assert.equal(f.external.size, 2); assert.equal(f.db.tables.calendar_events.length, 2)
})

test('expired credentials refresh before provider access and rate limits retain an actionable retry delay', async () => {
  const f = fixture(), { connection } = await f.connect(), stored = f.db.tables.calendar_credentials[0]
  stored.encrypted_value = f.crypto.seal({ accessToken: 'expired-test-token', refreshToken: 'test-refresh', expiresAt: Date.now() - 1 }, `user-a:${connection.id}`)
  assert.equal((await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)).status, 200)
  assert.equal(f.state.calls.refresh, 1)
  f.state.syncError = new f.types.ProviderError('rate_limited', 'Wait before refreshing again.', 180)
  const before = Date.now()
  const limited = await f.handlers.connectionSync(f.request(`/api/calendars/${connection.id}/sync`, 'POST'), connection.id)
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '180')
  assert.equal(connection.error_code, 'rate_limited'); assert.ok(Date.parse(connection.next_sync_at) >= before + 180000)
})

test('recurring all-day API events preserve dates across DST and require explicit whole-series edits/deletion', async () => {
  const f = fixture(), { calendar } = await f.connect()
  const draft = f.body({ calendar_id: calendar.id, all_day: true, start_date: '2026-03-07', end_date: '2026-03-08', timezone: 'America/New_York', recurrence: ['RRULE:FREQ=DAILY;COUNT=4'] })
  const created = await (await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))).json()
  const list = await (await f.handlers.eventsGET(f.request('/api/calendars/events?start=2026-03-06T00:00:00Z&end=2026-03-12T00:00:00Z'))).json()
  const events = list.events.filter(event => event.id === created.id)
  assert.deepEqual(events.map(event => event.start_date), ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
  const dstDay = events.find(event => event.start_date === '2026-03-08')
  assert.equal((Date.parse(dstDay.end_at) - Date.parse(dstDay.start_at)) / 3600000, 23)
  assert.equal(dstDay.series_start_date, '2026-03-07'); assert.equal(dstDay.series_end_date, '2026-03-08')
  const instanceEdit = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${created.id}`, 'PATCH', { ...draft, idempotency_key: randomUUID(), expected_etag: events[0].etag, scope: 'instance' }), created.id)
  assert.equal(instanceEdit.status, 400); assert.equal(f.state.calls.update, 0)
  const seriesEdit = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${created.id}`, 'PATCH', { ...draft, title: 'Series confirmed', idempotency_key: randomUUID(), expected_etag: events[0].etag, scope: 'series' }), created.id)
  assert.equal(seriesEdit.status, 200)
  const row = f.db.tables.calendar_events.find(event => event.id === created.id)
  assert.equal((await f.handlers.eventsWrite(f.request(`/api/calendars/events/${created.id}`, 'DELETE', { expected_etag: row.etag, idempotency_key: randomUUID(), scope: 'series' }), created.id)).status, 200)
  assert.equal(f.external.has(row.provider_event_id), false)
})

test('denied OAuth and a mismatched linking state never attach an account or change the login identity', async () => {
  const f = fixture(), originalUser = f.state.user
  const begin = await (await f.handlers.googleConnect(f.request('/api/calendars/google/connect', 'POST'))).json()
  const rawState = new URL(begin.url).searchParams.get('state')
  const denied = await f.handlers.googleCallback(f.request(`/api/calendars/google/callback?state=${rawState}&error=access_denied`))
  assert.match(denied.headers.get('Location'), /calendar_error=/); assert.equal(f.db.tables.calendar_connections?.length || 0, 0)
  assert.equal(f.state.user, originalUser)
  const mismatch = await f.handlers.googleCallback(f.request('/api/calendars/google/callback?state=foreign-state&code=code'))
  assert.match(mismatch.headers.get('Location'), /calendar_error=/); assert.equal(f.db.tables.calendar_connections?.length || 0, 0)
  assert.equal(f.state.user, originalUser)
})

test('all-day appointments from UTC+14 occupy the full viewer date even when displayed in UTC−12', async () => {
  const f = fixture(), { connection, calendar } = await f.connect()
  f.external.set('island-date', { id: 'island-date', calendarId: 'google-primary', title: 'Day off', start: '2030-06-18', end: '2030-06-19', timeZone: 'Pacific/Kiritimati', allDay: true, status: 'confirmed', busy: true, etag: 'island-etag' })
  await f.service.syncConnection(f.db, 'user-a', connection.id)
  const chicago = await f.service.listUnifiedEvents(f.db, 'user-a', '2030-06-18T05:00:00Z', '2030-06-19T05:00:00Z', 'America/Chicago')
  const first = chicago.events.find(event => event.external_event_id === 'island-date')
  assert.ok(first); assert.equal(first.calendar_id, calendar.id); assert.equal(first.start_at, '2030-06-18T05:00:00.000Z'); assert.equal(first.end_at, '2030-06-19T05:00:00.000Z')
  const extreme = await f.service.listUnifiedEvents(f.db, 'user-a', '2030-06-18T12:00:00Z', '2030-06-19T12:00:00Z', 'Etc/GMT+12')
  const second = extreme.events.find(event => event.external_event_id === 'island-date')
  assert.ok(second); assert.equal(second.start_at, '2030-06-18T12:00:00.000Z'); assert.equal(second.end_at, '2030-06-19T12:00:00.000Z')
  assert.equal(second.start_date, '2030-06-18'); assert.equal(second.end_date, '2030-06-19')
})

test('an in-progress sync blocks writes until its lease ends without reaching the external provider', async () => {
  const f = fixture(), { connection, calendar } = await f.connect(), draft = f.body({ calendar_id: calendar.id })
  connection.lease_id = 'a-running-sync-lease'
  assert.equal((await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))).status, 409)
  assert.equal(f.state.calls.create, 0); assert.equal(f.external.size, 1)
  connection.lease_id = null
  assert.equal((await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))).status, 200)
  assert.equal(f.state.calls.create, 1); assert.equal(connection.lease_id, null)
})

test('externally accepted edit retries reconcile after local persistence failure without a second provider mutation', async () => {
  const f = fixture(), { calendar } = await f.connect(), row = f.db.tables.calendar_events[0]
  const draft = f.body({ title: 'Confirmed edit', calendar_id: calendar.id, expected_etag: row.etag, scope: 'instance' })
  const write = () => f.handlers.eventsWrite(f.request(`/api/calendars/events/${row.id}`, 'PATCH', draft), row.id)
  f.db.failNext = 'calendar_events:update'
  assert.equal((await write()).status, 503)
  assert.equal(row.provider_payload.title, 'School pickup')
  assert.equal(f.external.get(row.provider_event_id).title, 'Confirmed edit')
  assert.equal((await write()).status, 200)
  assert.equal(row.provider_payload.title, 'Confirmed edit')
  assert.equal(f.state.calls.updateWrites, 1)
})

test('retrying an accepted edit reads the newer canonical provider version without another mutation', async () => {
  const f = fixture(), { connection, calendar } = await f.connect(), row = f.db.tables.calendar_events[0]
  const draft = f.body({ title: 'Earlier accepted edit', event_type: 'personal', calendar_id: calendar.id, expected_etag: row.etag, scope: 'instance' })
  const write = () => f.handlers.eventsWrite(f.request(`/api/calendars/events/${row.id}`, 'PATCH', draft), row.id)
  f.db.failNext = 'calendar_events:update'
  assert.equal((await write()).status, 503)
  const external = f.external.get(row.provider_event_id)
  external.title = 'Newer personal appointment'; external.etag = 'manual-newer-etag'
  await f.service.syncConnection(f.db, 'user-a', connection.id)
  const eventMutations = f.db.mutations.calendar_events
  const providerUpdates = f.state.calls.update
  assert.equal((await write()).status, 200)
  assert.equal(f.db.mutations.calendar_events, eventMutations)
  assert.equal(f.state.calls.update, providerUpdates + 1)
  assert.equal(row.etag, 'manual-newer-etag'); assert.equal(row.provider_payload.title, 'Newer personal appointment')
  assert.equal(external.title, 'Newer personal appointment'); assert.equal(f.state.calls.updateWrites, 1)
})

test('confirmed external deletion retries after a missing local response without re-accessing the provider', async () => {
  const f = fixture(), awaitConnect = await f.connect(), row = f.db.tables.calendar_events[0]
  const draft = { expected_etag: row.etag, idempotency_key: randomUUID(), scope: 'instance' }
  const write = () => f.handlers.eventsWrite(f.request(`/api/calendars/events/${row.id}`, 'DELETE', draft), row.id)
  f.db.failWhen = query => query.table === 'calendar_write_operations' && query.operation === 'update' && query.values.response !== undefined
  assert.equal((await write()).status, 503)
  assert.equal(f.external.has(row.provider_event_id), false); assert.equal(f.db.tables.calendar_events.length, 0)
  const operation = f.db.tables.calendar_write_operations.find(item => item.idempotency_key === draft.idempotency_key)
  assert.equal(operation.deletion_confirmed, true); assert.equal(operation.target_event_id, row.id); assert.equal(operation.target_external, true)
  const retry = await write(); assert.equal(retry.status, 200); assert.equal((await retry.json()).synced, true)
  assert.equal(f.state.calls.delete, 1)
  assert.equal(awaitConnect.connection.lease_id, null)
})

test('confirmed external deletion retries after a local delete failure clear the remaining imported event', async () => {
  const f = fixture(); await f.connect(); const row = f.db.tables.calendar_events[0]
  const draft = { expected_etag: row.etag, idempotency_key: randomUUID(), scope: 'instance' }
  const write = () => f.handlers.eventsWrite(f.request(`/api/calendars/events/${row.id}`, 'DELETE', draft), row.id)
  f.db.failNext = 'calendar_events:delete'
  assert.equal((await write()).status, 503)
  assert.equal(f.external.has(row.provider_event_id), false); assert.equal(f.db.tables.calendar_events.length, 1)
  assert.equal((await write()).status, 200)
  assert.equal(f.db.tables.calendar_events.length, 0)
})

test('external deletion retries from recorded owned intent when confirmation persistence failed and sync removed its cache', async () => {
  const f = fixture(), { connection, calendar } = await f.connect(), row = f.db.tables.calendar_events[0]
  const draft = { expected_etag: row.etag, idempotency_key: randomUUID(), scope: 'instance' }
  const write = () => f.handlers.eventsWrite(f.request(`/api/calendars/events/${row.id}`, 'DELETE', draft), row.id)
  f.db.failWhen = query => query.table === 'calendar_write_operations' && query.operation === 'update' && query.values.deletion_confirmed === true
  assert.equal((await write()).status, 503)
  assert.equal(f.external.has(row.provider_event_id), false)
  const operation = f.db.tables.calendar_write_operations.find(item => item.idempotency_key === draft.idempotency_key)
  assert.equal(operation.target_event_id, row.id)
  assert.equal(operation.target_calendar_id, calendar.id)
  assert.equal(operation.target_provider_event_id, row.provider_event_id)
  assert.equal(operation.target_provider_etag, draft.expected_etag)
  assert.notEqual(operation.deletion_confirmed, true)
  assert.equal('provider_payload' in operation, false)
  f.state.fullReset = true
  await f.service.syncConnection(f.db, 'user-a', connection.id)
  assert.equal(f.db.tables.calendar_events.length, 0)
  const retry = await write()
  assert.equal(retry.status, 200)
  assert.equal((await retry.json()).synced, true)
  assert.equal(f.state.calls.delete, 2)
  assert.equal(operation.deletion_confirmed, true)
  assert.equal(connection.lease_id, null)
})

test('missing-cache deletion retry still requires the recorded owner and a selected writable calendar', async () => {
  const f = fixture(), { connection, calendar } = await f.connect(), row = f.db.tables.calendar_events[0]
  const draft = { expected_etag: row.etag, idempotency_key: randomUUID(), scope: 'instance' }
  const write = () => f.handlers.eventsWrite(f.request(`/api/calendars/events/${row.id}`, 'DELETE', draft), row.id)
  f.db.failWhen = query => query.table === 'calendar_write_operations' && query.operation === 'update' && query.values.deletion_confirmed === true
  assert.equal((await write()).status, 503)
  f.state.fullReset = true
  await f.service.syncConnection(f.db, 'user-a', connection.id)
  f.state.user = { id: 'user-b' }
  assert.equal((await write()).status, 404)
  assert.equal(f.state.calls.delete, 1)
  f.state.user = { id: 'user-a' }
  const cachedCalendar = f.db.tables.connected_calendars.find(item => item.id === calendar.id)
  cachedCalendar.selected = false
  assert.equal((await write()).status, 404)
  assert.equal(f.state.calls.delete, 1)
  cachedCalendar.selected = true; cachedCalendar.writable = false
  assert.equal((await write()).status, 403)
  assert.equal(f.state.calls.delete, 1)
  cachedCalendar.writable = true; connection.lease_id = 'other-refresh'
  assert.equal((await write()).status, 409)
  assert.equal(f.state.calls.delete, 1)
  connection.lease_id = null
  assert.equal((await write()).status, 200)
})

test('failure to persist owned delete intent prevents any external deletion', async () => {
  const f = fixture(); await f.connect(); const row = f.db.tables.calendar_events[0]
  const draft = { expected_etag: row.etag, idempotency_key: randomUUID(), scope: 'instance' }
  f.db.failWhen = query => query.table === 'calendar_write_operations' && query.operation === 'update' && query.values.target_provider_event_id !== undefined
  const response = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${row.id}`, 'DELETE', draft), row.id)
  assert.equal(response.status, 503)
  assert.equal(f.state.calls.delete, 0)
  assert.equal(f.external.has(row.provider_event_id), true)
})

test('calendar reads and edits preserve original times while displaying rescheduled internal events on their effective day', async () => {
  const f = fixture(), id = randomUUID()
  const legacy = { id, user_id: f.state.user.id, client_id: 'QA-ONLY', title: 'Personal task', event_type: 'personal', status: 'scheduled',
    source: 'manual', timezone: 'America/Chicago', all_day: false, start_at: '2030-06-17T14:00:00.000Z', end_at: '2030-06-17T14:30:00.000Z',
    adjusted_start_at: '2030-06-18T15:00:00.000Z', adjusted_end_at: '2030-06-18T15:30:00.000Z', adjusted_duration_minutes: 30,
    updated_at: '2026-10-11T12:00:00Z', created_at: '2026-10-11T12:00:00Z' }
  f.db.tables.anastasis_schedule_events = [legacy]
  const list = async day => (await f.service.listUnifiedEvents(f.db, f.state.user.id, `${day}T00:00:00-05:00`, `${day}T23:59:59-05:00`)).events
  assert.equal((await list('2030-06-17')).length, 0)
  const [moved] = await list('2030-06-18')
  assert.equal(moved.start_at, legacy.adjusted_start_at)
  assert.equal(moved.end_at, legacy.adjusted_end_at)
  const updated = await f.handlers.eventsWrite(f.request(`/api/calendars/events/${id}`, 'PATCH', f.body({ title: 'Edited task', start_at: '2030-06-19T15:00:00.000Z', end_at: '2030-06-19T15:45:00.000Z', expected_etag: legacy.updated_at })), id)
  assert.equal(updated.status, 200)
  assert.equal(legacy.start_at, '2030-06-17T14:00:00.000Z')
  assert.equal(legacy.end_at, '2030-06-17T14:30:00.000Z')
  assert.equal(legacy.adjusted_start_at, '2030-06-19T15:00:00.000Z')
  assert.equal(legacy.adjusted_duration_minutes, 45)
  assert.equal((await list('2030-06-18')).length, 0)
  assert.equal((await list('2030-06-19'))[0].title, 'Edited task')
})

test('calendar mutations invalidate dependent dashboard state; reads and rejected writes do not', async () => {
  const f = fixture()
  await f.handlers.stateGET(f.request('/api/calendars'))
  assert.equal(f.state.invalidations || 0, 0)
  const draft = f.body()
  assert.equal((await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', draft))).status, 200)
  assert.equal(f.state.invalidations, 1)
  await f.handlers.eventsGET(f.request('/api/calendars/events?start=2030-06-18T00:00:00Z&end=2030-06-20T00:00:00Z'))
  assert.equal(f.state.invalidations, 1)
  const denied = await f.handlers.eventsWrite(f.request('/api/calendars/events', 'POST', f.body({ calendar_id: randomUUID() })))
  assert.equal(denied.status, 404)
  assert.equal(f.state.invalidations, 1)
})
