'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import type { IgniteDashboardData, IgniteTrend } from '@/lib/dashboard/ignite/types'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import { getIgniteDashboardData } from '@/lib/dashboard/ignite/getIgniteDashboardData'
import { useProgramLogicEngine } from '@/components/program-dashboard/logic/hooks'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'
import StreakRequirementsCard from '@/components/program-dashboard/StreakRequirementsCard'
import WorkoutFeedback from '@/components/workout-feedback/WorkoutFeedback'
import {
  useAssessmentStatus,
  useClientDashboardData,
  useCyclePhase,
  useFlameState,
  useIgniteInsight,
  useMacroProgress,
  useProgressSnapshot,
  useRecoveryCheck,
  useTodayPlan,
  useTodayWorkout,
  useWeeklyTrends,
} from '@/components/program-dashboard/ignite/hooks'

function greeting() {
  return 'Good Morning'
}

function momentum(score: number) {
  if (score === 100) return 'Day complete. Let the work count.'
  if (score >= 75) return 'Strong momentum. Close the final loops.'
  if (score >= 50) return 'Keep the momentum going. Your next choice matters.'
  if (score >= 25) return 'The flame is building. Complete the next clear action.'
  return 'Start with one action. Momentum follows execution.'
}

function Ring({ value, icon, label, detail }: { value: number; icon: string; label: string; detail: string }) {
  return (
    <div className="ignite-ring-item">
      <div className="ignite-ring" style={{ '--ring-progress': `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as CSSProperties}>
        <span aria-hidden="true">{icon}</span>
      </div>
      <strong>{label}</strong><small>{detail}</small>
    </div>
  )
}

function HydrationRing({
  value,
  consumed,
  target,
  clientId,
}: {
  value: number
  consumed: number
  target: number
  clientId: string
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [waterOunces, setWaterOunces] = useState(8)
  const [addingWater, setAddingWater] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function addWater() {
    setAddingWater(true)
    setMessage('')

    try {
      const response = await fetch('/api/nutrition/add-water', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          ounces: waterOunces,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage(payload?.error || 'Water could not be saved.')
        return
      }

      setWaterOunces(8)
      setOpen(false)
      router.refresh()
    } catch {
      setMessage('Water could not be saved.')
    } finally {
      setAddingWater(false)
    }
  }

  const safeValue = Math.max(0, Math.min(100, value))

  return (
    <div
      ref={containerRef}
      className="ignite-ring-item"
      style={{ position: 'relative' }}
    >
      <button
        type="button"
        onClick={() => {
          setMessage('')
          setOpen((current) => !current)
        }}
        aria-label={`Water: ${Math.round(consumed)} of ${Math.round(
          target
        )} ounces. Add water.`}
        aria-expanded={open}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 0,
          color: 'inherit',
          padding: 0,
          margin: 0,
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        <div
          className="ignite-ring"
          style={
            {
              '--ring-progress': `${safeValue * 3.6}deg`,
            } as CSSProperties
          }
        >
          <span aria-hidden="true">◈</span>
        </div>

        <strong>Water</strong>

        <small>
          {Math.round(consumed)} / {Math.round(target)} oz
        </small>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Add water"
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 12px)',
            left: '70%',
            transform: 'translateX(-35%)',
            width: 'min(290px, 82vw)',
            padding: '18px',
            borderRadius: '20px',
            background:
  'linear-gradient(180deg, rgba(34,22,18,.98) 0%, rgba(22,16,14,.98) 100%)',

border: '1px solid rgba(168,88,50,.35)',

boxShadow:
  '0 20px 50px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.03)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '14px',
            }}
          >
            <strong>Add Water</strong>
            <span>{waterOunces} oz</span>
          </div>

          <input
            type="range"
            min="4"
            max="64"
            step="4"
            value={waterOunces}
            onChange={(event) =>
              setWaterOunces(Number(event.target.value))
            }
            disabled={addingWater}
            aria-label="Ounces of water to add"
            style={{
              width: '100%',
              cursor: addingWater ? 'not-allowed' : 'pointer',
              accentColor: '#a85832',
              opacity: addingWater ? 0.6 : 1,
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '6px',
              marginBottom: '14px',
              fontSize: '0.8rem',
              opacity: 0.75,
            }}
          >
            <span>4 oz</span>
            <span>64 oz</span>
          </div>

          <button
            type="button"
            onClick={addWater}
            disabled={addingWater}
            className="ignite-button"
            style={{
              width: '100%',
              cursor: addingWater ? 'not-allowed' : 'pointer',
              opacity: addingWater ? 0.65 : 1,
            }}
          >
            {addingWater ? 'Adding…' : `Add ${waterOunces} oz`}
          </button>

          {message && (
            <p
              role="status"
              style={{
                margin: '12px 0 0',
                fontSize: '0.85rem',
              }}
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Sparkline({ trend }: { trend: IgniteTrend }) {
  const points = trend.values.map((value, index) => ({ value, index })).filter((point): point is { value: number; index: number } => point.value !== null)
  if (points.length < 2) return <span className="ignite-no-trend">Not enough data</span>
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const coordinates = points.map((point) => `${(point.index / 6) * 100},${34 - ((point.value - min) / range) * 28}`).join(' ')
  return <svg className="ignite-sparkline" viewBox="0 0 100 38" role="img" aria-label={`${trend.label} seven-day trend`}><polyline points={coordinates} /></svg>
}

export default function IgniteDashboard({ logic }: { logic: ProgramLogicOutput }) {
  const engine = useProgramLogicEngine(logic)
  const initialData: IgniteDashboardData = getIgniteDashboardData(engine)
  const data = useClientDashboardData(initialData)
  const macros = useMacroProgress(data.macros)
  const plan = useTodayPlan(data.clientId, data.plan)
  const workout = useTodayWorkout(data.workout)
  const assessment = useAssessmentStatus(data.assessment)
  const recovery = useRecoveryCheck(data.recovery)
  const cycle = useCyclePhase(data.cycle)
  const trends = useWeeklyTrends(data.trends)
  const progress = useProgressSnapshot(data.progress)
  const hydrationPercent = Math.min(100, Math.round((data.water.consumed / Math.max(1, data.water.target)) * 100))
  const executionScore = engine.flameState.dailyScore
  const flame = useFlameState(executionScore)
  const trendWithComparison = trends.find((trend) => trend.comparisonPercent !== null)
  const insight = useIgniteInsight({
    baseInsight: data.baseInsight,
    hydration: hydrationPercent,
    nutrition: macros.percent,
    workoutComplete: workout.executionComplete,
    recoveryComplete: recovery.completed,
    cyclePhase: cycle.phase,
    weeklyTrend: trendWithComparison
      ? { label: trendWithComparison.label, comparisonPercent: trendWithComparison.comparisonPercent! }
      : null,
  })

  return (
    <main className="ignite-dashboard" style={{ '--ignite-intensity': flame.intensity } as CSSProperties}>
      <div className="ignite-shell">
        <header className="ignite-header">
          <div className="ignite-brand"><span aria-hidden="true">🔥</span><div><strong>IGNITE</strong><small>Focused. Intentional. Progressing.</small></div></div>
          <div className="ignite-greeting"><h1>{greeting()}, {data.clientName} {flame.icon}</h1><p>You&apos;ve got this. One choice at a time.</p></div>
          <div className="ignite-streak"><span>{flame.icon}</span><strong>{data.streak}</strong><small>Day streak</small></div>
        </header>

        <section className="ignite-top-grid">
          <article className="ignite-panel ignite-daily-progress">
            <p className="ignite-label">Daily Progress ⓘ</p>
            <div className="ignite-rings">
              <HydrationRing
  value={hydrationPercent}
  consumed={data.water.consumed}
  target={data.water.target}
  clientId={data.clientId}
/>
              <Ring value={macros.percent} icon="Ψ" label="Nutrition" detail={`${macros.percent}%`} />
              <Ring value={workout.executionComplete ? 100 : 0} icon="↟" label="Workout" detail={workout.executionComplete ? 'Complete' : 'Open'} />
              <Ring value={assessment.completedPercent} icon="✓" label="Assessments" detail={`${assessment.completedPercent}%`} />
            </div>
            <div className="ignite-momentum"><span className="ignite-momentum-flame">{flame.icon}</span><div><strong>{momentum(executionScore)}</strong><p>{executionScore}% of today&apos;s execution complete.</p></div></div>
          </article>

          <article className="ignite-panel ignite-macros">
            <div className="ignite-heading"><p className="ignite-label">Macro Targets</p><Link href="/dashboard/nutrition">Details ›</Link></div>
            <div className="ignite-macro-list">
              {macros.rows.map((macro) => <div className={`ignite-macro ignite-${macro.key}`} key={macro.key}>
                <span className="ignite-macro-badge">{macro.key === 'calories' ? 'K' : macro.label[0]}</span>
                <div><p><strong>{macro.label}</strong><small>{Math.round(macro.consumed)} / {Math.round(macro.target)}{macro.unit}</small></p><div className="ignite-track"><span style={{ width: `${macro.percent}%` }} /></div></div>
                <p className="ignite-left"><strong>{macro.remaining}{macro.unit}</strong><small>left</small></p>
              </div>)}
            </div>
            <Link href="/dashboard/nutrition" className="ignite-button">Ψ Log Food</Link>
          </article>
        </section>

        <section className="ignite-plan-insight-grid">
          <article className="ignite-panel ignite-plan">
            <div className="ignite-heading"><p className="ignite-label">▣ Today&apos;s Plan</p><Link href="/dashboard/day/morning">View full plan ›</Link></div>
            <div className="ignite-plan-blocks">
              {plan.blocks.map((block) => <div className={`ignite-plan-block ignite-plan-${block.id}`} key={block.id}>
                <h3>{block.id === 'morning' ? '☀' : block.id === 'midday' ? '◆' : '◒'} {block.title}</h3><p>{block.focus}</p>
                <div className="ignite-task-list">{block.tasks.map((task) => task.autoTracked ?
                  <Link href={task.href} key={task.id} className={task.complete ? 'complete' : ''}><span>{task.complete ? '✓' : '○'}</span>{task.label}</Link> :
                  <button type="button" key={task.id} className={task.complete ? 'complete' : ''} onClick={() => plan.toggleTask(task.id)}><span>{task.complete ? '✓' : '○'}</span>{task.label}</button>
                )}</div>
                <Link href={`/dashboard/day/${block.id}`} className="ignite-block-action">Open {block.title}</Link>
              </div>)}
            </div>
          </article>

          <article id="ignite-insight" className="ignite-panel ignite-insight">
            <div className="ignite-heading"><p className="ignite-label">Today&apos;s Insight</p><span>{flame.icon}</span></div>
            <div className="ignite-insight-body"><strong>{insight}</strong><p>{recovery.readiness !== null ? `Readiness: ${recovery.readiness}%.` : 'Complete your recovery check to add readiness context.'}</p></div>
          </article>
        </section>

        <section className="ignite-action-grid">
          <article className="ignite-panel ignite-action-card"><div className="ignite-heading"><p className="ignite-label">↟ Today&apos;s Workout</p><WorkoutFeedback clientId={data.clientId} program="ignite" assignedWorkoutId={String(engine.workoutDecision.plannedWorkout?.id||engine.workout.title)} workoutTitle={engine.workout.title} workoutHref="/dashboard/program/ignite/workout" /></div><h3>{workout.title}</h3><p>{workout.type}{workout.durationMinutes ? ` · ${workout.durationMinutes} min` : ''}</p><Link href="/dashboard/program/ignite/workout" className="ignite-button">{workout.executionComplete ? 'Workout Complete ✓' : 'View Workout'}</Link></article>
          <article className="ignite-panel ignite-action-card"><p className="ignite-label">✓ Assessments</p><h3>{!assessment.dailyCompleted ? 'Daily Check-In' : assessment.monthlyDueCount ? 'Monthly Assessment Due' : 'Completed'}</h3><p>{assessment.dailyCompleted ? 'Daily complete' : 'Daily check-in open'}{assessment.monthlyDueCount ? ' · Monthly assessment due' : ''}</p><div className="ignite-mini-ring">{assessment.completedPercent}%</div><Link href={!assessment.dailyCompleted ? '/dashboard/check-in' : assessment.monthlyDueCount ? '/dashboard/assessment/monthly' : '/dashboard/check-in'} className="ignite-button">{!assessment.dailyCompleted ? 'Check In' : assessment.monthlyDueCount ? 'Continue Monthly' : 'View Check-In'}</Link></article>
          <article className="ignite-panel ignite-action-card"><p className="ignite-label">♥ Recovery Check</p><h3>{recovery.completed ? 'Check-in complete' : 'How are you feeling?'}</h3><p>Use today&apos;s signals to choose the right recovery action.</p><Link href="/dashboard/recovery" className="ignite-button">{recovery.completed ? 'View Recovery' : 'Open Recovery'}</Link></article>
          {cycle.enabled ? <article className="ignite-panel ignite-action-card ignite-cycle"><p className="ignite-label">Cycle Phase ⓘ</p><h3>{cycle.phase?.replace('_', ' ')}</h3><p>Day {cycle.day ?? '—'}</p><small>{cycle.recommendation}</small><Link href="/dashboard/cycle" className="ignite-button">View Cycle</Link></article> : <article className="ignite-panel ignite-action-card"><p className="ignite-label">Recovery Readiness</p><h3>{recovery.readiness !== null ? `${recovery.readiness}%` : 'Check-in open'}</h3><p>Log today&apos;s body signals to calculate readiness.</p><Link href="/dashboard/recovery" className="ignite-button">Open Recovery</Link></article>}
        </section>

        <section className="ignite-bottom-grid">
          <article className="ignite-panel ignite-trends"><div className="ignite-heading"><p className="ignite-label">Weekly Trend ⓘ</p><span>This week</span></div>
            {trends.map((trend) => <div className="ignite-trend-row" key={trend.key}><div><strong>{trend.label}</strong><small>{trend.currentAverage === null ? 'No data' : `${Math.round(trend.currentAverage)} ${trend.unit}`}</small></div><Sparkline trend={trend} /><span className={trend.comparisonPercent !== null && trend.comparisonPercent < 0 ? 'down' : ''}>{trend.comparisonPercent === null ? '—' : `${trend.comparisonPercent > 0 ? '+' : ''}${trend.comparisonPercent}%`}</span></div>)}
          </article>
          <article className="ignite-panel ignite-snapshot"><p className="ignite-label">Progress Snapshot ⓘ</p>
            <div className="ignite-snapshot-row"><div><strong>Weight</strong><span>{progress.weight === null ? 'Not logged' : `${progress.weight} lbs`}</span></div><small>{progress.weightChange === null ? 'No comparison' : `${progress.weightChange > 0 ? '+' : ''}${progress.weightChange} lbs`}</small></div>
            <div className="ignite-snapshot-row"><div><strong>Body fat</strong><span>{progress.bodyFat === null ? 'Not logged' : `${progress.bodyFat}%`}</span></div><small>{progress.bodyFatChange === null ? 'No comparison' : `${progress.bodyFatChange > 0 ? '+' : ''}${progress.bodyFatChange}%`}</small></div>
            <div className="ignite-photo-row"><div><strong>Photos</strong><span>{progress.photosDue ? 'Update due' : 'Progress updated'}</span></div><div className="ignite-thumbnails">{progress.photoUrls.map((url, index) => <img key={url} src={url} alt={`Progress view ${index + 1}`} loading="lazy" />)}{!progress.photoUrls.length && <span>No photos yet</span>}</div></div>
            <Link href="/dashboard/assessment/photos" className="ignite-button">{progress.photosDue ? 'Add Photos' : 'View Photos'}</Link>
          </article>
        </section>

        <StreakRequirementsCard flame={engine.flameState}/>
        <nav className="ignite-bottom-nav" aria-label="Ignite dashboard navigation">
          <Link href="/dashboard/program/ignite" className="active"><span>⌂</span>Dashboard</Link><Link href="/dashboard/day/morning"><span>▣</span>Plan</Link><div className="ignite-nav-flame" aria-label={`${executionScore}% daily execution`}><span aria-hidden="true">{flame.icon}</span><small>{executionScore}%</small></div><Link href="#ignite-insight"><span>▥</span>Insights</Link><DashboardMoreMenu program="ignite" />
        </nav>
      </div>
    </main>
  )
}
