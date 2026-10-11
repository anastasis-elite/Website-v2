import 'server-only'
import { createHash } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'
import { buildICalendar, parseICalendar } from './ical'
import {
  ProviderError, type EventDraft, type Fetcher, type ICloudCredentials,
  type ProviderCalendar, type ProviderEvent, type ProviderSyncResult, type SyncWindow,
} from './types'

const ROOT = 'https://caldav.icloud.com/'
const XML_LIMIT = 16 * 1024 * 1024
const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value]
const escapeXml = (value: string) => value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]!))

/** Restrict every discovered href and redirect before attaching Apple credentials. */
export function safeICloudUrl(href: string, base = ROOT): string {
  let url: URL
  try { url = new URL(href, base) } catch { throw new ProviderError('invalid_response', 'iCloud returned an invalid calendar address.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.search ||
    !/^(?:caldav|p\d+-caldav)\.icloud\.com$/i.test(url.hostname)) {
    throw new ProviderError('invalid_response', 'iCloud returned an untrusted calendar address.')
  }
  return url.toString()
}

export function validateICloudCredentials(credentials: ICloudCredentials) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.username) || credentials.username.length > 254) {
    throw new ProviderError('invalid_input', 'Enter the email address for your Apple Account.')
  }
  // Enforce Apple's generated password format so a primary Apple password is never accepted.
  if (!/^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i.test(credentials.appSpecificPassword)) {
    throw new ProviderError('invalid_input', 'Use a generated Apple app-specific password (xxxx-xxxx-xxxx-xxxx), never your primary Apple password.')
  }
}

