import type { SupabaseClient } from '@supabase/supabase-js'
import { REQUIRED_LEGAL_VERSIONS } from '@/lib/legal/config'

export async function hasCurrentLegalAcceptance(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('terms_version', REQUIRED_LEGAL_VERSIONS.terms)
    .eq('privacy_version', REQUIRED_LEGAL_VERSIONS.privacy)
    .eq('health_disclaimer_version', REQUIRED_LEGAL_VERSIONS.healthDisclaimer)
    .eq('ai_disclaimer_version', REQUIRED_LEGAL_VERSIONS.aiDisclaimer)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Legal acceptance lookup failed: ${error.message}`)
  return Boolean(data)
}
