import Link from 'next/link'
import Stripe from 'stripe'
import { cookies } from 'next/headers'
import * as styles from '../styles/globalstyles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { deliverPurchaseInvitation } from '@/lib/commerce/invitationDelivery'
import { fulfillPurchase } from '@/lib/commerce/fulfillment'
import { purchaseCookieName, verifyPurchaseProof } from '@/lib/commerce/purchaseProof'
import { paymentEnvironmentError } from '@/lib/commerce/environment'

export const dynamic = 'force-dynamic'

export default async function VerifiedPage({ searchParams }: { searchParams?: Promise<{ session_id?: string }> }) {
  const query = await searchParams
  const sessionId = String(query?.session_id || '')
  let result: { clientId: string; email: string; program: string; authUserId?: string | null } | null = null
  let emailSent = false, returningHref = '', errorMessage = ''
  try {
    if (!/^cs_(test_|live_)?[a-zA-Z0-9]+$/.test(sessionId)) throw new Error('This confirmation is missing its secure purchase reference.')
    const environmentError = paymentEnvironmentError()
    if (environmentError) throw new Error(environmentError)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const cookieStore = await cookies()
    const proof = verifyPurchaseProof(cookieStore.get(purchaseCookieName(sessionId))?.value, session.metadata?.purchase_proof_hash)
    const receiptEmail = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase()
    const signedOwner = Boolean(user && (session.metadata?.auth_user_id === user.id || (user.email_confirmed_at && user.email?.toLowerCase() === receiptEmail)))
    if (!proof && !signedOwner) throw new Error('Open this confirmation in the browser where you completed checkout, or sign in with your purchase email.')
    const admin = createAdminClient()
    result = await fulfillPurchase({ stripe, supabase: admin, sessionId })
    if (signedOwner && user && !result.authUserId) {
      const { data, error } = await admin.rpc('claim_checkout_purchase', { p_session_id: sessionId, p_user_id: user.id })
      if (error || !data) throw new Error('This returning purchase could not be connected. If you have an existing recurring subscription, support must reconcile the purchases. Contact support with both receipts.')
      result = { clientId: data.client_id, email: data.email, program: data.program, authUserId: data.auth_user_id }
    }
    if (!result.authUserId) {
      const { data: existingLogin, error } = await admin.from('clients').select('client_id').eq('email', receiptEmail).not('auth_user_id', 'is', null).limit(1).maybeSingle()
      if (error) throw error
      if (existingLogin) returningHref = '/login?redirect=' + encodeURIComponent('/verified?session_id=' + sessionId)
      else {
        await deliverPurchaseInvitation({ supabase: admin, clientId: result.clientId, email: result.email, program: result.program, sessionId, origin: process.env.NEXT_PUBLIC_APP_URL || 'https://www.anastasiselite.com' })
        emailSent = true
      }
    }
  } catch (error) { errorMessage = error instanceof Error ? error.message : 'This purchase could not be verified.'; result = null }
  return <main style={styles.pageStyle}><div style={styles.containerStyle}>
    <p style={styles.eyebrowStyle}>Payment Verification</p>
    <h1 style={styles.heroTitleStyle}>{result ? 'Your purchase is confirmed.' : 'We could not open your account yet.'}</h1>
    {errorMessage ? <section style={styles.cartBoxStyle}><p style={styles.bodyStyle}>{errorMessage}</p><p style={styles.bodyStyle}>Include your purchase email and Stripe receipt when contacting support.</p><Link href="/support" style={styles.secondaryButtonStyle}>Contact support</Link><Link href={'/login?redirect=' + encodeURIComponent('/verified?session_id=' + sessionId)} style={styles.secondaryButtonStyle}>Sign in</Link></section> : null}
    {result?.authUserId ? <section style={styles.cartBoxStyle}><p style={styles.bodyStyle}>Your purchase is connected to your private login.</p><Link href="/dashboard" style={styles.primaryButtonStyle}>Continue to your account</Link></section> : null}
    {returningHref ? <section style={styles.cartBoxStyle}><p style={styles.bodyStyle}>You already have a login. Sign in with your purchase email to connect this purchase to your saved progress.</p><Link href={returningHref} style={styles.primaryButtonStyle}>Sign in and connect purchase</Link></section> : null}
    {emailSent ? <section style={styles.cartBoxStyle}><h2 style={styles.sectionTitleStyle}>Check your email to create your private login</h2><p style={styles.bodyStyle}>We sent a private login link to your purchase email. Open it to choose your password, then complete your member profile and baseline assessment. Check your spam folder if needed.</p><Link href="/support" style={styles.secondaryButtonStyle}>Get login help</Link></section> : null}
  </div></main>
}
