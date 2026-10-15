import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { configuredPriceId, getPrice, parseBilling, parseProgram } from '@/lib/commerce/catalog'

function stripeId(value: unknown): string | null {
  return typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : null
}

export function subscriptionState(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0] as Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }
  const current = subscription as Stripe.Subscription & { current_period_start?: number; current_period_end?: number }
  const start = current.current_period_start || firstItem?.current_period_start
  const end = current.current_period_end || firstItem?.current_period_end
  if (!start || !end) throw new Error('Stripe has not supplied a subscription access period.')
  return { status: subscription.status, access: ['active', 'trialing'].includes(subscription.status), start: new Date(start * 1000).toISOString(), end: new Date(end * 1000).toISOString(), cancelAtPeriodEnd: subscription.cancel_at_period_end }
}

export async function fulfillPurchase({ stripe, supabase, sessionId }: { stripe: Stripe; supabase: SupabaseClient; sessionId: string }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items.data.price.product', 'subscription'] })
  if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) throw new Error('Payment has not completed.')
  const liveKey = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '')
  if (session.livemode !== liveKey) throw new Error('The purchase belongs to a different payment environment.')
  const program = parseProgram(session.metadata?.program), billing = parseBilling(session.metadata?.billing)
  if (!program || !billing) throw new Error('The purchase is missing a valid program and payment option.')
  const items = session.line_items?.data || []
  const actualPrice = items[0]?.price
  const confirmedSnapshot = Boolean(session.metadata?.price_id && /^[a-f0-9]{64}$/.test(session.metadata?.purchase_proof_hash || ''))
  const expectedPrice = confirmedSnapshot ? session.metadata!.price_id : configuredPriceId(program, billing)
  if (items.length !== 1 || items[0].quantity !== 1 || actualPrice?.id !== expectedPrice) throw new Error('The purchased price does not match the configured program.')
  let accessMonths: number | null = null
  if (billing === 'annual') {
    const rawMonths = session.metadata?.access_months || ''
    const months = /^[1-9]\d*$/.test(rawMonths) ? Number(rawMonths) : NaN
    if (!confirmedSnapshot || !Number.isSafeInteger(months) || months > 120) throw new Error('The purchased access period needs confirmation. Contact support with your receipt.')
    accessMonths = months
  } else if (!confirmedSnapshot) {
    // Legacy monthly purchases have Stripe subscription periods. Legacy
    // one-time purchases lack a confirmed duration and require support.
    const { details } = await getPrice(stripe, program, billing)
    if (!details.available) throw new Error('The billing interval for this purchase needs confirmation.')
  }
  const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase()
  if (!email) throw new Error('The purchase is missing its email address.')
  const subscriptionId = stripeId(session.subscription)
  let start = new Date(session.created * 1000).toISOString(), end: string, access = true, status = 'paid_in_full', cancelAtPeriodEnd = false
  if (billing === 'subscription') {
    if (session.mode !== 'subscription' || !subscriptionId) throw new Error('The purchase is missing its subscription.')
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const state = subscriptionState(subscription)
    start = state.start; end = state.end; access = state.access; status = state.status; cancelAtPeriodEnd = state.cancelAtPeriodEnd
  } else {
    if (session.mode !== 'payment' || !accessMonths) throw new Error('The pay-in-full purchase period is not configured.')
    const paidAt = new Date(session.created * 1000), expiry = new Date(paidAt)
    // Calendar months are explicit Stripe product/price metadata, not an annual
    // assumption. Clamp end-of-month purchases to the final day of that month.
    const day = expiry.getUTCDate(); expiry.setUTCDate(1); expiry.setUTCMonth(expiry.getUTCMonth() + accessMonths)
    expiry.setUTCDate(Math.min(day, new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate()))
    end = expiry.toISOString()
  }
  const { data, error } = await supabase.rpc('fulfill_checkout_purchase', { p_purchase: {
    session_id: session.id, program, email, full_name: session.customer_details?.name || session.metadata?.fullName || null,
    bound_client_id: session.metadata?.client_id || null, bound_user_id: session.metadata?.auth_user_id || null,
    customer_id: stripeId(session.customer), subscription_id: subscriptionId,
    billing_type: session.mode, billing_status: status, access_active: access,
    period_start: start, period_end: end, cancel_at_period_end: cancelAtPeriodEnd,
    purchased_at: new Date(session.created * 1000).toISOString(), livemode: session.livemode,
  } })
  if (error || !data) throw new Error('The purchase could not be safely activated. Contact support with your receipt.')
  return { session, clientId: String(data.client_id), email: String(data.email), program: String(data.program), authUserId: data.auth_user_id as string | null, replayed: Boolean(data.replayed) }
}

export async function syncSubscription({ stripe, supabase, subscriptionId, eventCreated }: { stripe: Stripe; supabase: SupabaseClient; subscriptionId: string; eventCreated: number }) {
  // Read Stripe's current state, so an old successful invoice cannot resurrect
  // a canceled subscription when webhooks are delivered out of order.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const state = subscriptionState(subscription)
  const { error } = await supabase.rpc('sync_member_subscription', { p_subscription_id: subscriptionId, p_state: { ...state, event_created: eventCreated } })
  if (error) throw new Error('Unable to update subscription access. Stripe should retry this event.')
}
