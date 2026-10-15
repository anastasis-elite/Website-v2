/** Server-only provider contracts. Credentials must never be returned to clients. */
export type CalendarProvider = 'google' | 'icloud'

export type ProviderCalendar = {
  id: string
  name: string
  timeZone: string
  color?: string
  writable: boolean
  primary?: boolean
  syncToken?: string
  metadata?: Record<string, unknown>
}

export type CalendarReminder = { method: 'popup' | 'email'; minutes: number }

export type EventDraft = {
  title: string
  description?: string
  location?: string
  /** RFC3339 instant for timed events; YYYY-MM-DD for all-day events. */
  start: string
  /** Exclusive end, including for all-day events. */
  end: string
  timeZone: string
  allDay: boolean
  busy?: boolean
  /** RFC5545 RRULE/EXDATE/RDATE lines, without DTSTART/DTEND. */
  recurrence?: string[]
  reminders?: CalendarReminder[]
  useDefaultReminders?: boolean
}

export type ProviderEvent = EventDraft & {
  id: string
  calendarId: string
  uid?: string
  etag?: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  busy: boolean
  recurringEventId?: string
  originalStart?: string
  updatedAt?: string
  url?: string
  metadata?: Record<string, unknown>
}

export type SyncWindow = { start: string; end: string }
export type ProviderSyncResult = {
  events: ProviderEvent[]
  deletedIds: string[]
  nextSyncToken?: string
  /** Replace the imported range / cached resource set after invalidation or full sync. */
  reset: boolean
}

export type GoogleCredentials = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope?: string
}

export type ICloudCredentials = {
  username: string
  appSpecificPassword: string
}

export type GoogleOAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export type ProviderErrorCode =
  | 'reconnect_required' | 'permission_denied' | 'read_only' | 'not_found'
  | 'conflict' | 'rate_limited' | 'temporary_failure' | 'invalid_response'
  | 'invalid_input' | 'sync_token_expired'

/** Intentionally contains no upstream response body (which may contain secrets/details). */
export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export type Fetcher = typeof fetch
