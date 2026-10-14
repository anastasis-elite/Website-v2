import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isClientOnboardingComplete } from '@/lib/dashboard/isClientOnboardingComplete'
import { hasMemberAccess } from '@/lib/commerce/access'
import { cache } from 'react'

// React's cache lasts for one server render request. Layouts and pages share the
// verified identity without persisting member data across requests or accounts.
const loadDashboardIdentity = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (clientError) {
    throw new Error(`Client lookup failed: ${clientError.message}`)
  }

  if (!client) {
    throw new Error(`No client found for auth user: ${user.id}`)
  }

  const { data: currentProfile } = await supabase
    .from('client_current_profiles')
    .select('*')
    .eq('user_id', user.id)
    .eq('client_id', client.client_id)
    .maybeSingle()

  const effectiveClient = currentProfile
    ? {
        ...client,
        injuries: currentProfile.injuries,
        limitations: currentProfile.limitations,
        equipment_access: currentProfile.equipment_access,
        current_weight: currentProfile.current_weight,
        primary_goal: currentProfile.primary_goal,
        workout_days_available: currentProfile.workout_days_available ?? client.workout_days_available,
        current_workout_minutes_per_session: currentProfile.workout_minutes_available ?? client.current_workout_minutes_per_session,
        accountability_preferences: currentProfile.accountability_preferences,
        accountability_partner_persona: currentProfile.accountability_partner_persona,
        accountability_communication_profile: currentProfile.accountability_communication_profile,
        accountability_memory: currentProfile.accountability_memory,
        accountability_behavior_summary: currentProfile.accountability_behavior_summary,
        natal_profile: currentProfile.natal_profile,
      }
    : client

  return {
    supabase,
    user,
    client: effectiveClient,
  }
})

export async function getDashboardContext({
  allowIncompleteOnboarding = false,
  allowInactiveAccess = false,
}: {
  allowIncompleteOnboarding?: boolean
  allowInactiveAccess?: boolean
} = {}) {
  const context = await loadDashboardIdentity()
  // Each caller still enforces its own gates, even when the layout permits
  // account/billing pages or incomplete onboarding.
  if (!allowInactiveAccess && !hasMemberAccess(context.client)) redirect('/dashboard/payment-issue')
  if (!allowIncompleteOnboarding && !isClientOnboardingComplete(context.client)) {
    redirect('/dashboard/onboarding/profile')
  }
  return context
}
