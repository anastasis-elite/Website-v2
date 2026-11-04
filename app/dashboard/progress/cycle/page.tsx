import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { CycleProgressHistory } from '@/components/program-dashboard/ProgressTrends'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { progressRange } from '@/lib/dashboard/progressOverview'
import { loadCycleProgress } from '@/lib/dashboard/cycleProgress'
import { membershipCan } from '@/lib/membership/policy'

export const dynamic = 'force-dynamic'

export default async function CycleProgressPage({ searchParams }: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client?.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') ||
    !membershipCan(client, 'progressView') || !membershipCan(client, 'trendsView')) notFound()
  const range = progressRange((await searchParams).range)
  const data = await loadCycleProgress({ supabase, user, client, range })
  return <PhoneAppFrame backHref={`/dashboard/progress?range=${range}`} backLabel="Progress" eyebrow="Logged starts" title="Your recorded cycle intervals" subtitle="Calendar days between your logged period starts.">
    <CycleProgressHistory data={data} />
  </PhoneAppFrame>
}
