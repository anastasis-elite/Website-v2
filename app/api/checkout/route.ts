import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPrice, parseBilling, parseProgram } from '@/lib/commerce/catalog'
import { paymentEnvironmentError } from '@/lib/commerce/environment'
import { createPurchaseProof, hashPurchaseProof, purchaseCookieName } from '@/lib/commerce/purchaseProof'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const environmentError = paymentEnvironmentError()
    if (environmentError) return NextResponse.json({ error: environmentError }, { status: 503 })
    if (!process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: 'Payment activation is not configured. Please contact support.' }, { status: 503 })
    const { data: ready, error: readinessError } = await createAdminClient().rpc('commerce_configuration_ready')
    if (readinessError || ready !== true) return NextResponse.json({ error: 'Payment activation needs administrator setup before checkout.' }, { status: 503 })
    const body = await req.json().catch(() => null)
    const program = parseProgram(body?.program), billing = parseBilling(body?.billing)
    if (!program || !billing) return NextResponse.json({ error: 'Choose a valid program and payment option.' }, { status: 400 })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const { price, details } = await getPrice(stripe, program, billing)
    if (!details.available) return NextResponse.json({ error: details.coverageLabel || details.error }, { status: 503 })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && !process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Secure login email delivery needs administrator setup before checkout.' }, { status: 503 })
    let clientId = '', customerId = ''
    if (user) {
      const { data: client, error } = await supabase.from('clients').select('client_id').eq('auth_user_id', user.id).maybeSingle()
      if (error) throw error
      clientId = client?.client_id || ''
      if (clientId) {
        const { data: existingBilling, error: billingError } = await supabase.from('client_billing').select('stripe_customer_id,stripe_subscription_id').eq('client_id', clientId).maybeSingle()
        if (billingError) throw billingError
        customerId = existingBilling?.stripe_customer_id || ''
        if (existingBilling?.stripe_subscription_id) {
          const subscription = await stripe.subscriptions.retrieve(existingBilling.stripe_subscription_id)
          if (!['canceled', 'incomplete_expired'].includes(subscription.status)) {
            return NextResponse.json({ error: 'Your account already has a recurring subscription. Manage billing in your account or contact support before purchasing another plan.', accountUrl: '/dashboard/account' }, { status: 409 })
          }
        }
      }
    }
    if (body.client_id && body.client_id !== clientId) return NextResponse.json({ error: 'This client reference does not belong to your login.' }, { status: 403 })
    const email = user?.email || (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    const proof = createPurchaseProof()
    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '')
    const metadata = {
      program, billing, client_id: clientId, auth_user_id: user?.id || '',
      purchase_proof_hash: hashPurchaseProof(proof), price_id: price.id,
      access_months: String(details.accessMonths || ''),
      fullName: typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 150) : '',
      referral_code: typeof body.referralCode === 'string' ? body.referralCode.trim().slice(0, 80) : '',
    }
    const session = await stripe.checkout.sessions.create({
      mode: billing === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      customer: customerId || undefined,
      customer_email: customerId ? undefined : email || undefined,
      customer_creation: billing === 'annual' && !customerId ? 'always' : undefined,
      client_reference_id: clientId || undefined,
      success_url: origin + '/verified?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/program/' + program + '/cart?checkout=canceled',
      metadata,
      subscription_data: billing === 'subscription' ? { metadata: { program, client_id: clientId, auth_user_id: user?.id || '' } } : undefined,
      payment_intent_data: billing === 'annual' ? { metadata: { program, billing } } : undefined,
    })
    const response = NextResponse.json({ url: session.url })
    response.cookies.set(purchaseCookieName(session.id), proof, { httpOnly: true, secure: new URL(req.url).protocol === 'https:', sameSite: 'lax', path: '/verified', maxAge: 7 * 86400 })
    return response
  } catch (error) {
    console.error('Checkout creation failed', { message: error instanceof Error ? error.message : 'unknown' })
    return NextResponse.json({ error: 'Unable to start checkout. Please contact support.' }, { status: 500 })
  }
}