async function davRequest(credentials: ICloudCredentials, href: string, init: RequestInit, fetcher: Fetcher, redirects = 0): Promise<Response> {
  validateICloudCredentials(credentials)
  const url = safeICloudUrl(href)
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Basic ${Buffer.from(`${credentials.username}:${credentials.appSpecificPassword}`).toString('base64')}`)
  let response: Response
  try { response = await fetcher(url, { ...init, headers, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(20_000) }) }
  catch { throw new ProviderError('temporary_failure', 'iCloud Calendar is temporarily unavailable. Please retry.') }
  if ([301, 302, 307, 308].includes(response.status)) {
    const target = response.headers.get('location')
    if (!target || redirects >= 3) throw new ProviderError('invalid_response', 'iCloud Calendar returned too many redirects.')
    return davRequest(credentials, safeICloudUrl(target, url), init, fetcher, redirects + 1)
  }
  return response
}

function assertDavSuccess(response: Response) {
  if (response.ok) return
  if (response.status === 401) throw new ProviderError('reconnect_required', 'Your iCloud app-specific password was rejected or revoked. Generate a new one and reconnect.')
  if (response.status === 412 || response.status === 409) throw new ProviderError('conflict', 'This event changed in iCloud. Refresh and review its latest version.')
  if (response.status === 403) throw new ProviderError('permission_denied', 'iCloud did not permit this action. Check your calendar access.')
  if (response.status === 404) throw new ProviderError('not_found', 'This iCloud calendar or event is no longer available.')
  const delay = Number(response.headers.get('retry-after'))
  const retry = Number.isFinite(delay) && delay > 0 ? Math.min(delay, 3600) : undefined
  if (response.status === 429) throw new ProviderError('rate_limited', 'iCloud Calendar is busy. Sync will retry shortly.', retry)
  if (response.status >= 500) throw new ProviderError('temporary_failure', 'iCloud Calendar is temporarily unavailable. Please retry.', retry)
  throw new ProviderError('invalid_input', 'iCloud could not accept this calendar request. Check event dates and calendar access.')
}

async function limitedText(response: Response) {
  if (Number(response.headers.get('content-length')) > XML_LIMIT) throw new ProviderError('invalid_response', 'This calendar response is too large to process safely.')
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > XML_LIMIT) { await reader.cancel(); throw new ProviderError('invalid_response', 'This calendar response is too large to process safely.') }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function parseXml(response: Response): Promise<Record<string, any>> {
  assertDavSuccess(response)
  const xml = await limitedText(response)
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new ProviderError('invalid_response', 'iCloud returned unsupported XML data.')
  try { return new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, trimValues: false, processEntities: true, parseTagValue: false }).parse(xml) }
  catch { throw new ProviderError('invalid_response', 'iCloud returned an unreadable calendar response.') }
}

function responses(data: Record<string, any>) { return array<Record<string, any>>(data.multistatus?.response) }
function properties(response: Record<string, any>): Record<string, any> {
  return Object.assign({}, ...array<Record<string, any>>(response.propstat).filter(item => /\s2\d\d\b/.test(item.status || '')).map(item => item.prop || {}))
}
function propertyHref(value: any): string | undefined { return typeof value?.href === 'string' ? value.href : undefined }

async function propfind(credentials: ICloudCredentials, url: string, names: string, depth: string, fetcher: Fetcher) {
  return parseXml(await davRequest(credentials, url, {
    method: 'PROPFIND', headers: { Depth: depth, 'Content-Type': 'application/xml; charset=utf-8' },
    body: `<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:prop>${names}</d:prop></d:propfind>`,
  }, fetcher))
}

export async function discoverICloudCalendars(credentials: ICloudCredentials, fetcher: Fetcher = fetch): Promise<ProviderCalendar[]> {
  const initial = responses(await propfind(credentials, ROOT, '<d:current-user-principal/>', '0', fetcher))
  const principalHref = initial.map(item => propertyHref(properties(item)['current-user-principal'])).find(Boolean)
  if (!principalHref) throw new ProviderError('invalid_response', 'iCloud did not provide a calendar account. Enable iCloud Calendar and try again.')
  const principal = safeICloudUrl(principalHref)
  const principalData = responses(await propfind(credentials, principal, '<c:calendar-home-set/>', '0', fetcher))
  const homeHref = principalData.map(item => propertyHref(properties(item)['calendar-home-set'])).find(Boolean)
  if (!homeHref) throw new ProviderError('invalid_response', 'No iCloud calendar home was found. Enable iCloud Calendar and try again.')
  const home = safeICloudUrl(homeHref, principal)
  const entries = responses(await propfind(credentials, home,
    '<d:resourcetype/><d:displayname/><d:current-user-privilege-set/><d:sync-token/><c:calendar-timezone/><c:supported-calendar-component-set/><a:calendar-color/>', '1', fetcher))
  const calendars: ProviderCalendar[] = []
  for (const entry of entries) {
    const prop = properties(entry)
    if (!prop.resourcetype || typeof prop.resourcetype !== 'object' || !('calendar' in prop.resourcetype) || !entry.href) continue
    const components = array<Record<string, any>>(prop['supported-calendar-component-set']?.comp)
    if (components.length && !components.some(comp => comp['@_name'] === 'VEVENT')) continue
    const privileges = array<Record<string, any>>(prop['current-user-privilege-set']?.privilege)
    const can = (name: string) => privileges.some(privilege => typeof privilege === 'object' && name in privilege)
    let timeZone = 'UTC'
    if (typeof prop['calendar-timezone'] === 'string') {
      const match = /(?:^|\r?\n)TZID:([^\r\n]+)/.exec(prop['calendar-timezone'])
      if (match) { try { new Intl.DateTimeFormat('en', { timeZone: match[1] }); timeZone = match[1] } catch { /* Floating fallback is UTC, never server local. */ } }
    }
    const id = safeICloudUrl(entry.href, home)
    calendars.push({ id, name: typeof prop.displayname === 'string' ? prop.displayname : 'iCloud Calendar', timeZone,
      color: typeof prop['calendar-color'] === 'string' ? prop['calendar-color'].slice(0, 7) : undefined,
      writable: can('all') || can('write') || (can('write-content') && can('bind') && can('unbind')),
      syncToken: typeof prop['sync-token'] === 'string' ? prop['sync-token'] : undefined,
      metadata: { home, supportsSync: typeof prop['sync-token'] === 'string' },
    })
  }
  return calendars
}

async function readResource(credentials: ICloudCredentials, calendar: ProviderCalendar, href: string, fetcher: Fetcher): Promise<ProviderEvent[]> {
  const response = await davRequest(credentials, href, { method: 'GET', headers: { Accept: 'text/calendar' } }, fetcher)
  assertDavSuccess(response)
  return parseICalendar(await limitedText(response), calendar, safeICloudUrl(href), response.headers.get('etag') || undefined)
}

export async function syncICloudCalendar(credentials: ICloudCredentials, calendar: ProviderCalendar, _window: SyncWindow, syncToken?: string, fetcher: Fetcher = fetch): Promise<ProviderSyncResult> {
  const url = safeICloudUrl(calendar.id)
  let baseline: string | undefined
  if (!syncToken) {
    // Capture a token before reading data. A change racing this full read is safely replayed next sync.
    const props = responses(await propfind(credentials, url, '<d:sync-token/>', '0', fetcher)).map(properties)
    baseline = props.find(prop => typeof prop['sync-token'] === 'string')?.['sync-token']
  }
  const body = syncToken
    ? `<d:sync-collection xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:sync-token>${escapeXml(syncToken)}</d:sync-token><d:sync-level>1</d:sync-level><d:prop><d:getetag/><c:calendar-data/></d:prop></d:sync-collection>`
    : '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>'
  const response = await davRequest(credentials, url, { method: 'REPORT', headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }, body }, fetcher)
  // RFC6578 expired tokens use 403/DAV:valid-sync-token; unsupported REPORT may use 405/501.
  if (syncToken && [403, 405, 410, 501].includes(response.status)) {
    const error = await limitedText(response)
    if ([405, 410, 501].includes(response.status) || /valid-sync-token/i.test(error)) return syncICloudCalendar(credentials, calendar, _window, undefined, fetcher)
  }
  const data = await parseXml(response)
  const events: ProviderEvent[] = [], deletedIds: string[] = []
  for (const item of responses(data)) {
    if (typeof item.href !== 'string') continue
    const href = safeICloudUrl(item.href, url)
    if (href.replace(/\/$/, '') === url.replace(/\/$/, '')) continue
    if (!isCalendarResource(calendar.id, href)) throw new ProviderError('invalid_response', 'iCloud returned an event outside the selected calendar.')
    // Replacing a changed resource also removes any exceptions removed by the provider.
    deletedIds.push(href)
    if (/\s(?:404|410)\b/.test(item.status || '')) continue
    const prop = properties(item)
    if (typeof prop['calendar-data'] === 'string') events.push(...parseICalendar(prop['calendar-data'], calendar, href, prop.getetag))
    else events.push(...await readResource(credentials, calendar, href, fetcher))
  }
  const nextSyncToken = syncToken ? data.multistatus?.['sync-token'] : baseline
  return { events, deletedIds, nextSyncToken: typeof nextSyncToken === 'string' ? nextSyncToken : undefined, reset: !syncToken }
}

function assertWritable(calendar: ProviderCalendar) {
  if (!calendar.writable) throw new ProviderError('read_only', 'This iCloud calendar is read-only. Choose a writable calendar.')
}

function isCalendarResource(calendarId: string, resourceId: string) {
  const base = new URL(safeICloudUrl(calendarId)), resource = new URL(safeICloudUrl(resourceId))
  const path = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`
  return base.origin === resource.origin && resource.pathname.startsWith(path) && resource.pathname !== path &&
    !resource.pathname.slice(path.length).includes('/') && !resource.search
}

