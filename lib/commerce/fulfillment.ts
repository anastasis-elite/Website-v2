import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { annualProgramForPrice, configuredPriceId, getPrice, parseBilling, parseProgram, subscriptionProgramForPrice } from '@/lib/commerce/catalog'

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

function validateAnnualPayment(session: Stripe.Checkout.Session, liveMode: boolean) {
  const intent = session.payment_intent && typeof session.payment_intent === 'object' ? session.payment_intent : null
  const charge = intent?.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null
  const amount = session.amount_total
  if (!intent || !charge || !intent.id || !charge.id || intent.status !== 'succeeded' || charge.status !== 'succeeded' ||
    intent.livemode !== liveMode || charge.livemode !== liveMode || charge.paid !== true || charge.captured !== true ||
    stripeId(charge.payment_intent) !== intent.id || stripeId(intent.customer) !== stripeId(session.customer) ||
    stripeId(charge.customer) !== stripeId(session.customer) || !Number.isSafeInteger(amount) || amount === null || amount <= 0 ||
    intent.amount_received !== amount || charge.amount_captured !== amount || typeof session.currency !== 'string' ||
    !/^[a-z]{3}$/.test(session.currency) || intent.currency !== session.currency || charge.currency !== session.currency) throw new Error('The original paid annual receipt could not be confirmed.')
  // This is an initial grant only. Persisted receipts return before this check;
  // their history is not rewritten when a refund is subsequently recorded.
  if (charge.refunded !== false || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 ||
    charge.amount_refunded >= charge.amount_captured) throw new Error('A fully refunded or unconfirmed annual payment cannot activate a new membership.')
  // Partial refunds keep the existing access calculation. They never create an
  // additional term or an extension; a partial-refund policy is not inferred here.
}

function annualSuccessTime(event: Stripe.Event, session: Stripe.Checkout.Session, liveMode: boolean): number | null {
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) ||
    !/^evt_[a-zA-Z0-9]+$/.test(event.id) || event.livemode !== liveMode || !Number.isSafeInteger(event.created) || event.created <= 0 ||
    !Number.isSafeInteger(session.created) || event.created < session.created || !Number.isFinite(new Date(event.created * 1000).getTime())) return null
  const snapshot = event.data.object as Stripe.Checkout.Session
  if (snapshot.id !== session.id || snapshot.mode !== 'payment' || snapshot.status !== 'complete' || snapshot.payment_status !== 'paid' ||
    snapshot.livemode !== liveMode || snapshot.subscription || stripeId(snapshot.payment_intent) !== stripeId(session.payment_intent) ||
    stripeId(snapshot.customer) !== stripeId(session.customer) || snapshot.amount_total !== session.amount_total || snapshot.currency !== session.currency) return null
  return event.created
}

async function annualPaidAt(stripe: Stripe, session: Stripe.Checkout.Session, liveMode: boolean, successEvent?: Stripe.Event) {
  const pending = () => new Error('The original annual payment confirmation is pending. Retry after the payment webhook arrives, or contact support with your receipt.')
  if (successEvent) {
    const time = annualSuccessTime(successEvent, session, liveMode)
    if (time === null) throw pending()
    return new Date(time * 1000)
  }
  // The authenticated return route may beat delivery of the signed webhook.
  // Recover the same immutable success event through Stripe, never Charge.created
  // or processing time. Stripe only retains retrievable events for thirty days.
  // Bound this fallback; missing/ambiguous/older evidence stays pending for support.
  let events: Stripe.Event[]
  try {
    events = await stripe.events.list({
      types: ['checkout.session.completed', 'checkout.session.async_payment_succeeded'],
      created: { gte: Math.max(session.created, Math.floor(Date.now() / 1000) - 30 * 86_400) }, limit: 100,
    }).autoPagingToArray({ limit: 201 })
  } catch { throw pending() }
  if (events.length >= 201) throw pending()
  const times = new Set(events.map(event => annualSuccessTime(event, session, liveMode)).filter((time): time is number => time !== null))
  if (times.size !== 1) throw pending()
  return new Date([...times][0] * 1000)
}

