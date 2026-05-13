import { redirect } from 'next/navigation'
import { getClientData } from '@/lib/supabase/getClient'

export default async function WorkoutRedirectPage() {
  const client = await getClientData()

  if (!client) {
    redirect('/login')
  }

  const program = client.program || 'ignite'

  redirect(`/dashboard/program/${encodeURIComponent(program)}/plan/content`)
}
