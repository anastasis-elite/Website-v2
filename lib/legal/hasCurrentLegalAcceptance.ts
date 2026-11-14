import 'server-only'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { REQUIRED_LEGAL_VERSIONS } from '@/lib/legal/config'
import { authorizeComplianceOperation } from '@/lib/legal/complianceContext'
import { getDashboardStartupTiming } from '@/lib/performance/dashboardStartupRequest'

// Layout and page use the same verified request client. React's server cache
// shares only this exact client/user read during that render; it never retains
// a legal acceptance result across requests or signed-in accounts.
const loadCurrentLegalAcceptance = cache(async (supabase: SupabaseClient, userId: string) => {
  return getDashboardStartupTiming().measure('legal', async () => {
    const { admin, user } = await authorizeComplianceOperation(supabase, userId)
    const { data, error } = await admin
      .from('legal_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq('terms_version', REQUIRED_LEGAL_VERSIONS.terms)
      .eq('privacy_version', REQUIRED_LEGAL_VERSIONS.privacy)
      .eq('health_disclaimer_version', REQUIRED_LEGAL_VERSIONS.healthDisclaimer)
      .limit(1)
      .maybeSingle()

    if (error) throw new Error('Legal acceptance could not be verified. Try again.')
    return Boolean(data)
  })
})

export async function hasCurrentLegalAcceptance(supabase: SupabaseClient, userId: string) {
  return loadCurrentLegalAcceptance(supabase, userId)
}
