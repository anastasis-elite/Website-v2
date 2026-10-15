import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillPurchase, syncSubscription } from '@/lib/commerce/fulfillment'
import { paymentEnvironmentError } from '@/lib/commerce/environment'

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
    if (existing) return NextResponse.json({ received: true, duplicate: true })
    let clientId: string | null = null
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_status !== 'unpaid') clientId = (await fulfillPurchase({ stripe, supabase, sessionId: session.id })).clientId
    } else {
      let subscriptionId: string | null = null
      if (event.type.startsWith('customer.subscription.')) subscriptionId = (event.data.object as Stripe.Subscription).id
      if (['invoice.payment_succeeded', 'invoice.payment_failed'].includes(event.type)) {
        const invoice = event.data.object as Stripe.Invoice
        const compatibleInvoice = invoice as Stripe.Invoice & { parent?: { subscription_details?: { subscription?: string | { id: string } } } }
        const reference = invoice.subscription || compatibleInvoice.parent?.subscription_details?.subscription
        subscriptionId = typeof reference === 'string' ? reference : reference?.id || null
      }
      if (subscriptionId) await syncSubscription({ stripe, supabase, subscriptionId, eventCreated: event.created })
    }
    const { error } = await supabase.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type, client_id: clientId, payload: { livemode: event.livemode } })
    if (error && error.code !== '23505') throw error
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook processing failed', { event: event.id, type: event.type, message: error instanceof Error ? error.message : 'database failure' })
    return NextResponse.json({ error: 'Webhook processing failed. Retry required.' }, { status: 500 })
  }
}
