import * as styles from '../styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getAdaptiveDashboard } from '@/lib/dashboard/getAdaptiveDashboard'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import AdaptiveDashboard from '@/components/AdaptiveDashboard'
import { generateDailyInsight } from '@/lib/messaging/engine'
import type { CapacityState, CyclePhase } from '@/lib/messaging/types'

export default async function DashboardPage() {
  const { supabase, client } = await getDashboardContext()

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

  const dailyStructureReviewedThisMonth = client.daily_structure_reviewed_at
    ? new Date(client.daily_structure_reviewed_at) >= monthStart
    : false

  const monthlyAssessmentsDueCount = [
    !monthlyAssessment,
    !dailyStructureReviewedThisMonth,
    !monthlyMeasurements,
  ].filter(Boolean).length

  const dailyPlan = await getDailyExecutionPlan({ supabase, client })
  const cycleStatus = getCycleStatus(client)

  const adaptiveDashboard = await getAdaptiveDashboard({
    client,
    monthlyAssessmentsDueCount,
  })

  const rawCapacity = client?.capacity_state || client?.capacity || 'low'

  const capacity: CapacityState =
    rawCapacity === 'high' || rawCapacity === 'medium' || rawCapacity === 'low'
      ? rawCapacity
      : 'low'

  const completions = [
    dailyPlan?.workoutCompleted,
    dailyPlan?.nutritionLogged,
    dailyPlan?.macroTargetsMet,
  ].filter(Boolean).length

  const insight = generateDailyInsight({
    cyclePhase: (cycleStatus?.phase || 'none') as CyclePhase | 'none',
    capacity,
    completions,
    belief: client?.current_belief || undefined,
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
          client={client}
          dailyPlan={dailyPlan}
          cycleStatus={cycleStatus}
          adaptiveDashboard={adaptiveDashboard}
          assessmentDueCount={monthlyAssessmentsDueCount}
          insight={insight}
        />
      </div>
    </main>
  )
}