export async function fulfillPurchase({ stripe, supabase, sessionId, successEvent }: { stripe: Stripe; supabase: SupabaseClient; sessionId: string; successEvent?: Stripe.Event }) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items.data.price.product', 'subscription', 'payment_intent.latest_charge'] })
  if (session.id !== sessionId || session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) throw new Error('Payment has not completed.')
  const liveKey = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '')
  if (session.livemode !== liveKey) throw new Error('The purchase belongs to a different payment environment.')
  const items = session.line_items?.data || []
  const actualPrice = items[0]?.price
  if (items.length !== 1 || items[0].quantity !== 1 || !actualPrice) throw new Error('The purchased price does not match the configured program.')
  const confirmedSnapshot = Boolean(session.metadata?.price_id && /^[a-f0-9]{64}$/.test(session.metadata?.purchase_proof_hash || ''))
  let program = parseProgram(session.metadata?.program), billing = parseBilling(session.metadata?.billing)
  if (session.mode === 'payment') {
    const approvedProgram = annualProgramForPrice(actualPrice.id)
    if (!approvedProgram || session.payment_status !== 'paid' || session.subscription ||
      (session.metadata?.program && program !== approvedProgram) ||
      (session.metadata?.billing && billing !== 'annual') ||
      (session.metadata?.price_id && session.metadata.price_id !== actualPrice.id)) throw new Error('The paid annual price or program could not be confirmed.')
    const configured = await getPrice(stripe, approvedProgram, 'annual')
    if (!configured.details.available || configured.details.accessMonths !== 12 || configured.details.mode !== 'payment' ||
      actualPrice.type !== 'one_time' || actualPrice.recurring !== null || actualPrice.livemode !== liveKey ||
      configured.price.livemode !== liveKey || stripeId(actualPrice.product) !== stripeId(configured.price.product)) throw new Error('The configured annual payment option could not be confirmed.')
    program = approvedProgram; billing = 'annual'
  } else {
    if (!program || billing !== 'subscription') throw new Error('The purchase is missing a valid program and payment option.')
    const expectedPrice = confirmedSnapshot ? session.metadata!.price_id : configuredPriceId(program, billing)
    if (actualPrice.id !== expectedPrice) throw new Error('The purchased price does not match the configured program.')
    if (!confirmedSnapshot) {
      const { details } = await getPrice(stripe, program, billing)
      if (!details.available) throw new Error('The billing interval for this purchase needs confirmation.')
    }
  }
  const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase()
  if (!email) throw new Error('The purchase is missing its email address.')
  if (billing === 'annual') {
    const { data: stored, error } = await supabase.from('checkout_purchases').select('client_id,email,program,livemode,purchased_at').eq('session_id', session.id).maybeSingle()
    if (error) throw new Error('The saved annual receipt could not be confirmed. Please retry.')
    if (stored) {
      if (stored.program !== program || stored.livemode !== liveKey || stored.email !== email ||
        !stored.purchased_at || !Number.isFinite(new Date(stored.purchased_at).getTime())) throw new Error('The saved annual receipt does not match this purchase. Contact support.')
      const { data: profile, error: profileError } = await supabase.from('clients').select('client_id,program,auth_user_id').eq('client_id', stored.client_id).maybeSingle()
      if (profileError || !profile) throw new Error('The saved annual purchase owner could not be confirmed. Please retry.')
      // No membership write or date recomputation on replay. This also preserves
      // historical terms that predate recoverable provider events or later refunds.
      return { session, clientId: String(profile.client_id), email: String(stored.email), program: String(profile.program), authUserId: profile.auth_user_id as string | null, replayed: true }
    }
  }
  const subscriptionId = stripeId(session.subscription)
  let purchasedAt = new Date(session.created * 1000).toISOString()
  let start = purchasedAt, end: string, access = true, status = 'paid_in_full', cancelAtPeriodEnd = false
  let membershipStartedAt: string | null = null
  if (billing === 'subscription') {
    if (session.mode !== 'subscription' || !subscriptionId) throw new Error('The purchase is missing its subscription.')
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const state = subscriptionState(subscription)
    const currentProgram = resolveSubscriptionProgram(subscription)
    if (currentProgram !== program) throw new Error('The subscription price does not match the purchased program. Contact support with your receipt.')
    start = state.start; end = state.end; access = state.access; status = state.status; cancelAtPeriodEnd = state.cancelAtPeriodEnd
    // A recurring membership's original provider start is independent of its
    // current billing period. Missing legacy evidence leaves milestones unarmed.
    const providerStart = new Date(subscription.start_date * 1000)
    if (Number.isSafeInteger(subscription.start_date) && subscription.start_date > 0 && Number.isFinite(providerStart.getTime())) membershipStartedAt = providerStart.toISOString()
  } else {
    validateAnnualPayment(session, liveKey)
    const paidAt = await annualPaidAt(stripe, session, liveKey, successEvent), expiry = new Date(paidAt)
    start = purchasedAt = paidAt.toISOString()
    // Full-year access is approved server policy. Preserve the original paid
    // instant and clamp leap/end-of-month dates; retries never restart a year.
    const day = expiry.getUTCDate(); expiry.setUTCDate(1); expiry.setUTCMonth(expiry.getUTCMonth() + 12)
    expiry.setUTCDate(Math.min(day, new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate()))
    end = expiry.toISOString()
    access = expiry.getTime() > Date.now()
  }
  const { data, error } = await supabase.rpc('fulfill_checkout_purchase_v4', { p_purchase: {
    session_id: session.id, program, email, full_name: session.customer_details?.name || session.metadata?.fullName || null,
    // Legacy metadata is not proof of an existing account's ownership. Its paid
    // receipt enters the normal pending ledger and verified v4 claim path.
    bound_client_id: billing === 'annual' && !confirmedSnapshot ? null : session.metadata?.client_id || null,
    bound_user_id: billing === 'annual' && !confirmedSnapshot ? null : session.metadata?.auth_user_id || null,
    customer_id: stripeId(session.customer), subscription_id: subscriptionId, price_id: actualPrice.id,
    billing_type: session.mode, billing_status: status, access_active: access,
    period_start: start, period_end: end, cancel_at_period_end: cancelAtPeriodEnd,
    purchased_at: purchasedAt, livemode: session.livemode,
    membership_started_at: membershipStartedAt,
    membership_paid: session.payment_status === 'paid',
  } })
  if (error || !data) throw new Error('The purchase could not be safely activated. Contact support with your receipt.')
  return { session, clientId: String(data.client_id), email: String(data.email), program: String(data.program), authUserId: data.auth_user_id as string | null, replayed: Boolean(data.replayed) }
}

