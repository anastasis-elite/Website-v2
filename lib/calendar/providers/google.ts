import 'server-only'
import { createHash } from 'node:crypto'
import {
  ProviderError, type EventDraft, type Fetcher, type GoogleCredentials,
  type GoogleOAuthConfig, type ProviderCalendar, type ProviderEvent,
  type ProviderSyncResult, type SyncWindow,
} from './types'

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
] as const

const API = 'https://www.googleapis.com/calendar/v3'
const MAX_PAGES = 100

export function googleAuthorizationUrl(config: GoogleOAuthConfig, state: string, codeVerifier: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES.join(' '), state, access_type: 'offline',
    include_granted_scopes: 'true', prompt: 'consent select_account',
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
  }).toString()
  return url.toString()
}

async function safeFetch(fetcher: Fetcher, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetcher(url, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new ProviderError('temporary_failure', 'Google Calendar is temporarily unavailable. Please retry.')
  }
}

async function jsonResponse(response: Response): Promise<Record<string, any>> {
  const body = await response.json().catch(() => ({})) as Record<string, any>
  if (response.ok) return body
  const reason = body.error?.errors?.[0]?.reason
  if (response.status === 401 || body.error === 'invalid_grant') {
    throw new ProviderError('reconnect_required', 'Google access has expired or been revoked. Reconnect your calendar.')
  }
  if (response.status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'].includes(reason)) {
    throw new ProviderError('rate_limited', 'Google Calendar is busy. Sync will retry shortly.', retryAfter(response))
  }
  if (response.status === 412 || response.status === 409) {
    throw new ProviderError('conflict', 'This event changed in Google Calendar. Refresh and review the latest version.')
  }
  if (response.status === 410) throw new ProviderError('sync_token_expired', 'A fresh calendar synchronization is required.')
  if (response.status === 403) throw new ProviderError('permission_denied', 'Google did not permit this action. Check calendar permissions or reconnect.')
  if (response.status === 404) throw new ProviderError('not_found', 'The calendar or event is no longer available.')
  if (response.status >= 500) throw new ProviderError('temporary_failure', 'Google Calendar is temporarily unavailable. Please retry.', retryAfter(response))
  throw new ProviderError('invalid_input', 'Google Calendar could not accept this request. Check event dates and calendar permissions.')
}

function retryAfter(response: Response): number | undefined {
  const value = response.headers.get('retry-after')
  if (!value) return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 3600)) : undefined
}

async function tokenRequest(config: GoogleOAuthConfig, params: Record<string, string>, fetcher: Fetcher) {
  return jsonResponse(await safeFetch(fetcher, 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
  }))
}

export async function exchangeGoogleCode(config: GoogleOAuthConfig, code: string, codeVerifier: string, fetcher: Fetcher = fetch): Promise<GoogleCredentials> {
  const body = await tokenRequest(config, {
    code, code_verifier: codeVerifier, redirect_uri: config.redirectUri, grant_type: 'authorization_code',
  }, fetcher)
  if (!body.access_token || !body.refresh_token) {
    throw new ProviderError('reconnect_required', 'Reconnect Google Calendar and allow offline access.')
  }
  if (body.scope && !GOOGLE_CALENDAR_SCOPES.every(scope => String(body.scope).split(' ').includes(scope))) {
    throw new ProviderError('permission_denied', 'Allow calendar discovery and event access to connect Google Calendar.')
  }
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000, scope: body.scope }
}

export async function refreshGoogleCredentials(config: GoogleOAuthConfig, credentials: GoogleCredentials, fetcher: Fetcher = fetch): Promise<GoogleCredentials> {
  const body = await tokenRequest(config, { refresh_token: credentials.refreshToken, grant_type: 'refresh_token' }, fetcher)
  if (!body.access_token) throw new ProviderError('reconnect_required', 'Reconnect Google Calendar to continue synchronization.')
  return { ...credentials, accessToken: body.access_token, refreshToken: body.refresh_token || credentials.refreshToken,
    expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000, scope: body.scope || credentials.scope }
}

export async function googleAccountIdentity(credentials: GoogleCredentials, fetcher: Fetcher = fetch): Promise<{ id: string; email: string }> {
  const body = await jsonResponse(await safeFetch(fetcher, 'https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  }))
  if (!body.id || !body.email) throw new ProviderError('invalid_response', 'Google did not provide an account identity. Reconnect your calendar.')
  return { id: String(body.id), email: String(body.email) }
}

export async function revokeGoogleCredentials(credentials: GoogleCredentials, fetcher: Fetcher = fetch): Promise<void> {
  const response = await safeFetch(fetcher, 'https://oauth2.googleapis.com/revoke', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: credentials.refreshToken || credentials.accessToken }),
  })
  // Already invalid tokens need no further revocation. Local credentials must still be erased.
  if (!response.ok && response.status !== 400) await jsonResponse(response)
}

