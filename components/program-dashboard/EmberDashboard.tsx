'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import type { EmberDashboardData } from '@/lib/dashboard/ember/types'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import { getEmberDashboardData } from '@/lib/dashboard/ember/getEmberDashboardData'
import { useProgramLogicEngine } from '@/components/program-dashboard/logic/hooks'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'
import DashboardProgressLinks from '@/components/program-dashboard/DashboardProgressLinks'
import StreakRequirementsCard from '@/components/program-dashboard/StreakRequirementsCard'
import WorkoutFeedback from '@/components/workout-feedback/WorkoutFeedback'
import HydrationQuickAdd from '@/components/hydration/HydrationQuickAdd'
import {
  useAssessmentStatus,
  useClientDashboardData,
  useFlameState,
  useHydrationProgress,
  useMacroProgress,
  useTodayWorkout,
} from '@/components/program-dashboard/ember/hooks'

const executionItems = {
  workout: { icon: '↟', title: 'Workout', href: '/dashboard/program/ember/workout' },
  assessment: { icon: '✓', title: 'Daily Check-In', href: '/dashboard/check-in' },
  recovery: { icon: '♥', title: 'Recovery Check', href: '/dashboard/recovery' },
} as const

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function ExecutionCard({
  kind,
  label,
  detail,
  complete,
  cta,
  feedback,
}: {
  kind: keyof typeof executionItems
  label: string
  detail: string
  complete: boolean
  cta: string
  feedback?: React.ReactNode
}) {
  const item = executionItems[kind]
  return (
    <article className={`ember-execution-card${complete ? ' is-complete' : ''}`}>
      <div className="ember-card-topline">
        <span className={`ember-icon ember-icon-${kind}`} aria-hidden="true">{item.icon}</span>
        <span className="ember-completion-mark" aria-label={complete ? 'Complete' : 'Incomplete'}>{complete ? '✓' : '○'}</span>
      </div>
      <p className="ember-card-kicker">{item.title}</p>
      <h3>{label}</h3>
      <p className="ember-card-detail">{detail}</p>
      {feedback}
      <Link href={item.href} className={complete ? 'ember-action ember-action-complete' : 'ember-action'}>
        {complete ? 'Completed ✓' : cta}
      </Link>
    </article>
  )
}

