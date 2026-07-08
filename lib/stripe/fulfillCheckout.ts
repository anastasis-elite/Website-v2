import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

const programs = new Set(['ember', 'ignite', 'phoenix'])

function normalizeProgram(value: unknown) {
  const program = String(value || '').toLowerCase()
  return programs.has(program) ? program : null
}

export async function fulfillCheckoutSession({
  supabase,
  session,
}: {
  supabase: SupabaseClient
  session: Stripe.Checkout.Session
}) {
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) {
    throw new Error('Payment has not completed.')
  }
  const program = normalizeProgram(session.metadata?.program)
  const email = String(session.customer_details?.email || session.customer_email || session.metadata?.email || '').trim().toLowerCase()
  if (!program) throw new Error('The purchase is missing a valid program tier.')
  if (!email) throw new Error('The purchase is missing an email address.')

  const metadataClientId = String(session.metadata?.client_id || '').trim()
  let client: any = null
  if (metadataClientId) {
    const { data } = await supabase.from('clients').select('*').eq('client_id', metadataClientId).maybeSingle()
    client = data
  }
  if (!client) {
    const { data } = await supabase.from('clients').select('*').eq('email', email).eq('program', program).order('created_at', { ascending: false }).limit(1).maybeSingle()
    client = data
  }
  const now = new Date()
  const endsAt = new Date(now)
  endsAt.setMonth(endsAt.getMonth() + (session.mode === 'subscription' ? 1 : 12))
  const clientId = client?.client_id || `AN-${crypto.randomUUID()}`
  const clientValues = {
    email,
    full_name: client?.full_name || session.customer_details?.name || session.metadata?.fullName || null,
    program,
    subscription_status: session.mode === 'subscription' ? 'active' : 'paid_annual',
    verified_purchase: true,
    access: true,
    active: true,
    subscription_started_at: now.toISOString(),
    subscription_ends_at: endsAt.toISOString(),
    updated_at: now.toISOString(),
  }
  if (client) {
    const { error } = await supabase.from('clients').update(clientValues).eq('client_id', clientId)
    if (error) throw new Error(`Unable to activate client: ${error.message}`)
  } else {
    const { error } = await supabase.from('clients').insert({ client_id: clientId, auth_user_id: null, login_email: null, onboarding_completed: false, ...clientValues })
    if (error) throw new Error(`Unable to create client: ${error.message}`)
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null
  const { error: billingError } = await supabase.from('client_billing').upsert({
    client_id: clientId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    billing_type: session.mode,
    billing_status: 'active',
    current_period_start: now.toISOString(),
    current_period_end: endsAt.toISOString(),
    last_payment_date: now.toISOString(),
    next_payment_date: session.mode === 'subscription' ? endsAt.toISOString() : null,
    access_active: true,
    updated_at: now.toISOString(),
  }, { onConflict: 'client_id' })
  if (billingError) throw new Error(`Unable to record billing: ${billingError.message}`)
  return { clientId, email, program, authUserId: client?.auth_user_id || null }
}
