import 'server-only'
import { createHash } from 'node:crypto'
import { analyticsEnvironment, filterAnalyticsEvent } from './privacy'

export type ServerConversionEvent = 'subscription_activated' | 'subscription_upgraded' | 'subscription_cancelled' | 'onboarding_completed' | 'first_workout_completed' | 'first_nutrition_completed' | 'first_recovery_completed'
type Conversion = { userId: string; event: ServerConversionEvent; key?: string; properties?: Record<string, unknown> }
type DeliveryOptions = { userId?: string; transport?: typeof fetch; allowTest?: boolean }
const testing = () => process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT)

/** Drain only transaction-created receipts. Calling this never creates a conversion. */
export async function recordConversion(supabase: any, conversion: Conversion): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== conversion.userId) return false
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || testing()) return false
    const { createAdminClient } = await import('@/lib/supabase/admin')
    return await deliverPendingConversions(createAdminClient(), { userId: user.id })
  } catch { return false }
}

/** One bounded delivery batch; durable leases plus $insert_id make retries safe. */
export async function deliverPendingConversions(supabase: any, options: DeliveryOptions = {}): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || testing() && !(options.allowTest && options.transport)) return false
  try {
    const { data: rows, error } = await supabase.rpc('claim_analytics_conversions', { p_user_id: options.userId || null, p_limit: 10 })
    if (error || !Array.isArray(rows) || !rows.length) return false
    const sentIds: string[] = []
    const batch = rows.flatMap(row => {
      const safe = filterAnalyticsEvent(row.event, row.properties, analyticsEnvironment())
      if (!safe || typeof row.id !== 'string' || typeof row.distinct_id !== 'string') return []
      sentIds.push(row.id)
      const distinctId = row.distinct_id
      return [{ uuid: row.id, event: safe.event, timestamp: row.occurred_at, distinct_id: distinctId, properties: {
        ...safe.properties,
        distinct_id: distinctId,
        ...(/^anonymous_[0-9a-f-]{36}$/.test(row.journey_id || '') ? { journey_id: row.journey_id } : {}),
        ...(typeof row.user_id === 'string' ? { member_id: 'member_' + createHash('sha256').update(`anastasis-analytics-v1:${row.user_id.toLowerCase()}`).digest('hex') } : {}),
        $insert_id: row.id,
        $process_person_profile: false,
        $geoip_disable: true,
      } }]
    })
    if (!batch.length) return false
    const { data: stillAllowed, error: consentError } = await supabase.rpc('validate_analytics_delivery', { p_ids: sentIds, p_token: rows[0].claim_token })
    if (consentError || !Array.isArray(stillAllowed)) return false
    const validIds = new Set(stillAllowed)
    const sendBatch = batch.filter(event => validIds.has(event.uuid))
    if (!sendBatch.length) return false
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
    const url = new URL('/batch/', host)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const response = await (options.transport || fetch)(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: key, batch: sendBatch }), signal: AbortSignal.timeout(5000) })
    if (!response.ok) return false
    const { error: ackError } = await supabase.rpc('ack_analytics_conversions', { p_ids: sendBatch.map(event => event.uuid), p_token: rows[0].claim_token })
    return !ackError
  } catch { return false }
}