function assertResource(calendar: ProviderCalendar, resourceId: string) {
  if (!isCalendarResource(calendar.id, resourceId)) throw new ProviderError('invalid_input', 'This event does not belong to the selected iCloud calendar.')
}

export function deterministicICloudResource(calendar: ProviderCalendar, operationKey: string): { href: string; uid: string } {
  const uid = `anastasis-${createHash('sha256').update(operationKey).digest('hex')}@anastasis`
  const base = safeICloudUrl(calendar.id).replace(/\/$/, '') + '/'
  return { uid, href: safeICloudUrl(`${uid}.ics`, base) }
}

export async function createICloudEvent(credentials: ICloudCredentials, calendar: ProviderCalendar, draft: EventDraft, idempotencyKey: string, fetcher: Fetcher = fetch): Promise<ProviderEvent> {
  assertWritable(calendar)
  const { href, uid } = deterministicICloudResource(calendar, idempotencyKey)
  const ics = buildICalendar(draft, uid, { operationKey: idempotencyKey })
  const response = await davRequest(credentials, href, { method: 'PUT', headers: { 'If-None-Match': '*', 'Content-Type': 'text/calendar; charset=utf-8' }, body: ics }, fetcher)
  if (response.status === 412) {
    const existing = await readResource(credentials, calendar, href, fetcher)
    const master = existing.find(event => !event.recurringEventId)
    if (master?.metadata?.anastasisOperation !== idempotencyKey) throw new ProviderError('conflict', 'The event identifier is already in use. Refresh before retrying.')
    return master
  }
  assertDavSuccess(response)
  // Read back the provider's canonical resource + ETag only after the write has succeeded.
  const created = (await readResource(credentials, calendar, href, fetcher)).find(event => !event.recurringEventId)
  if (!created) throw new ProviderError('invalid_response', 'iCloud accepted the event but could not confirm it. Refresh before retrying.')
  return created
}

