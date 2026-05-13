import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function getDashboardContext() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!client) {
    redirect('/create-login')
  }

  return {
    supabase,
    user,
    client,
  }
}
