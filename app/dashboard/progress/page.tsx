import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import ProgressOverview from '@/components/program-dashboard/ProgressOverview'
import { loadProgressOverview, progressRange } from '@/lib/dashboard/progressOverview'
import { loadNutritionProgress } from '@/lib/dashboard/nutritionProgress'
import { loadCycleProgress } from '@/lib/dashboard/cycleProgress'
import { loadRecoveryProgressSummary } from '@/lib/dashboard/recoveryProgressHistory'
import { NutritionProgressCard, CycleProgressCard } from '@/components/program-dashboard/ProgressTrends'
import { membershipCan } from '@/lib/membership/policy'
import styles from '@/components/program-dashboard/ProgressOverview.module.css'

export const dynamic = 'force-dynamic'

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client?.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') ||
    !membershipCan(client, 'progressView') || !membershipCan(client, 'trendsView')) notFound()
  const range = progressRange((await searchParams).range)
  const [overview, nutrition, cycle, recovery] = await Promise.all([
    loadProgressOverview({ supabase, userId: user.id, client, range }),
    loadNutritionProgress({ supabase, user, client, range }),
    loadCycleProgress({ supabase, user, client, range }),
    loadRecoveryProgressSummary({ supabase, user, client, range }),
  ])
  return <PhoneAppFrame eyebrow="Progress" title="Look how far you’ve come."><main className={styles.content}>
    <ProgressOverview data={overview} program={client.program} recovery={recovery} />
    <div className={styles.trends}><NutritionProgressCard data={nutrition} /><CycleProgressCard data={cycle} /></div>
  </main></PhoneAppFrame>
}
