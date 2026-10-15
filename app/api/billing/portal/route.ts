import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { paymentEnvironmentError } from '@/lib/commerce/environment'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to manage billing.' }, { status: 401 })
    const { data: client, error: clientError } = await supabase.from('clients').select('client_id').eq('auth_user_id', user.id).maybeSingle()
    if (clientError || !client) return NextResponse.json({ error: 'Your member profile could not be found.' }, { status: 404 })
    const { data: billing, error } = await supabase.from('client_billing').select('stripe_customer_id,billing_type').eq('client_id', client.client_id).maybeSingle()
    if (error) return NextResponse.json({ error: 'Billing details are temporarily unavailable.' }, { status: 503 })
    if (!billing?.stripe_customer_id) return NextResponse.json({ error: 'There is no Stripe billing account for this membership. Contact support for gifted access or billing questions.' }, { status: 409 })
    const environmentError = paymentEnvironmentError()
    if (environmentError) return NextResponse.json({ error: environmentError }, { status: 503 })
    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const portal = await stripe.billingPortal.sessions.create({ customer: billing.stripe_customer_id, return_url: origin + '/dashboard/account#billing' })
    return NextResponse.json({ url: portal.url })
  } catch {
    return NextResponse.json({ error: 'Billing management is not available right now. Contact support to request billing help or cancellation.' }, { status: 503 })
  }
}
