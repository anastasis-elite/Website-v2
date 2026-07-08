import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillCheckoutSession } from '@/lib/stripe/fulfillCheckout'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')
  if (!secretKey || !webhookSecret) return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 })
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 })
  const stripe = new Stripe(secretKey)
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('stripe_webhook_events').select('event_id').eq('event_id', event.id).maybeSingle()
  if (existing) return NextResponse.json({ received: true, duplicate: true })
  try {
    let clientId: string | null = null
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const fulfilled = await fulfillCheckoutSession({ supabase, session: event.data.object as Stripe.Checkout.Session })
      clientId = fulfilled.clientId
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const { data: billing } = await supabase.from('client_billing').select('client_id').eq('stripe_subscription_id', subscription.id).maybeSingle()
      await supabase.from('client_billing').update({ billing_status: 'canceled', access_active: false, updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subscription.id)
      if (billing?.client_id) await supabase.from('clients').update({ subscription_status: 'canceled', access: false, active: false, updated_at: new Date().toISOString() }).eq('client_id', billing.client_id)
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : (invoice as any).subscription?.id
      if (subscriptionId) {
        const { data: billing } = await supabase.from('client_billing').select('client_id').eq('stripe_subscription_id', subscriptionId).maybeSingle()
        await supabase.from('client_billing').update({ billing_status: 'active', access_active: true, last_payment_date: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subscriptionId)
        if (billing?.client_id) await supabase.from('clients').update({ subscription_status: 'active', access: true, active: true, updated_at: new Date().toISOString() }).eq('client_id', billing.client_id)
      }
    }
    await supabase.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type, client_id: clientId, payload: { livemode: event.livemode } })
    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, { status: 500 })
  }
}
