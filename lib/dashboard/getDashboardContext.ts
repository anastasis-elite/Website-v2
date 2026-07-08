import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isClientOnboardingComplete } from '@/lib/dashboard/isClientOnboardingComplete'

export async function getDashboardContext({
  allowIncompleteOnboarding = false,
}: {
  allowIncompleteOnboarding?: boolean
} = {}) {
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
      }
    : client

  if (!allowIncompleteOnboarding && !isClientOnboardingComplete(effectiveClient)) {
    redirect('/dashboard/onboarding/profile')
  }

  return {
    supabase,
    user,
    client: effectiveClient,
  }
}
