import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fulfillPurchase } from '@/lib/commerce/fulfillment'
import { paymentEnvironmentError } from '@/lib/commerce/environment'

// Compatibility for older callers; always reload the real Stripe session and
// use the transactional purchase ledger rather than trusting a supplied object.
export async function fulfillCheckoutSession({ supabase, session }: { supabase: SupabaseClient; session: Stripe.Checkout.Session }) {
  const error = paymentEnvironmentError()
  if (error) throw new Error(error)
  return fulfillPurchase({ stripe: new Stripe(process.env.STRIPE_SECRET_KEY!), supabase, sessionId: session.id })
}
