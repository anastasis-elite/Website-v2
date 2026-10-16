import Start2Content from './Start2Content'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getClientTimeZone } from '@/lib/timezone'

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string; assessmentId?: string }> }) {
  const query = await searchParams
  const period = query.period && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(query.period) ? query.period : undefined
  const assessmentId = query.assessmentId && /^[a-zA-Z0-9_-]{1,100}$/.test(query.assessmentId) ? query.assessmentId : undefined
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: client, error } = await supabase.from('clients')
    .select('client_id,full_name,birthdate,timezone,state,onboarding_data')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !client) return <main className="aos-flow-page"><div className="aos-flow-shell"><h1>We couldn’t load your assessment profile.</h1><p>Please try again. Your previously saved assessments are kept in your account.</p><Link href="/dashboard/assessment/start2">Retry loading</Link></div></main>

  return <Start2Content key={`${period || 'current'}:${assessmentId || 'latest'}`} client={client} period={period} assessmentId={assessmentId} timeZone={getClientTimeZone(client)} />
}
