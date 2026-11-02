import 'server-only'
import { createHmac } from 'crypto'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashInvitationToken } from '@/lib/auth/clientInvitations'

type InvitationJob = {
  session_id: string; client_id: string; email: string; program: string
  invitation_id: string; expires_at: string; lease_token: string; first_attempt_at: string
}

/** Stable across retries; only the hash is persisted and the token stays private. */
export function purchaseInvitationToken(sessionId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Secure login email delivery needs administrator setup.')
  return createHmac('sha256', secret).update(`purchase-invitation:v1:${sessionId}`).digest('base64url')
}

export async function deliverPurchaseInvitation({ supabase, sessionId, origin }: {
  supabase: SupabaseClient; sessionId: string; origin: string
  clientId?: string; email?: string; program?: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) throw new Error('Secure login email delivery is not configured. Contact support with your receipt.')
  if (!/^cs_(test_|live_)?[a-zA-Z0-9]+$/.test(sessionId)) throw new Error('A valid purchase reference is required.')
  const base = new URL(origin)
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('Secure login email origin is not configured.')
  const token = purchaseInvitationToken(sessionId)
  const { data, error } = await supabase.rpc('claim_purchase_invitation', {
    p_session_id: sessionId, p_token_hash: hashInvitationToken(token), p_expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
  })
  if (error) throw new Error('Secure login email delivery needs administrator setup or recovery.')
  if (!data) {
    const result = await supabase.from('purchase_invitation_outbox').select('status').eq('session_id', sessionId).maybeSingle()
    if (result.error) throw new Error('Secure login email status could not be confirmed.')
    if (result.data?.status === 'delivered') return true
    if (result.data?.status === 'suppressed') return false
    throw new Error('Secure login email delivery is pending. Please retry later or contact support.')
  }
  const job = data as InvitationJob
  if (job.session_id !== sessionId) throw new Error('Secure login email purchase reference does not match.')
  const href = `${base.origin}/create-login?${new URLSearchParams({ client_id: job.client_id, email: job.email, program: job.program, token })}`
  const escapedHref = href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  let accepted = false
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Anastasis <onboarding@anastasiselite.com>', to: job.email,
      subject: 'Create your private Anastasis login',
      html: `<p>Your purchase has been confirmed. Open this private link to choose your password and begin your member setup.</p><p><a href="${escapedHref}">Create your login</a></p><p>This link expires in 48 hours. If you did not make this purchase, you can ignore this email and contact Anastasis support.</p>`,
    }, { idempotencyKey: `purchase-login:${sessionId}` })
    if (result.error || !result.data?.id) throw new Error('Secure login email could not be confirmed.')
    accepted = true
    const finished = await supabase.rpc('finish_purchase_invitation', { p_session_id: sessionId, p_lease_token: job.lease_token, p_delivered: true })
    if (finished.error || finished.data !== true) throw new Error('Your login email was sent, but its status could not be confirmed. Please retry later.')
    return true
  } catch {
    // A later retry reuses the identical invitation. SQL bounds retry to the
    // provider idempotency window and holds older uncertain jobs for recovery.
    if (!accepted) await supabase.rpc('finish_purchase_invitation', { p_session_id: sessionId, p_lease_token: job.lease_token, p_delivered: false })
    throw new Error('Secure login email delivery could not be confirmed. Retry is required.')
  }
}

export async function drainPurchaseInvitations(supabase: SupabaseClient, origin: string) {
  const now = new Date().toISOString()
  const due = await supabase.from('purchase_invitation_outbox').select('session_id')
    .in('status', ['pending', 'sending']).lte('next_attempt_at', now)
    .or(`lease_expires_at.is.null,lease_expires_at.lt.${now}`).order('next_attempt_at').limit(20)
  if (due.error) throw new Error('Secure login email queue is unavailable.')
  let delivered = 0, failed = 0
  for (const row of due.data || []) {
    try { if (await deliverPurchaseInvitation({ supabase, sessionId: row.session_id, origin })) delivered++ }
    catch { failed++ }
  }
  return { delivered, failed }
}