export async function syncSubscription({ stripe, supabase, subscriptionId, eventCreated }: { stripe: Stripe; supabase: SupabaseClient; subscriptionId: string; eventCreated: number }) {
  // Read Stripe's current state, so an old successful invoice cannot resurrect
  // a canceled subscription when webhooks are delivered out of order.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (subscription.id !== subscriptionId) throw new Error('Unable to confirm the subscription reference.')
  const { data, error } = await supabase.rpc('sync_member_subscription_v3', { p_subscription_id: subscriptionId, p_state: {
    ...mappedSubscriptionState(subscription), event_created: eventCreated,
  } })
  if (error) throw new Error('Unable to update subscription access. Stripe should retry this event.')
  if (data?.conflict === true || data?.accepted === false) return reconcileSubscription({ stripe, supabase, subscriptionId })
  if (data?.retry === true) throw new Error('Subscription reconciliation is pending. Stripe should retry this event.')
  return data
}

export async function reconcileSubscription({ stripe, supabase, subscriptionId }: { stripe: Stripe; supabase: SupabaseClient; subscriptionId: string }) {
  const { data: lease, error } = await supabase.rpc('claim_subscription_reconciliation', { p_subscription_id: subscriptionId })
  if (error || !lease || lease.retry === true) throw new Error('Subscription reconciliation is busy. Stripe should retry this event.')
  if (lease.reconciled === true) return lease
  if (typeof lease.lease_token !== 'string' || !Number.isSafeInteger(lease.revision) || lease.revision < 0) throw new Error('Subscription reconciliation needs administrator setup.')
  try {
    // This is a new read AFTER the lease/CAS revision was acquired. Never reuse
    // the pre-conflict snapshot or manufacture a later provider timestamp.
    const current = await stripe.subscriptions.retrieve(subscriptionId)
    if (current.id !== subscriptionId) throw new Error('Unable to confirm the current subscription reference.')
    const { data, error: commitError } = await supabase.rpc('reconcile_member_subscription', {
      p_subscription_id: subscriptionId, p_lease_token: lease.lease_token, p_expected_revision: lease.revision,
      p_state: mappedSubscriptionState(current),
    })
    if (commitError || data?.reconciled !== true || data?.retry === true) throw new Error('Subscription state changed during reconciliation. Stripe should retry this event.')
    return data
  } catch (caught) {
    // A failed release is bounded by the DB lease expiry. The webhook is not
    // acknowledged, so the same provider event remains eligible for retry.
    try { await supabase.rpc('release_subscription_reconciliation', { p_subscription_id: subscriptionId, p_lease_token: lease.lease_token }) } catch { /* Lease expiry fences an unavailable release. */ }
    throw caught
  }
}

function mappedSubscriptionState(subscription: Stripe.Subscription) {
  const state = subscriptionState(subscription)
  const program = resolveSubscriptionProgram(subscription)
  return { ...state, access: state.access && program !== null, program,
    price_id: subscription.items.data.length === 1 ? subscription.items.data[0].price.id : null }
}

function resolveSubscriptionProgram(subscription: Stripe.Subscription) {
  const items = subscription.items.data
  if (items.length !== 1 || items[0].quantity !== 1 || items[0].price.type !== 'recurring' ||
    items[0].price.recurring?.interval !== 'month' || items[0].price.recurring.interval_count !== 1) return null
  return subscriptionProgramForPrice(items[0].price.id)
}
