import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FEATURE_CONSENT_TYPES, type FeatureConsentType } from '@/lib/legal/config'
import { authorizeComplianceOperation } from '@/lib/legal/complianceContext'

export async function getFeatureConsent(supabase: SupabaseClient, userId: string, consentType: FeatureConsentType) {
  if (!FEATURE_CONSENT_TYPES.includes(consentType)) throw new Error('Invalid feature consent type.')
  const { admin, user } = await authorizeComplianceOperation(supabase, userId)
  const { data, error } = await admin
    .from('feature_consent_events')
    .select('granted, consent_version, recorded_at')
    .eq('user_id', user.id)
    .eq('consent_type', consentType)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Feature consent could not be loaded. Try again.')
  return data || null
}
