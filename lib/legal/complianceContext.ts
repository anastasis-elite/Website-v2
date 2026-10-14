import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export class ComplianceAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function authorizeComplianceOperation(
  supabase: SupabaseClient,
  expectedUserId?: string,
  clientId?: string,
) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new ComplianceAccessError(401, 'Sign in to manage your consent.')
  if (expectedUserId !== undefined && expectedUserId !== user.id) {
    throw new ComplianceAccessError(403, 'Consent can only be managed for your own account.')
  }
  let lookup = supabase.from('clients').select('client_id,auth_user_id,program').eq('auth_user_id', user.id)
  if (clientId !== undefined) lookup = lookup.eq('client_id', clientId)
  const { data: client, error: clientError } = await lookup.maybeSingle()
  if (clientError) throw new ComplianceAccessError(503, 'Your member record could not be verified. Try again.')
  if (!client || client.auth_user_id !== user.id || (clientId !== undefined && client.client_id !== clientId)) {
    throw new ComplianceAccessError(403, 'Consent can only be managed for your own member record.')
  }
  return { user, client, admin: createAdminClient() }
}
