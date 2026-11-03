import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { EnergyRecoveryHistory } from '@/components/program-dashboard/RecoveryProgressHistory'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { progressRange } from '@/lib/dashboard/progressOverview'
import { loadRecoveryProgressHistory } from '@/lib/dashboard/recoveryProgressHistory'
import { membershipCan } from '@/lib/membership/policy'

export const dynamic = 'force-dynamic'

export default async function EnergyRecoveryProgressPage({ searchParams }: {
  searchParams: Promise<{ range?: string | string[]; signal?: string | string[] }>
}) {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client?.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') ||
    !membershipCan(client, 'progressView') || !membershipCan(client, 'trendsView') || !membershipCan(client, 'recoveryBasic')) notFound()
  const params = await searchParams, range = progressRange(params.range)
  const selection = typeof params.signal === 'string' && params.signal.length <= 50 ? params.signal : undefined
  const data = await loadRecoveryProgressHistory({ supabase, user, client, range, includeWorkouts: false })
  return <PhoneAppFrame backHref={`/dashboard/progress?range=${range}`} backLabel="Progress" eyebrow="Your saved check-ins" title="Energy & recovery" subtitle="Your recorded check-ins and the recovery activities you saved.">
    <EnergyRecoveryHistory data={data} selection={selection} />
  </PhoneAppFrame>
}
