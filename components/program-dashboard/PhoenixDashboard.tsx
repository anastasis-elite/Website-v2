'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { PhoenixDashboardData, PhoenixPlanBlock } from '@/lib/dashboard/phoenix/types'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import { getPhoenixDashboardData } from '@/lib/dashboard/phoenix/getPhoenixDashboardData'
import { useProgramLogicEngine } from '@/components/program-dashboard/logic/hooks'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'
import WorkoutFeedback from '@/components/workout-feedback/WorkoutFeedback'
import BreathingReset from '@/components/recovery/BreathingReset'
import StreakRequirementsCard from '@/components/program-dashboard/StreakRequirementsCard'
import {
  useAssessmentStatus,
  useFlameState,
  useHydrationProgress,
  useMacroProgress,
  usePhoenixDashboardData,
  useRecoveryStatus,
  useSleepStatus,
  useTodayPlanBlocks,
} from '@/components/program-dashboard/phoenix/hooks'

function PlanBlock({ block, saving, nextTaskId, onToggle, onComplete }: { block: PhoenixPlanBlock; saving: boolean; nextTaskId?: string; onToggle: (id: string) => void; onComplete: () => void }) {
  const complete = block.tasks.every((task) => task.complete)
  return <article className={`phoenix-plan-block phoenix-plan-${block.id}${complete ? ' is-complete' : ''}`}>
    <div className="phoenix-plan-title"><span aria-hidden="true">{block.id === 'morning' ? '☀' : block.id === 'midday' ? '◆' : '☾'}</span><div><h3>{block.title}</h3><p>{block.focus}</p></div></div>
    <div className="phoenix-task-list">{block.tasks.map((task) => <button type="button" key={task.id} disabled={saving} className={`${task.complete ? 'complete' : ''}${task.id === nextTaskId ? ' is-next' : ''}${task.secondary ? ' is-secondary' : ''}`} onClick={() => onToggle(task.id)}>
      <span className="phoenix-check">{task.complete ? '✓' : ''}</span><span><strong>{task.label}</strong><small>{task.detail}</small></span>
    </button>)}</div>
    <button type="button" className="phoenix-block-button" disabled={saving || complete} onClick={onComplete}>{complete ? `${block.title} Complete ✓` : `Complete ${block.title}`}</button>
  </article>
}

function StatusCard({ icon, title, value, detail, href, action, complete, feedback }: { icon: string; title: string; value: string; detail: string; href: string; action: string; complete: boolean; feedback?:React.ReactNode }) {
  return <article className={`phoenix-status-card${complete ? ' is-complete' : ''}`}><div className="phoenix-status-heading"><p className="phoenix-label"><span aria-hidden="true">{icon}</span> {title}</p>{feedback}</div><h3>{value}</h3><p>{detail}</p><Link href={href} className="phoenix-outline-button">{complete ? '✓ Done' : action}</Link></article>
}

