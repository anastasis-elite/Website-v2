import type { SupabaseClient } from '@supabase/supabase-js'
import type { FeatureConsentType } from '@/lib/legal/config'

export async function getFeatureConsent(supabase: SupabaseClient, userId: string, consentType: FeatureConsentType) {
  const { data, error } = await supabase
    .from('feature_consent_events')
    .select('granted, consent_version, recorded_at')
    .eq('user_id', userId)
    .eq('consent_type', consentType)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Feature consent lookup failed: ${error.message}`)
  return data || null
}
