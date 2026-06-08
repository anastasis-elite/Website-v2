import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getAdaptiveDashboard } from '@/lib/dashboard/getAdaptiveDashboard'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import AdaptiveDashboard from '@/components/AdaptiveDashboard'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ tier?: string }>
}) {
  const params = await searchParams

  const { supabase, client, user } = await getDashboardContext()

  const forcedTier = params?.tier

  const dashboardClient = {
    ...client,
    program:
      forcedTier === 'ember' ||
      forcedTier === 'ignite' ||
      forcedTier === 'phoenix'
        ? forcedTier
        : client.program,
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const monthStartDate = monthStart.toISOString().split('T')[0]

  const { data: monthlyAssessment } = await supabase
    .from('assessments')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('submitted_at', monthStart.toISOString())
    .limit(1)
    .maybeSingle()

  const { data: monthlyMeasurements } = await supabase
    .from('measurement_logs')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('log_date', monthStartDate)
    .limit(1)
    .maybeSingle()

  const assessmentCompletedThisMonth = !!monthlyAssessment
  const measurementsCompletedThisMonth = !!monthlyMeasurements

  const dailyStructureReviewedThisMonth =
    client.daily_structure_reviewed_at
      ? new Date(client.daily_structure_reviewed_at) >= monthStart
      : false

  const monthlyAssessmentsDueCount = [
    !assessmentCompletedThisMonth,
    !dailyStructureReviewedThisMonth,
    !measurementsCompletedThisMonth,
  ].filter(Boolean).length

  const lesson = await getNextLesson({
    supabase,
    client: dashboardClient,
    user,
  })

  const dailyPlan = await getDailyExecutionPlan({
    supabase,
    client: dashboardClient,
  })

  const cycleStatus = getCycleStatus(dashboardClient)

  const adaptiveDashboard = await getAdaptiveDashboard({
    client: dashboardClient,
    monthlyAssessmentsDueCount,
  })

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Client Dashboard</p>

        <h1 style={styles.heroTitleStyle}>Welcome home.</h1>

        <p style={styles.heroTextStyle}>
          This dashboard adapts to where you are. Hard days do not mean failure
          here. They give the system more context so your support can become
          softer, clearer, and more realistic.
        </p>

        <AdaptiveDashboard
          client={dashboardClient}
          dailyPlan={dailyPlan}
          cycleStatus={cycleStatus}
          adaptiveDashboard={adaptiveDashboard}
          assessmentDueCount={monthlyAssessmentsDueCount}
          lesson={lesson}
        />
      </div>
    </main>
  )
}