export default function PhoenixDashboard({ logic, trackLabel }: { logic: ProgramLogicOutput; trackLabel: string }) {
  const router=useRouter()
  const engine = useProgramLogicEngine(logic)
  const initialData: PhoenixDashboardData = getPhoenixDashboardData(engine, trackLabel)
  const { data, setData } = usePhoenixDashboardData(initialData)
  const [addingWater, setAddingWater] = useState(false)
  const [waterError, setWaterError] = useState('')
  const hydration = useHydrationProgress(data.water.consumed, data.water.target)
  const macros = useMacroProgress(data.macros)
  const plan = useTodayPlanBlocks(data.clientId, data.plan)
  const assessment = useAssessmentStatus(data.assessment)
  const recovery = useRecoveryStatus(data.recovery)
  const sleep = useSleepStatus(data.sleep)
  const workoutComplete = !data.workout.assigned || data.workout.completed
  const score = engine.flameState.dailyScore
  const flame = useFlameState(score)
  const nextTask = plan.blocks.flatMap((block) => block.tasks).find((task) => !task.complete)

  async function addWater() {
    const before = data.water.consumed
    const optimistic = before + data.water.increment
    setAddingWater(true); setWaterError('')
    setData((current) => ({ ...current, water: { ...current.water, consumed: optimistic } }))
    try {
      const response = await fetch('/api/nutrition/add-water', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: data.clientId, ounces: data.water.increment }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Water could not be saved.')
      setData((current) => ({ ...current, water: { ...current.water, consumed: Number(payload.nutritionLog?.water_consumed_oz ?? optimistic) } }))
      router.refresh()
    } catch (error) {
      setData((current) => ({ ...current, water: { ...current.water, consumed: before } }))
      setWaterError(error instanceof Error ? error.message : 'Water could not be saved.')
    } finally { setAddingWater(false) }
  }

  return <main className="phoenix-dashboard" style={{ '--phoenix-intensity': flame.intensity } as CSSProperties}>
    <div className="phoenix-shell">
      <header className="phoenix-header"><div className="phoenix-brand"><span aria-hidden="true">🔥</span><div><strong>PHOENIX</strong><small>Simplify. Support. Rise.</small></div></div><div className="phoenix-greeting"><h1>Good Morning, {data.clientName} <span aria-hidden="true">♥</span></h1><p>We&apos;ve got your day. One step at a time.</p></div><div className="phoenix-streak"><span aria-hidden="true">{flame.icon}</span><strong>{data.streak}</strong><small>Day streak</small></div></header>

      <section className="phoenix-support"><span className="phoenix-support-heart" aria-hidden="true">♥</span><div><small>Today&apos;s insight</small><h2>{engine.insight.concise}</h2><p>{engine.flameState.requirements.resetMessage||engine.insight.reasoning}</p></div><BreathingReset clientId={data.clientId}/></section>

      <section id="phoenix-plan" className="phoenix-plan-panel"><div className="phoenix-section-heading"><p className="phoenix-label">▣ Today&apos;s Plan</p><span>{nextTask ? `Next: ${nextTask.label}` : flame.label} · {score}%</span></div><div className="phoenix-plan-grid">{plan.blocks.map((block) => <PlanBlock key={block.id} block={block} saving={plan.saving} nextTaskId={nextTask?.id} onToggle={plan.toggleTask} onComplete={() => plan.completeBlock(block.id)} />)}</div>{plan.error && <p className="phoenix-error" role="alert">{plan.error}</p>}</section>

      <section className="phoenix-core-grid">
        <article className="phoenix-card phoenix-water"><p className="phoenix-label">◆ Water</p><div className="phoenix-water-ring" style={{ '--phoenix-progress': `${hydration.percent * 3.6}deg` } as CSSProperties}><div><strong>{Math.round(data.water.consumed)}</strong><small>of {Math.round(data.water.target)} oz</small></div></div><p>{hydration.remaining} oz left</p><button type="button" className="phoenix-primary-button" disabled={addingWater} onClick={addWater}>+ Add {data.water.increment} oz</button>{waterError && <small className="phoenix-error" role="alert">{waterError}</small>}</article>
        <article className="phoenix-card phoenix-nutrition"><p className="phoenix-label">Ψ Nutrition</p><small>You&apos;ve got this.</small><div className="phoenix-macros">{macros.rows.map((macro) => <div key={macro.key}><p><strong>{macro.label}</strong><span>{Math.round(macro.consumed)} / {Math.round(macro.target)}g</span><small>{macro.remaining}g left</small></p><div><span style={{ width: `${macro.percent}%` }} /></div></div>)}</div><Link href="/dashboard/nutrition" className="phoenix-outline-button">Ψ Log Food</Link></article>
        <article className="phoenix-card phoenix-focus"><p className="phoenix-label">🔥 Today&apos;s Focus</p><h3>{data.focus.message}</h3><div><small>Today I will…</small><strong>{data.focus.intention}</strong></div><span aria-hidden="true">♡</span></article>
      </section>

      <section className="phoenix-status-grid">
        <StatusCard icon="↟" title="Workout" value={data.workout.title} detail={data.workout.assigned ? 'Today’s movement' : 'Gentle movement only'} href="/dashboard/program/phoenix/workout" action="Start" complete={workoutComplete} feedback={<WorkoutFeedback clientId={data.clientId} program="phoenix" assignedWorkoutId={String(engine.workoutDecision.plannedWorkout?.id||engine.workout.title)} workoutTitle={engine.workout.title} workoutHref="/dashboard/program/phoenix/workout" />} />
        <StatusCard icon="✓" title="Assessment" value="Daily Check-In" detail={assessment.completed ? 'Completed today' : 'One quick check-in'} href="/dashboard/check-in" action="Check In" complete={assessment.completed} />
        <StatusCard icon="♨" title="Recovery Check" value={recovery.completed ? 'Ready for guidance' : 'How are you feeling?'} detail="Your recommended recovery action" href="/dashboard/recovery" action="Open Recovery" complete={recovery.completed} />
        <StatusCard icon="☾" title="Sleep" value={sleep.hours !== null ? `${sleep.hours} hours` : sleep.quality !== null ? `Quality ${sleep.quality}/10` : 'Not logged'} detail="Last night" href="/dashboard/sleep" action="Log Sleep" complete={sleep.logged} />
      </section>

      <StreakRequirementsCard flame={engine.flameState} compact/>
      <section className="phoenix-encouragement"><span aria-hidden="true">{flame.icon}</span><h2>You are not behind.<br /><strong>You are becoming.</strong></h2><Link href="/dashboard/assessment/measurements" className="phoenix-outline-button">See My Progress →</Link></section>

      <nav className="phoenix-bottom-nav" aria-label="Phoenix dashboard navigation"><Link href="/dashboard/program/phoenix" className="active"><span>⌂</span>Dashboard</Link><Link href="#phoenix-plan"><span>▣</span>Plan</Link><div className="phoenix-nav-flame" aria-label={`${score}% daily execution`}><span aria-hidden="true">{flame.icon}</span><small>{score}%</small></div><Link href="/dashboard/recovery"><span>▥</span>Support</Link><DashboardMoreMenu program="phoenix" /></nav>
    </div>
  </main>
}
