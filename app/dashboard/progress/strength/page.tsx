import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { StrengthProgressHistory } from '@/components/program-dashboard/ProgressHistory'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { progressRange } from '@/lib/dashboard/progressOverview'
import { loadStrengthProgressHistory } from '@/lib/dashboard/strengthProgressHistory'
import { membershipCan } from '@/lib/membership/policy'

export const dynamic = 'force-dynamic'

export default async function StrengthProgressPage({ searchParams }: {
  searchParams: Promise<{ range?: string | string[]; exercise?: string | string[] }>
}) {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') ||
    !membershipCan(client, 'progressView') || !membershipCan(client, 'workoutLogging')) notFound()
  const params = await searchParams, range = progressRange(params.range)
  const selection = typeof params.exercise === 'string' && params.exercise.length <= 128 ? params.exercise : undefined
  const data = await loadStrengthProgressHistory({ supabase, user, client, range })
  return <PhoneAppFrame backHref={`/dashboard/progress?range=${range}`} backLabel="Progress" eyebrow="Recorded training" title="Getting stronger" subtitle="Your recorded loads and the work you saved.">
    <StrengthProgressHistory data={data} selection={selection} />
  </PhoneAppFrame>
}
