import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillPurchase, reconcileSubscription, syncSubscription } from '@/lib/commerce/fulfillment'
import { paymentEnvironmentError } from '@/lib/commerce/environment'
import { deliverPurchaseInvitation } from '@/lib/commerce/invitationDelivery'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const environmentError = paymentEnvironmentError()
  if (environmentError || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: environmentError || 'Stripe webhook is not configured.' }, { status: 503 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 })
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET!) }
  catch { return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 }) }
  if (event.livemode !== /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY!)) return NextResponse.json({ error: 'Payment environment mismatch.' }, { status: 400 })
  try {
    const supabase = createAdminClient()
    const { data: existing, error: readError } = await supabase.from('stripe_webhook_events').select('event_id').eq('event_id', event.id).maybeSingle()
    if (readError) throw readError
    const subscriptionId = subscriptionReference(event)
    if (existing) {
      // Another delivery of this same event may have latched a conflict after
      // the first delivery recorded success. A processed event must not hide
      // that durable pending state from its failed delivery's retry.
      if (subscriptionId) await reconcileSubscription({ stripe, supabase, subscriptionId })
      return NextResponse.json({ received: true, duplicate: true })
    }
    let clientId: string | null = null
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      // An earlier unpaid completion must not become success evidence merely
      // because a later retrieval is paid. Async payment uses its own success event.
      if (session.mode === 'payment' ? session.payment_status === 'paid' : session.payment_status !== 'unpaid') {
        const purchase = await fulfillPurchase({ stripe, supabase, sessionId: session.id, successEvent: event })
        clientId = purchase.clientId
        if (!purchase.authUserId) await deliverPurchaseInvitation({ supabase, sessionId: session.id, origin: process.env.NEXT_PUBLIC_APP_URL || 'https://www.anastasiselite.com' })
      }
    } else {
      if (subscriptionId) {
        const sync = await syncSubscription({ stripe, supabase, subscriptionId, eventCreated: event.created })
        if (sync?.conflict === true || sync?.retry === true) throw new Error('Subscription reconciliation requires a retry.')
      }
    }
    const { error } = await supabase.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type, client_id: clientId, payload: { livemode: event.livemode } })
    if (error && error.code !== '23505') throw error
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook processing failed', { event: event.id, type: event.type, message: error instanceof Error ? error.message : 'database failure' })
    return NextResponse.json({ error: 'Webhook processing failed. Retry required.' }, { status: 500 })
  }
}

function subscriptionReference(event: Stripe.Event): string | null {
  if (event.type.startsWith('customer.subscription.')) return (event.data.object as Stripe.Subscription).id
  if (['invoice.payment_succeeded', 'invoice.payment_failed'].includes(event.type)) {
    const invoice = event.data.object as Stripe.Invoice & { parent?: { subscription_details?: { subscription?: string | { id: string } } } }
    const reference = invoice.subscription || invoice.parent?.subscription_details?.subscription
    return typeof reference === 'string' ? reference : reference?.id || null
  }
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const reference = (event.data.object as Stripe.Checkout.Session).subscription
    return typeof reference === 'string' ? reference : reference?.id || null
  }
  return null
}
