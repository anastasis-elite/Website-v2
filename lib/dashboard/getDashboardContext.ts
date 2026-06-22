import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  if (
    !allowIncompleteOnboarding &&
    (
      client.onboarding_completed !== true ||
      !client.birthdate ||
      !client.address_line_1
    )
  ) {
    redirect('/dashboard/onboarding/profile')
  }

  return {
    supabase,
    user,
    client,
  }
}
