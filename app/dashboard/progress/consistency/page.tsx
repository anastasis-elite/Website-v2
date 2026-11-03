import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { ConsistencyProgressHistory } from '@/components/program-dashboard/RecoveryProgressHistory'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { progressRange } from '@/lib/dashboard/progressOverview'
import { loadRecoveryProgressHistory } from '@/lib/dashboard/recoveryProgressHistory'
import { membershipCan } from '@/lib/membership/policy'

export const dynamic = 'force-dynamic'

export default async function ConsistencyProgressPage({ searchParams }: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client?.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') ||
    !membershipCan(client, 'progressView') || !membershipCan(client, 'trendsView') ||
    !membershipCan(client, 'recoveryBasic') || !membershipCan(client, 'workoutLogging')) notFound()
  const params = await searchParams, range = progressRange(params.range)
  const data = await loadRecoveryProgressHistory({ supabase, user, client, range, includeWorkouts: true })
  return <PhoneAppFrame backHref={`/dashboard/progress?range=${range}`} backLabel="Progress" eyebrow="Day by day" title="Showing up for you" subtitle="A comparison of the workouts, check-ins and recovery you saved.">
    <ConsistencyProgressHistory data={data} />
  </PhoneAppFrame>
}
