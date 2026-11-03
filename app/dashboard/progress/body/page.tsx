import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { BodyProgressHistory } from '@/components/program-dashboard/ProgressHistory'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { progressRange } from '@/lib/dashboard/progressOverview'
import { loadBodyProgressHistory } from '@/lib/dashboard/bodyProgressHistory'
import { membershipCan } from '@/lib/membership/policy'
import '@/components/phone-app/assessments.css'

export const dynamic = 'force-dynamic'

export default async function BodyProgressPage({ searchParams }: {
  searchParams: Promise<{ range?: string | string[]; measurement?: string | string[] }>
}) {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') ||
    !membershipCan(client, 'progressView') || !membershipCan(client, 'assessmentsView')) notFound()
  const params = await searchParams, range = progressRange(params.range)
  const selection = typeof params.measurement === 'string' && params.measurement.length <= 80 ? params.measurement : undefined
  const data = await loadBodyProgressHistory({ supabase, userId: user.id, client, range })
  return <PhoneAppFrame backHref={`/dashboard/progress?range=${range}`} backLabel="Progress" eyebrow="Recorded body changes" title="Beyond the scale" subtitle="Your saved measurements and private photo comparison.">
    <BodyProgressHistory data={data} selection={selection} />
  </PhoneAppFrame>
}
