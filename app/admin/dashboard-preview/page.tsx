import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getAdaptiveDashboard } from '@/lib/dashboard/getAdaptiveDashboard'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import AdaptiveDashboard from '@/components/AdaptiveDashboard'

export default async function AdminDashboardPreviewPage({
  searchParams,
}: {
  searchParams?: {
    adminSecret?: string
    tier?: string
  }
}) {
  const params = await searchParams

  const adminSecret = params?.adminSecret || ''
  const tier = params?.tier || 'ember'

  const isAllowed = adminSecret === process.env.ADMIN_SECRET

  if (!isAllowed) {
    return (
      <main style={styles.pageStyle}>
        <div style={styles.containerStyle}>
          <p style={styles.eyebrowStyle}>Admin Access</p>

          <h1 style={styles.heroTitleStyle}>
            Dashboard Preview
          </h1>

          <form style={styles.cartBoxStyle}>
            <input
              type="password"
              name="adminSecret"
              placeholder="Admin Secret"
              required
              style={styles.inputStyle}
            />

            <select name="tier" defaultValue="ember" style={styles.inputStyle}>
              <option value="ember">Ember</option>
              <option value="ignite">Ignite</option>
              <option value="phoenix">Phoenix</option>
            </select>

            <button type="submit" style={styles.primaryButtonStyle}>
              Preview Dashboard
            </button>
          </form>
        </div>
      </main>
    )
  }

  const forcedTier =
    tier === 'ember' || tier === 'ignite' || tier === 'phoenix'
      ? tier
      : 'ember'

  const { supabase, client, user } = await getDashboardContext()

  const dashboardClient = {
    ...client,
    program: forcedTier,
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

  const insight = {
  title: 'Lower capacity does not mean failure.',
  observation: 'Your system is showing a lower-capacity signal today.',
  meaning:
    'This is not a sign that you are behind. It is a sign that today needs precision instead of pressure.',
  identityShift:
    'You are not proving discipline by overriding your body. You are building trust by responding to it.',
  beliefChallenge:
    'Doing more is not always the highest-capacity move.',
  nextStep:
    'Complete the smallest effective version of today’s workout, then log one full meal.',
}
  
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Admin Preview</p>

        <h1 style={styles.heroTitleStyle}>
          {forcedTier.toUpperCase()} Dashboard
        </h1>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          {['ember', 'ignite', 'phoenix'].map((item) => (
            <Link
              key={item}
              href={`/admin/dashboard-preview?adminSecret=${adminSecret}&tier=${item}`}
              style={styles.secondaryButtonStyle}
            >
              Preview {item}
            </Link>
          ))}
        </div>

        <AdaptiveDashboard
          client={dashboardClient}
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
