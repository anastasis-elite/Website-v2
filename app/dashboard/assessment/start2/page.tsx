import Start2Content from './Start2Content'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getStrengthFormHistory } from '@/lib/assessment/strengthForm'
import { getClientTimeZone } from '@/lib/timezone'
import { membershipCan } from '@/lib/membership/policy'

export default async function Page({ searchParams }: { searchParams?: Promise<{ period?: string; assessmentId?: string }> }) {
  const query = await searchParams || {}
  const period = query.period && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(query.period) ? query.period : undefined
  const assessmentId = query.assessmentId && /^[a-zA-Z0-9_-]{1,100}$/.test(query.assessmentId) ? query.assessmentId : undefined
  const { client, supabase } = await getDashboardContext({ allowIncompleteOnboarding: true, allowInactiveAccess: true })
  const history = await getStrengthFormHistory(supabase, client)
  return <Start2Content key={`${period || 'current'}:${assessmentId || 'latest'}`} client={client} history={history} period={period} assessmentId={assessmentId} timeZone={getClientTimeZone(client)} canEdit={membershipCan(client, 'assessmentsView') && membershipCan(client, 'generatedCoaching')} />
}
