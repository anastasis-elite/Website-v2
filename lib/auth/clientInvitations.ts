import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const invitationLifetimeMs = 48 * 60 * 60 * 1000

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createClientInvitation({
  supabase,
  clientId,
  email,
}: {
  supabase: SupabaseClient
  clientId: string
  email: string
}) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + invitationLifetimeMs).toISOString()
  const { error } = await supabase.from('client_invitations').insert({
    client_id: clientId,
    email: email.trim().toLowerCase(),
    token_hash: hashInvitationToken(token),
    expires_at: expiresAt,
  })
  if (error) throw new Error(`Unable to create login invitation: ${error.message}`)
  return { token, expiresAt }
}

export async function validateClientInvitation({
  supabase,
  token,
  clientId,
  email,
}: {
  supabase: SupabaseClient
  token: string
  clientId: string
  email: string
}) {
  const { data, error } = await supabase
    .from('client_invitations')
    .select('id,client_id,email,expires_at,consumed_at')
    .eq('token_hash', hashInvitationToken(token))
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw new Error('Unable to validate this invitation.')
  const valid = Boolean(
    data &&
      !data.consumed_at &&
      new Date(data.expires_at).getTime() > Date.now() &&
      data.email.trim().toLowerCase() === email.trim().toLowerCase()
  )
  return valid ? data : null
}
