import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { NutritionProgressHistory } from '@/components/program-dashboard/ProgressTrends'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { progressRange } from '@/lib/dashboard/progressOverview'
import { loadNutritionProgress } from '@/lib/dashboard/nutritionProgress'
import { membershipCan } from '@/lib/membership/policy'

export const dynamic = 'force-dynamic'

export default async function NutritionProgressPage({ searchParams }: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client?.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') ||
    !membershipCan(client, 'progressView') || !membershipCan(client, 'trendsView') || !membershipCan(client, 'nutritionTracking')) notFound()
  const range = progressRange((await searchParams).range)
  const data = await loadNutritionProgress({ supabase, user, client, range })
  return <PhoneAppFrame backHref={`/dashboard/progress?range=${range}`} backLabel="Progress" eyebrow="Recorded nutrition" title="Your daily nourishment" subtitle="Hydration and macro totals from your saved entries.">
    <NutritionProgressHistory data={data} />
  </PhoneAppFrame>
}
