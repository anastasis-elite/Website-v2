import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClientInvitation, hashInvitationToken } from '@/lib/auth/clientInvitations'
import { enforceRateLimit } from '@/lib/auth/rateLimit'

export async function deliverPurchaseInvitation({ supabase, clientId, email, program, sessionId, origin }: { supabase: SupabaseClient; clientId: string; email: string; program: string; sessionId: string; origin: string }) {
  if (!process.env.RESEND_API_KEY) throw new Error('Secure login email delivery is not configured. Contact support with your receipt.')
  const { data: recent, error } = await supabase.from('client_invitations').select('id').eq('client_id', clientId).is('consumed_at', null).gte('delivered_at', new Date(Date.now() - 10 * 60000).toISOString()).limit(1).maybeSingle()
  if (error) throw new Error('Secure login email delivery needs administrator setup.')
  if (recent) return
  const allowed = await enforceRateLimit({ supabase, scope: 'purchase_invitation_delivery', key: sessionId, limit: 5, windowMinutes: 15 })
  if (!allowed) throw new Error('A login email was recently requested. Check your inbox and spam folder, or contact support.')
  const invitation = await createClientInvitation({ supabase, clientId, email })
  const href = origin.replace(/\/$/, '') + '/create-login?client_id=' + encodeURIComponent(clientId) + '&email=' + encodeURIComponent(email) + '&program=' + encodeURIComponent(program) + '&token=' + encodeURIComponent(invitation.token)
  const escapedHref = href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Anastasis <onboarding@anastasiselite.com>', to: email,
    subject: 'Create your private Anastasis login',
    html: `<p>Your purchase has been confirmed. Open this private link to choose your password and begin your member setup.</p><p><a href="${escapedHref}">Create your login</a></p><p>This link expires in 48 hours. If you did not make this purchase, you can ignore this email and contact Anastasis support.</p>`,
  })
  if (result.error) throw new Error('We could not send your secure login email. Contact support or retry this confirmation.')
  const { error: updateError } = await supabase.from('client_invitations').update({ delivered_at: new Date().toISOString() }).eq('token_hash', hashInvitationToken(invitation.token))
  if (updateError) throw new Error('Your login email was sent, but its delivery status could not be saved. Check your inbox or contact support.')
}
