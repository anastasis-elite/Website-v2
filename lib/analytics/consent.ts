export const ANALYTICS_CONSENT_STORAGE_KEY = 'anastasis:analytics-consent:v1'
export const ANALYTICS_JOURNEY_STORAGE_KEY = 'anastasis:analytics-anonymous:v1'
export const ANALYTICS_JOURNEY_OWNER_KEY = 'anastasis:analytics-journey-owner:v1'

export type AnalyticsConsentContext = {
  accepted: boolean
  revision: number
  clientId: string
  journeyId?: string
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isAnalyticsJourneyId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('anonymous_') && uuid.test(value.slice(10))
}

function storedContext(): AnalyticsConsentContext | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) || 'null')
    return raw && typeof raw.accepted === 'boolean' && Number.isSafeInteger(raw.revision) && raw.revision > 0 &&
      typeof raw.clientId === 'string' && uuid.test(raw.clientId)
      ? { accepted: raw.accepted, revision: raw.revision, clientId: raw.clientId } : null
  } catch { return null }
}

function nextRevision(previous = 0) {
  const next = Math.max(Date.now() * 1000, previous + 1)
  return Number.isSafeInteger(next) && next > 0 ? next : null
}

/** A legacy accepted choice cannot override a newer stored withdrawal. */
export function hasStoredAnalyticsConsent() {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem('cookie_consent') === 'accepted' && storedContext()?.accepted !== false } catch { return false }
}

export function getCurrentJourneyId(): string | undefined {
  if (!hasStoredAnalyticsConsent()) return undefined
  try {
    const current = window.localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY)
    if (isAnalyticsJourneyId(current)) return current
    const journey = `anonymous_${crypto.randomUUID()}`
    window.localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, journey)
    return journey
  } catch { return undefined }
}

export function writeAnalyticsContextCookie(context: AnalyticsConsentContext | null) {
  if (!context || typeof document === 'undefined') return
  const suffix = `; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  document.cookie = `analytics_consent=${context.accepted ? 'accepted' : 'declined'}${suffix}`
  document.cookie = `analytics_context=${encodeURIComponent(JSON.stringify(context))}${suffix}`
}

/** Startup reposts retain the revision assigned to the original choice. */
export function readAnalyticsConsentContext(): AnalyticsConsentContext | null {
  if (typeof window === 'undefined') return null
  try {
    const choice = window.localStorage.getItem('cookie_consent')
    if (choice !== 'accepted' && choice !== 'declined') return null
    let context = storedContext()
    if (!context) {
      const revision = nextRevision()
      if (!revision) return null
      context = { accepted: choice === 'accepted', revision, clientId: crypto.randomUUID() }
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, JSON.stringify(context))
    } else if (choice === 'declined' && context.accepted) {
      const revision = nextRevision(context.revision)
      if (!revision) return null
      context = { accepted: false, revision, clientId: context.clientId }
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, JSON.stringify(context))
    }
    const journeyId = context.accepted ? getCurrentJourneyId() : undefined
    return { ...context, ...(journeyId ? { journeyId } : {}) }
  } catch { return null }
}

export function storeAnalyticsConsent(choice: 'accepted' | 'declined'): AnalyticsConsentContext | null {
  if (typeof window === 'undefined') return null
  try {
    // Withdrawal takes effect before storage, network or SDK work can run.
    if (choice === 'declined') window.localStorage.setItem('cookie_consent', 'declined')
    const previous = storedContext()
    const revision = nextRevision(previous?.revision)
    if (!revision) return null
    const context = { accepted: choice === 'accepted', revision, clientId: previous?.clientId || crypto.randomUUID() }
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, JSON.stringify(context))
    window.localStorage.setItem('cookie_consent', choice)
    const result = readAnalyticsConsentContext()
    writeAnalyticsContextCookie(result)
    return result
  } catch { return null }
}

/** A new account journey must not inherit another account's browser bridge. */
export function resetAnalyticsJourney(rotateClient: boolean) {
  if (typeof window === 'undefined') return
  try {
    const previous = storedContext()
    window.localStorage.removeItem(ANALYTICS_JOURNEY_STORAGE_KEY)
    window.localStorage.removeItem(ANALYTICS_JOURNEY_OWNER_KEY)
    if (rotateClient && previous) {
      const revision = nextRevision(previous.revision)
      if (!revision) return
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, JSON.stringify({ ...previous, revision, clientId: crypto.randomUUID() }))
    }
    writeAnalyticsContextCookie(readAnalyticsConsentContext())
  } catch { /* Identity separation remains fail-closed when storage is restricted. */ }
}
