import { redirect } from 'next/navigation'
import EmberDashboard from '@/components/program-dashboard/EmberDashboard'
import IgniteDashboard from '@/components/program-dashboard/IgniteDashboard'
import PhoenixDashboard from '@/components/program-dashboard/PhoenixDashboard'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNextLesson } from '@/lib/education/getNextLesson'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { generateDailyInsight } from '@/lib/messaging/engine'

const supportedPrograms = ['ember', 'ignite', 'phoenix']

export default async function ProgramPage({
  params,
}: {
  params: { program: string }
}) {
  const program = params.program

  if (!supportedPrograms.includes(program)) {
    redirect('/dashboard')
  }

  const { supabase, user, client } = await getDashboardContext()
  const subscribedProgram = client.program || 'ignite'

  if (program !== subscribedProgram) {
    redirect(`/dashboard/program/${subscribedProgram}`)
  }

  const lesson = await getNextLesson({ supabase, client, user })
  const dailyPlan = await getDailyExecutionPlan({ supabase, client })
  const cycleStatus = getCycleStatus(client)

  const monthlyAssessmentDueCount = 0
  const insight = generateDailyInsight({
    cyclePhase: (cycleStatus.phase as any) || 'none',
    capacity: (client.capacity_state as any) || 'baseline',
    completions: Number(client.completions || 0),
    belief: client.current_belief || undefined,
  })

  return (
    <main>
      {program === 'ember' && (
        <EmberDashboard client={client} lesson={lesson} />
      )}

      {program === 'ignite' && (
        <IgniteDashboard
          client={client}
          dailyPlan={dailyPlan}
          cycleStatus={cycleStatus}
          assessmentDueCount={monthlyAssessmentDueCount}
          insight={insight}
        />
      )}

      {program === 'phoenix' && (
        <PhoenixDashboard client={client} />
      )}
    </main>
  )
}