export async function updateICloudEvent(credentials: ICloudCredentials, calendar: ProviderCalendar, eventId: string, draft: EventDraft, etag: string, fetcher: Fetcher = fetch, operationKey?: string): Promise<ProviderEvent> {
  assertWritable(calendar); assertResource(calendar, eventId)
  if (!etag) throw new ProviderError('conflict', 'Refresh this event before editing it.')
  const events = await readResource(credentials, calendar, eventId, fetcher)
  const master = events.find(event => !event.recurringEventId)
  // A completed provider write may have outlived a failed local save; reconcile its current copy.
  if (operationKey && master?.metadata?.anastasisUpdateOperation === operationKey) return master
  if (!master || master.etag !== etag) throw new ProviderError('conflict', 'This event changed in iCloud. Refresh and review its latest version.')
  const ics = buildICalendar(draft, master.uid || eventId, { existingIcs: String(master.metadata?.ical || ''), updateOperationKey: operationKey })
  assertDavSuccess(await davRequest(credentials, eventId, { method: 'PUT', headers: { 'If-Match': etag, 'Content-Type': 'text/calendar; charset=utf-8' }, body: ics }, fetcher))
  const updated = (await readResource(credentials, calendar, eventId, fetcher)).find(event => !event.recurringEventId)
  if (!updated) throw new ProviderError('invalid_response', 'iCloud accepted the update but could not confirm it. Refresh your calendar.')
  return updated
}

export async function deleteICloudEvent(credentials: ICloudCredentials, calendar: ProviderCalendar, eventId: string, etag: string, fetcher: Fetcher = fetch): Promise<void> {
  assertWritable(calendar); assertResource(calendar, eventId)
  if (!etag) throw new ProviderError('conflict', 'Refresh this event before deleting it.')
  const response = await davRequest(credentials, eventId, { method: 'DELETE', headers: { 'If-Match': etag } }, fetcher)
  if (response.status === 404 || response.status === 410) return
  assertDavSuccess(response)
}