export default function EmberDashboard({ logic }: { logic: ProgramLogicOutput }) {
  const engine = useProgramLogicEngine(logic)
  const router=useRouter()
  const initialData: EmberDashboardData = getEmberDashboardData(engine)
  const { data, setData } = useClientDashboardData(initialData)
  const [addingWater, setAddingWater] = useState(false)
  const [waterError, setWaterError] = useState('')
  const hydration = useHydrationProgress(data.water.consumed, data.water.target)
  const macroProgress = useMacroProgress(data.macros)
  const workout = useTodayWorkout(data.workout)
  const assessment = useAssessmentStatus(data.assessment)
  const score = engine.flameState.dailyScore
  const flame = useFlameState(score)

  async function addWater() {
    setAddingWater(true)
    setWaterError('')
    const optimisticTotal = data.water.consumed + data.water.increment
    setData((current) => ({
      ...current,
      water: { ...current.water, consumed: optimisticTotal },
    }))

    try {
      const response = await fetch('/api/nutrition/add-water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: data.clientId, ounces: data.water.increment }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Water could not be saved.')
      setData((current) => ({
        ...current,
        water: {
          ...current.water,
          consumed: Number(payload.nutritionLog?.water_consumed_oz ?? optimisticTotal),
        },
      }))
      router.refresh()
    } catch (error) {
      setData((current) => ({
        ...current,
        water: { ...current.water, consumed: data.water.consumed },
      }))
      setWaterError(error instanceof Error ? error.message : 'Water could not be saved.')
    } finally {
      setAddingWater(false)
    }
  }

  return (
    <main className="ember-dashboard" style={{ '--ember-intensity': flame.intensity } as CSSProperties}>
      <div className="ember-dashboard-shell">
        <header className="ember-header">
          <div className="ember-brand">
            <span className="ember-brand-flame" aria-hidden="true">🔥</span>
            <div><strong>EMBER</strong><small>Strong. Focused. Unstoppable.</small></div>
          </div>
          <div className="ember-greeting">
            <h1>{greeting()}, {data.clientName} <span aria-hidden="true">{flame.icon}</span></h1>
            <p>Let&apos;s execute today.</p>
          </div>
          <div className="ember-streak" data-flame-state={flame.key}>
            <span aria-hidden="true">{flame.icon}</span><strong>{data.streak}</strong><small>Day streak</small>
          </div>
        </header>

        <section className="ember-primary-grid" aria-label="Hydration and macros">
          <article className="ember-panel ember-water-card">
            <p className="ember-panel-label">Water</p>
            <div className="ember-water-visuals">
              <HydrationQuickAdd
                clientId={data.clientId}
                consumed={data.water.consumed}
                target={data.water.target}
                defaultOunces={data.water.increment}
                minimumOunces={4}
                maximumOunces={64}
                stepOunces={4}
                onSaved={(newConsumedTotal) => {
                  setData((current) => ({
                    ...current,
                    water: { ...current.water, consumed: newConsumedTotal },
                  }))
                  router.refresh()
                }}
                renderTrigger={({ open, addingWater: quickAddingWater, triggerRef, toggle }) => (
                  <button
                    ref={triggerRef}
                    type="button"
                    className="ember-progress-ring ember-progress-ring-button"
                    data-tutorial-id="dashboard-water-progress"
                    onClick={toggle}
                    disabled={quickAddingWater}
                    aria-label={`Water: ${Math.round(data.water.consumed)} of ${Math.round(data.water.target)} ounces. Add water.`}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    style={{ '--progress': `${hydration.percent * 3.6}deg` } as CSSProperties}
                  >
                    <div><strong>{Math.round(data.water.consumed)}</strong><span>oz</span></div>
                  </button>
                )}
              />
              <div className="ember-water-glass" aria-label={`${hydration.percent}% hydration complete`}>
                <div className="ember-water-fill" style={{ height: `${hydration.percent}%` }} />
                <span aria-hidden="true">♨</span>
              </div>
            </div>
            <p className="ember-remaining">{hydration.remaining} oz left of {Math.round(data.water.target)} oz</p>
            <button type="button" className="ember-primary-button" onClick={addWater} disabled={addingWater}>
              {addingWater ? 'Adding…' : `+ Add ${data.water.increment} oz`}
            </button>
            {waterError && <p className="ember-inline-error" role="alert">{waterError}</p>}
          </article>

          <article className="ember-panel ember-macro-card" data-tutorial-id="dashboard-nutrition-progress">
            <div className="ember-panel-heading">
              <p className="ember-panel-label">Macros</p>
              <Link href="/dashboard/nutrition">Details ›</Link>
            </div>
            <div className="ember-macro-list">
              {macroProgress.rows.map((macro) => (
                <div className={`ember-macro-row ember-macro-${macro.key}`} key={macro.key}>
                  <span className="ember-macro-letter">{macro.label[0]}</span>
                  <div className="ember-macro-body">
                    <div><strong>{macro.label}</strong><span>{Math.round(macro.consumed)} / {Math.round(macro.target)}{macro.unit}</span></div>
                    <div className="ember-progress-track"><span style={{ width: `${macro.percent}%` }} /></div>
                  </div>
                  <div className="ember-macro-left"><strong>{macro.remaining}{macro.unit}</strong><span>left</span></div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/nutrition" className="ember-secondary-action">Log Food</Link>
          </article>
        </section>

        <section className="ember-execution-grid" aria-label="Today’s execution">
          <ExecutionCard kind="workout" label={workout.name} detail={workout.assigned ? workout.type : 'Recovery is assigned today'} complete={workout.executionComplete} cta={workout.assigned ? 'Open Workout' : 'View Today'} feedback={<WorkoutFeedback clientId={data.clientId} program="ember" assignedWorkoutId={String(engine.workoutDecision.plannedWorkout?.id||engine.workout.title)} workoutTitle={engine.workout.title} workoutHref="/dashboard/program/ember/workout" />} />
          <ExecutionCard kind="assessment" label={assessment.label} detail="Track and optimize" complete={assessment.executionComplete} cta="Start Assessment" />
          <ExecutionCard kind="recovery" label={data.recovery.label} detail="Fast body check" complete={!data.recovery.required || data.recovery.completed} cta="Log Now" />
        </section>

        <section className="ember-panel ember-today-progress">
          <div className="ember-panel-heading">
            <p className="ember-panel-label">Today&apos;s Progress</p>
            <span className="ember-flame-copy">{score}% · {flame.label} {flame.icon}</span>
          </div>
          <div className="ember-pillar-grid">
            <div><span className="ember-pillar-ring pillar-water">◆</span><strong>Water</strong><small>{hydration.percent}%</small></div>
            <div><span className="ember-pillar-ring pillar-food">Ψ</span><strong>Nutrition</strong><small>{macroProgress.percent}%</small></div>
            <div><span className="ember-pillar-ring pillar-workout">↟</span><strong>Workout</strong><small>{workout.executionComplete ? 'Complete' : 'Open'}</small></div>
            <div><span className="ember-pillar-ring pillar-assessment">✓</span><strong>Assessment</strong><small>{assessment.executionComplete ? 'Complete' : 'Open'}</small></div>
          </div>
        </section>

        <DashboardProgressLinks />

        <StreakRequirementsCard flame={engine.flameState}/>
        <nav className="ember-bottom-nav" aria-label="Ember dashboard navigation">
          <Link href="/dashboard/program/ember" className="active"><span>⌂</span>Today</Link>
          <Link href="/dashboard/program/ember/workout"><span>↟</span>Workout</Link>
          <Link href="/dashboard/nutrition"><span>Ψ</span>Nutrition</Link>
          <div className="ember-nav-flame" aria-label={`${score}% daily execution`}><span>{flame.icon}</span><small>{score}%</small></div>
          <Link href="/dashboard/recovery"><span>♥</span>Recovery</Link>
          <Link href="/dashboard/assessment"><span>✓</span>Assess</Link>
          <DashboardMoreMenu program="ember" />
        </nav>
      </div>
    </main>
  )
}
