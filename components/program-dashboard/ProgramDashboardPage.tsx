import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import PlanOverview from '@/components/program-dashboard/PlanOverview'
import DashboardReadyShell from '@/components/program-dashboard/DashboardReadyShell'
import TodayStartup from '@/components/program-dashboard/TodayStartup'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import { getTodayAccessContext, TodayAccessError } from '@/lib/dashboard/todayAccess'
import { loadTodayBootstrap } from '@/lib/dashboard/todayBootstrap'
import { loadTodayEnrichment } from '@/lib/dashboard/loadTodayEnrichment'
import { DashboardLocalDayChangedError } from '@/lib/dashboard/logic/loadProgramLogicInputs'
import { getDashboardStartupTiming } from '@/lib/performance/dashboardStartupRequest'
import styles from '@/components/program-dashboard/TodayPlanTheme.module.css'

const supportedPrograms = ['ember', 'ignite', 'phoenix'] as const

export default async function ProgramPage({ params, searchParams }: {
  params: Promise<{ program: string }>
  searchParams?: Promise<{ view?: string }>
}) {
  const timings = getDashboardStartupTiming()
  const { program, view } = await timings.measure('routing', async () => ({
    ...(await params), view: (await searchParams)?.view === 'plan' ? 'plan' : 'today',
  }))
  if (!supportedPrograms.includes(program as any)) redirect('/dashboard')

  let context
  try {
    context = await timings.measure('context', () => getTodayAccessContext({ program }))
  } catch (error) {
    if (!(error instanceof TodayAccessError) || !error.flags?.length) throw error
    // Access and safety are resolved before mounting any daily action.
    return <SafetyEscalationNotice flags={error.flags} />
  }
  if (view === 'today') {
    const seed = await timings.measure('bootstrap', () => loadTodayBootstrap({ ...context, sourceTimeoutMs: 1500 }))
    timings.start('response-ready')()
    return <main className={styles.page}><TodayStartup key={`${seed.ownerUserId}:${seed.clientId}:${seed.date}:${seed.timezone}`} seed={seed} startupTimings={timings.snapshot()} /></main>
  }

  return <main className={styles.page}><Suspense fallback={<DashboardReadyShell program={context.program} showStreak={false} />}>
    <SavedPlan context={context} timings={timings} />
  </Suspense></main>
}

async function SavedPlan({ context, timings }: {
  context: Awaited<ReturnType<typeof getTodayAccessContext>>
  timings: ReturnType<typeof getDashboardStartupTiming>
}) {
  let result
  try { result = await loadTodayEnrichment({ ...context, timings }) }
  catch (error) {
    if (!(error instanceof DashboardLocalDayChangedError)) throw error
    result = await loadTodayEnrichment({ ...context, timings })
  }
  return <PlanOverview logic={result.logic} schedule={result.schedule} />
}