async function request(credentials: GoogleCredentials, path: string, init: RequestInit = {}, fetcher: Fetcher = fetch) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${credentials.accessToken}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  return safeFetch(fetcher, `${API}${path}`, { ...init, headers })
}

export async function discoverGoogleCalendars(credentials: GoogleCredentials, fetcher: Fetcher = fetch): Promise<ProviderCalendar[]> {
  const calendars: ProviderCalendar[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ maxResults: '250' })
    if (pageToken) query.set('pageToken', pageToken)
    const data = await jsonResponse(await request(credentials, `/users/me/calendarList?${query}`, {}, fetcher))
    for (const item of data.items || []) {
      if (item.deleted || !item.id) continue
      // freeBusyReader cannot expose event details through the events endpoint.
      if (item.accessRole === 'freeBusyReader') continue
      calendars.push({ id: item.id, name: item.summaryOverride || item.summary || 'Google Calendar',
        timeZone: item.timeZone || 'UTC', color: item.backgroundColor,
        writable: ['owner', 'writer', 'writerWithoutPrivateAccess'].includes(item.accessRole),
        primary: Boolean(item.primary), metadata: { accessRole: item.accessRole } })
    }
    pageToken = data.nextPageToken
    if (!pageToken) return calendars
  }
  throw new ProviderError('temporary_failure', 'Your calendar list is too large to sync in one run.')
}

export function normalizeGoogleEvent(item: Record<string, any>, calendar: ProviderCalendar): ProviderEvent {
  return {
    id: item.id, uid: item.iCalUID, calendarId: calendar.id, etag: item.etag,
    title: item.summary || (item.status === 'cancelled' ? 'Cancelled event' : 'Busy'),
    description: item.description, location: item.location,
    start: item.start?.date || item.start?.dateTime || item.originalStartTime?.date || item.originalStartTime?.dateTime || '',
    end: item.end?.date || item.end?.dateTime || '',
    allDay: Boolean(item.start?.date || item.originalStartTime?.date),
    timeZone: item.start?.timeZone || item.end?.timeZone || calendar.timeZone,
    status: item.status === 'cancelled' ? 'cancelled' : item.status === 'tentative' ? 'tentative' : 'confirmed',
    busy: item.transparency !== 'transparent' && !(item.attendees || []).some((a: any) => a.self && a.responseStatus === 'declined'),
    recurrence: item.recurrence, recurringEventId: item.recurringEventId,
    originalStart: item.originalStartTime?.date || item.originalStartTime?.dateTime,
    reminders: item.reminders?.overrides?.filter((r: any) => ['popup', 'email'].includes(r.method)),
    updatedAt: item.updated, url: item.htmlLink,
    metadata: { editScope: item.recurrence ? 'series' : 'event', eventType: item.eventType || 'default',
      anastasisOperation: item.extendedProperties?.private?.anastasisOperation,
      anastasisUpdateOperation: item.extendedProperties?.private?.anastasisUpdateOperation,
      remindersUseDefault: item.reminders?.useDefault === true },
  }
}

/** Sync masters and exceptions; expand them only for the requested UI window after storage. */
export async function syncGoogleCalendar(credentials: GoogleCredentials, calendar: ProviderCalendar, _window: SyncWindow, syncToken?: string, fetcher: Fetcher = fetch): Promise<ProviderSyncResult> {
  const events: ProviderEvent[] = [], deletedIds: string[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ maxResults: '2500', singleEvents: 'false', showDeleted: 'true' })
    if (syncToken) query.set('syncToken', syncToken)
    if (pageToken) query.set('pageToken', pageToken)
    const response = await request(credentials, `/calendars/${encodeURIComponent(calendar.id)}/events?${query}`, {}, fetcher)
    if (response.status === 410 && syncToken) return syncGoogleCalendar(credentials, calendar, _window, undefined, fetcher)
    const data = await jsonResponse(response)
    for (const item of data.items || []) {
      if (!item.id) continue
      // Cancelled recurrence exceptions are retained to suppress the corresponding occurrence.
      if (item.status === 'cancelled' && !item.recurringEventId) deletedIds.push(item.id)
      else events.push(normalizeGoogleEvent(item, calendar))
    }
    pageToken = data.nextPageToken
    if (!pageToken) return { events, deletedIds, nextSyncToken: data.nextSyncToken, reset: !syncToken }
  }
  throw new ProviderError('temporary_failure', 'This calendar is too large to finish syncing in one run. Please retry.')
}

