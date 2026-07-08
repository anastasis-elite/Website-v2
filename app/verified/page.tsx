import Link from 'next/link'
import Stripe from 'stripe'
import * as styles from '../styles/globalstyles'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillCheckoutSession } from '@/lib/stripe/fulfillCheckout'
import { createClientInvitation } from '@/lib/auth/clientInvitations'

export const dynamic = 'force-dynamic'

export default async function VerifiedPage({ searchParams }: { searchParams?: Promise<{ session_id?: string }> }) {
  const query = await searchParams
  const sessionId = String(query?.session_id || '')
  let result: { clientId: string; email: string; program: string; authUserId?: string | null } | null = null
  let createLoginHref = ''
  let errorMessage = ''
  if (!sessionId) {
    errorMessage = 'This confirmation is missing its secure purchase reference.'
  } else if (!process.env.STRIPE_SECRET_KEY) {
    errorMessage = 'Purchase verification is temporarily unavailable.'
  } else {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      result = await fulfillCheckoutSession({ supabase: createAdminClient(), session })
      if (!result.authUserId) {
        const invitation = await createClientInvitation({ supabase: createAdminClient(), clientId: result.clientId, email: result.email })
        createLoginHref = `/create-login?client_id=${encodeURIComponent(result.clientId)}&email=${encodeURIComponent(result.email)}&program=${encodeURIComponent(result.program)}&token=${encodeURIComponent(invitation.token)}`
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'This purchase could not be verified.'
    }
  }
  return <main style={styles.pageStyle}><div style={styles.containerStyle}>
    <p style={styles.eyebrowStyle}>Payment Verification</p>
    <h1 style={styles.heroTitleStyle}>{result ? 'You’re in.' : 'We could not open your account yet.'}</h1>
    {errorMessage ? <section style={styles.cartBoxStyle}><p style={styles.bodyStyle}>{errorMessage}</p><p style={styles.bodyStyle}>Contact support with your Stripe receipt so an administrator can connect the purchase safely.</p><a href="mailto:Anastasis.elite@gmail.com?subject=Purchase%20verification%20support" style={styles.secondaryButtonStyle}>Contact Support</a></section> : null}
    {result?.authUserId ? <section style={styles.cartBoxStyle}><p style={styles.bodyStyle}>Your purchase is active and your login is already connected.</p><Link href="/login" style={styles.primaryButtonStyle}>Sign In</Link></section> : null}
    {createLoginHref ? <section style={styles.cartBoxStyle}><h2 style={styles.sectionTitleStyle}>Create your private login</h2><p style={styles.bodyStyle}>Your {result?.program} purchase is verified. This secure link expires in 48 hours and can be used once.</p><Link href={createLoginHref} style={styles.primaryButtonStyle}>Create Your Login</Link></section> : null}
  </div></main>
}
