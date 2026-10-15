import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { REQUIRED_LEGAL_VERSIONS } from '@/lib/legal/config'
import { authorizeComplianceOperation } from '@/lib/legal/complianceContext'

export async function hasCurrentLegalAcceptance(supabase: SupabaseClient, userId: string) {
  const { admin, user } = await authorizeComplianceOperation(supabase, userId)
  const { data, error } = await admin
    .from('legal_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('terms_version', REQUIRED_LEGAL_VERSIONS.terms)
    .eq('privacy_version', REQUIRED_LEGAL_VERSIONS.privacy)
    .eq('health_disclaimer_version', REQUIRED_LEGAL_VERSIONS.healthDisclaimer)
    .eq('ai_disclaimer_version', REQUIRED_LEGAL_VERSIONS.aiDisclaimer)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error('Legal acceptance could not be verified. Try again.')
  return Boolean(data)
}