export function deterministicGoogleEventId(operationKey: string): string {
  // Hex is a subset of Google's allowed base32hex ID characters.
  return `ana${createHash('sha256').update(operationKey).digest('hex')}`
}

function eventBody(draft: EventDraft) {
  return {
    summary: draft.title, description: draft.description ?? '', location: draft.location ?? '',
    start: draft.allDay ? { date: draft.start } : { dateTime: draft.start, timeZone: draft.timeZone },
    end: draft.allDay ? { date: draft.end } : { dateTime: draft.end, timeZone: draft.timeZone },
    transparency: draft.busy === false ? 'transparent' : 'opaque',
    ...(draft.recurrence !== undefined ? { recurrence: draft.recurrence } : {}),
    ...(draft.useDefaultReminders ? { reminders: { useDefault: true } } : draft.reminders !== undefined ? { reminders: { useDefault: false, overrides: draft.reminders } } : {}),
  }
}

function assertWritable(calendar: ProviderCalendar) {
  if (!calendar.writable) throw new ProviderError('read_only', 'This calendar is read-only. Choose a writable calendar.')
}

export async function createGoogleEvent(credentials: GoogleCredentials, calendar: ProviderCalendar, draft: EventDraft, idempotencyKey: string, fetcher: Fetcher = fetch): Promise<ProviderEvent> {
  assertWritable(calendar)
  const id = deterministicGoogleEventId(idempotencyKey)
  const path = `/calendars/${encodeURIComponent(calendar.id)}/events`
  const response = await request(credentials, path, { method: 'POST', body: JSON.stringify({ ...eventBody(draft), id,
    extendedProperties: { private: { anastasisOperation: idempotencyKey } } }) }, fetcher)
  if (response.status === 409) {
    const existing = await jsonResponse(await request(credentials, `${path}/${id}`, {}, fetcher))
    if (existing.extendedProperties?.private?.anastasisOperation !== idempotencyKey) {
      throw new ProviderError('conflict', 'The event identifier is already in use. Refresh before retrying.')
    }
    return normalizeGoogleEvent(existing, calendar)
  }
  return normalizeGoogleEvent(await jsonResponse(response), calendar)
}

export async function updateGoogleEvent(credentials: GoogleCredentials, calendar: ProviderCalendar, eventId: string, draft: EventDraft, etag: string, fetcher: Fetcher = fetch, operationKey?: string): Promise<ProviderEvent> {
  assertWritable(calendar)
  if (!etag) throw new ProviderError('conflict', 'Refresh this event before editing it.')
  const path = `/calendars/${encodeURIComponent(calendar.id)}/events/${encodeURIComponent(eventId)}`
  let body: Record<string, unknown> = eventBody(draft)
  if (operationKey) {
    const current = await jsonResponse(await request(credentials, path, {}, fetcher))
    // A provider-accepted earlier attempt can be reconciled even when local persistence failed.
    // Return the latest canonical copy; a later manual edit must never be overwritten by a retry.
    if (current.extendedProperties?.private?.anastasisUpdateOperation === operationKey) return normalizeGoogleEvent(current, calendar)
    if (current.etag !== etag) throw new ProviderError('conflict', 'This event changed in Google Calendar. Refresh and review the latest version.')
    body = { ...body, extendedProperties: { ...current.extendedProperties,
      private: { ...current.extendedProperties?.private, anastasisUpdateOperation: operationKey } } }
  }
  // PATCH preserves attendees, organizer fields, and provider-specific personal appointments.
  return normalizeGoogleEvent(await jsonResponse(await request(credentials,
    path, { method: 'PATCH', headers: { 'If-Match': etag }, body: JSON.stringify(body) }, fetcher)), calendar)
}

export async function deleteGoogleEvent(credentials: GoogleCredentials, calendar: ProviderCalendar, eventId: string, etag: string, fetcher: Fetcher = fetch): Promise<void> {
  assertWritable(calendar)
  if (!etag) throw new ProviderError('conflict', 'Refresh this event before deleting it.')
  const response = await request(credentials, `/calendars/${encodeURIComponent(calendar.id)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { 'If-Match': etag } }, fetcher)
  if (response.ok || response.status === 404 || response.status === 410) return
  await jsonResponse(response)
}
