import 'server-only'

export type CheckoutAnalyticsContext = { accepted: boolean; revision: number; clientId: string; journeyId?: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validateAnalyticsContext(value: unknown): CheckoutAnalyticsContext | null {
  if (!value || typeof value !== 'object') return null
  const context = value as Record<string, unknown>
  if (typeof context.accepted !== 'boolean' || !Number.isSafeInteger(context.revision) || Number(context.revision) < 1 || typeof context.clientId !== 'string' || !uuid.test(context.clientId)) return null
  if (context.accepted && (typeof context.journeyId !== 'string' || !/^anonymous_[0-9a-f-]{36}$/i.test(context.journeyId) || !uuid.test(context.journeyId.slice(10)))) return null
  return { accepted: context.accepted, revision: Number(context.revision), clientId: context.clientId.toLowerCase(), ...(context.accepted ? { journeyId: String(context.journeyId).toLowerCase() } : {}) }
}
export function analyticsContextFromRequest(request: Request): CheckoutAnalyticsContext | null {
  const raw = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('analytics_context='))?.slice('analytics_context='.length)
  if (!raw || raw.length > 2000) return null
  try { return validateAnalyticsContext(JSON.parse(decodeURIComponent(raw))) } catch { return null }
}
export async function persistAnalyticsContext(admin: any, context: CheckoutAnalyticsContext, userId?: string) {
  return admin.rpc('record_analytics_consent_v2', { p_user_id: userId || null, p_accepted: context.accepted, p_revision: context.revision, p_client_id: context.clientId, p_journey_id: context.journeyId || null })
}
export async function saveCheckoutAnalytics(admin: any, request: Request, sessionId: string, userId?: string): Promise<void> {
  try {
    const context = analyticsContextFromRequest(request)
    if (!context) return
    const stored = await persistAnalyticsContext(admin, context, userId)
    if (stored.error || stored.data !== true) return
    await admin.rpc('save_checkout_analytics_context', { p_session_id: sessionId, p_client_id: context.clientId, p_revision: context.revision, p_journey_id: context.journeyId || null, p_accepted: context.accepted })
  } catch { /* Optional telemetry cannot delay payment or change access. */ }
}
export async function bindAnalyticsOwner(admin: any, request: Request, userId: string): Promise<void> {
  try {
    const context = analyticsContextFromRequest(request)
    if (context) await persistAnalyticsContext(admin, context, userId)
  } catch { /* Binding remains safe when optional analytics is unavailable. */ }
}
