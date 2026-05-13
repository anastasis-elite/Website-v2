import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function getDashboardContext() {
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
    console.error('CLIENT LOOKUP ERROR:', clientError)
    redirect('/login')
  }

  if (!client) {
    console.error('NO CLIENT FOUND FOR AUTH USER:', user.id)
    redirect('/create-login')
  }

  return {
    supabase,
    user,
    client,
  }
}
