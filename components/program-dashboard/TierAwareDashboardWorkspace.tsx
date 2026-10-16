'use client'

import Link from 'next/link'
import { mealEntryHref, WATER_ENTRY_HREF } from '@/lib/nutrition/loggingRoutes'
import GuidedToday from '@/components/program-dashboard/GuidedToday'
import DailyDisplayPreferences from '@/components/DailyDisplayPreferences'
import { useViewPreference } from '@/components/dashboard/useViewPreference'
import { buildDailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { getDailyTraining } from '@/lib/dashboard/dailyTraining'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { formatLocalTime } from '@/lib/schedule/time'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { getTierCapabilities, type ProgramTier } from '@/lib/entitlements'
import { getIgniteDashboardData } from '@/lib/dashboard/ignite/getIgniteDashboardData'
import { getPhoenixDashboardData } from '@/lib/dashboard/phoenix/getPhoenixDashboardData'
import dynamic from 'next/dynamic'
import OptionalDashboardModule from '@/components/OptionalDashboardModule'
import type { PlanBlock } from './dashboardWorkspaceTypes'
import { getStrengthAssessmentDetail } from '@/lib/assessment/getStrengthAssessmentStatus'

const DashboardCalendar = dynamic(() => import('./DashboardCalendar'), {
  loading: () => <p role="status">Loading calendar details…</p>,
})
type PanelTab = 'progress' | 'assessments' | 'trends'

function eventRange(event: ScheduleEvent, timezone: string) {
  if (event.all_day) return 'All day'
  return `${formatLocalTime(event.adjusted_start_at || event.start_at, timezone)}-${formatLocalTime(event.adjusted_end_at || event.end_at, timezone)}`
}

function progressPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function buildPlanBlocks(tier: ProgramTier, logic: ProgramLogicOutput): PlanBlock[] {
  if (tier === 'phoenix') {
    return getPhoenixDashboardData(logic, 'Personalized').plan.map((block) => ({
      ...block,
      tasks: block.tasks.map((task) => ({ ...task, detail: task.detail })),
    }))
  }
  if (tier === 'ignite') return getIgniteDashboardData(logic).plan

  return [
    {
      id: 'morning',
      title: 'Morning',
      focus: 'Hydrate + fuel',
      tasks: [
        { id: 'ember-morning-water', label: 'Build hydration momentum', href: WATER_ENTRY_HREF, complete: logic.hydration.percent >= 35 },
        { id: 'ember-morning-macros', label: 'Add macros', href: '/dashboard/nutrition', complete: logic.execution.nutritionLogged },
        { id: 'ember-morning-checkin', label: 'Daily check-in', href: '/dashboard/check-in', complete: logic.assessments.dailyCompleted },
      ],
    },
    {
      id: 'midday',
      title: 'Midday',
      focus: 'Stay steady',
      tasks: [
        { id: 'ember-midday-protein', label: 'Review protein target', href: '/dashboard/nutrition', complete: logic.nutrition.protein.percent >= 60 },
        { id: 'ember-midday-water', label: 'Add water', href: WATER_ENTRY_HREF, complete: logic.hydration.percent >= 65 },
      ],
    },
    {
      id: 'evening',
      title: 'Evening',
      focus: 'Training + recovery',
      tasks: [
        { id: 'ember-evening-workout', label: getDailyTraining(logic).label, href: '/dashboard/program/ember/workout', complete: logic.execution.workoutComplete },
        { id: 'ember-evening-recovery', label: 'Recovery check', href: '/dashboard/recovery', complete: logic.execution.recoveryComplete },
      ],
    },
  ]
}

function MetricRing({
  label,
  value,
  detail,
  href,
  tutorialId,
  tone,
}: {
  label: string
  value: number
  detail: string
  href?: string
  tutorialId?: string
  tone?: 'action' | 'recovery'
}) {
  const percent = progressPercent(value)
  const className = `tier-metric-card${percent >= 100 ? ' is-complete' : ''}${tone === 'recovery' ? ' is-recovery' : ''}`
  const ring = (
    <div className="tier-metric-ring" style={{ '--tier-progress': `${percent * 3.6}deg` } as CSSProperties}>
      <strong>{percent}%</strong>
    </div>
  )
  const content = (
    <>
      {ring}
      <span>{label}</span>
      <small>{detail}</small>
    </>
  )
  return href ? <Link href={href} className={className} data-tutorial-id={tutorialId}>{content}</Link> : <article className={className} data-tutorial-id={tutorialId}>{content}</article>
}

function CycleSummary({ logic }: { logic: ProgramLogicOutput }) {
  const day = logic.cycle.day
  if (!logic.cycle.enabled || !day) {
    return (
      <Link href="/dashboard/cycle" className="tier-metric-card" data-testid="cycle-tracker">
        <div className="tier-metric-ring is-empty"><strong>--</strong></div>
        <span>Cycle</span>
        <small>Track your cycle</small>
      </Link>
    )
  }
  const cycleLength = 28
  const progress = progressPercent((day / cycleLength) * 100)
  return (
    <Link href="/dashboard/cycle" className="tier-metric-card" data-testid="cycle-tracker">
      <div className="tier-metric-ring is-cycle" style={{ '--tier-progress': `${progress * 3.6}deg` } as CSSProperties}><strong>Day {day}</strong></div>
      <span>{logic.cycle.phase ? logic.cycle.phase.replaceAll('_', ' ') : 'Cycle'}</span>
      <small>{logic.cycle.insight || logic.cycle.recoveryAdjustment}</small>
    </Link>
  )
}

function MacroRows({ logic, tier }: { logic: ProgramLogicOutput; tier: ProgramTier }) {
  const rows = [
    logic.nutrition.protein,
    logic.nutrition.carbs,
    logic.nutrition.fats,
    ...(tier === 'ember' ? [logic.nutrition.calories] : []),
  ]
  const labels = ['Protein', 'Carbs', 'Fats', 'Calories']
  return (
    <div className="tier-macro-compact" data-tutorial-id="dashboard-nutrition-progress">
      <div className="tier-compact-heading"><span>Macro Targets</span><Link href={mealEntryHref(tier)}>{tier === 'ember' ? 'Add macros' : 'Log meal'}</Link></div>
      {rows.map((macro, index) => (
        <div className="tier-macro-row" key={labels[index]}>
          <span>{labels[index]}</span>
          <div><i style={{ width: `${progressPercent(macro.percent)}%` }} /></div>
          <small>{Math.round(macro.consumed)} / {Math.round(macro.target)}{labels[index] === 'Calories' ? ' cal' : 'g'}</small>
        </div>
      ))}
    </div>
  )
}

export function ProgressTab({ logic, tier }: { logic: ProgramLogicOutput; tier: ProgramTier }) {
  const nutritionPercent = Math.round((logic.nutrition.protein.percent + logic.nutrition.carbs.percent + logic.nutrition.fats.percent) / 3)
  return (
    <div className="tier-progress-layout">
      <div className="tier-metric-grid" data-testid="dashboard-daily-actions">
        <MetricRing label="Hydration" value={logic.hydration.percent} detail={`${Math.round(logic.hydration.consumed)} / ${Math.round(logic.hydration.target)} oz`} href={WATER_ENTRY_HREF} tutorialId="dashboard-water-progress" />
        <MetricRing label={tier === 'ember' ? 'Macros' : 'Nutrition'} value={nutritionPercent} detail={logic.execution.nutritionLogged ? 'Logged today' : 'Ready to log'} href={mealEntryHref(tier)} />
        <MetricRing label="Workout" value={logic.execution.workoutComplete ? 100 : 0} detail={logic.execution.workoutInProgress ? 'Session saved · continue when ready' : `${getDailyTraining(logic).label} · ${logic.workout.title}`} href={`/dashboard/program/${tier}/workout`} />
        <MetricRing label="Check-In" value={logic.assessments.dailyCompleted ? 100 : 0} detail={logic.assessments.dailyCompleted ? 'Complete' : 'Open'} href="/dashboard/check-in" tutorialId="dashboard-daily-checkin" />
        <MetricRing label="Recovery" value={logic.execution.recoveryComplete ? 100 : 0} detail={logic.execution.recoveryComplete ? 'Complete' : 'Available'} href="/dashboard/recovery" tone="recovery" />
        <CycleSummary logic={logic} />
      </div>
      <MacroRows logic={logic} tier={tier} />
    </div>
  )
}

export function AssessmentsTab({ logic, capabilities }: { logic: ProgramLogicOutput; capabilities: ReturnType<typeof getTierCapabilities> }) {
  const postureCopy = capabilities.postureAssessment
    ? 'Posture landmark assessment available'
    : 'Progress photos available'
  const bodyAssessment = logic.assessments.body
  const strengthAssessment = logic.assessments.strength
  const bodyAssessmentDetail = bodyAssessment.inProgress
    ? 'Continue'
    : bodyAssessment.dueKind === 'none'
      ? `Next check-in in ${bodyAssessment.daysUntilNext} day${bodyAssessment.daysUntilNext === 1 ? '' : 's'}`
      : bodyAssessment.structuralDue
        ? 'Monthly measurements and structural lengths'
        : 'Monthly regional measurements'
  return (
    <div className="tier-assessment-grid" data-testid="dashboard-assessments-tab">
      <Link href={bodyAssessment.href} title="Measurements" data-tutorial-id="dashboard-body-assessment"><span>Body Assessment</span><strong>{bodyAssessment.title}</strong><small>{bodyAssessmentDetail}</small></Link>
      <Link href="/dashboard/assessment/photos" data-tutorial-id="dashboard-progress-photos"><span>Progress Photos</span><strong>{logic.progress.photoUrls.length ? `${logic.progress.photoUrls.length} saved` : 'Available'}</strong><small>{logic.progress.photosDue ? 'Photo update available' : 'History available'}</small></Link>
      <Link href="/dashboard/assessment/photos"><span>Assessment Photos</span><strong>Available</strong><small>{postureCopy}</small></Link>
      <Link href={strengthAssessment.href} data-tutorial-id="dashboard-strength-assessment"><span>Strength Assessment</span><strong>{strengthAssessment.label}</strong><small>{getStrengthAssessmentDetail(strengthAssessment, logic.client)}</small><span>{strengthAssessment.actionLabel}</span></Link>
      <Link href={capabilities.postureAssessment ? '/dashboard/assessment/photos?type=posture' : '/dashboard/assessment/photos'} aria-disabled={!capabilities.postureAssessment}><span>Posture Assessment</span><strong>{capabilities.postureAssessment ? 'Available' : 'Ignite/Phoenix'}</strong><small>{capabilities.postureAssessment ? 'Confirm landmarks before saving' : 'Not included in Ember'}</small></Link>
    </div>
  )
}

function TrendLine({ values }: { values: Array<number | null> }) {
  const points = values.map((value, index) => ({ value, index })).filter((point): point is { value: number; index: number } => point.value !== null)
  if (points.length < 2) return <span className="tier-no-trend">Keep logging to build this trend.</span>
  const raw = points.map((point) => point.value)
  const min = Math.min(...raw)
  const range = Math.max(...raw) - min || 1
  const coordinates = points.map((point) => `${(point.index / Math.max(1, values.length - 1)) * 100},${44 - ((point.value - min) / range) * 36}`).join(' ')
  return <svg className="tier-trend-line" viewBox="0 0 100 48" role="img"><polyline points={coordinates} /></svg>
}

export function TrendsTab({ logic }: { logic: ProgramLogicOutput }) {
  return (
    <div className="tier-trends-layout" data-testid="dashboard-trends-tab">
      {logic.trends.map((trend) => (
        <article key={trend.key}>
          <div><span>{trend.label}</span><strong>{trend.currentAverage === null ? 'No data' : `${Math.round(trend.currentAverage)}${trend.unit}`}</strong></div>
          <TrendLine values={trend.values} />
          <small>{trend.comparisonPercent === null ? 'Current history stays connected here.' : `${trend.comparisonPercent}% vs prior period`}</small>
        </article>
      ))}
    </div>
  )
}

export default function TierAwareDashboardWorkspace({
  tier,
  logic,
  schedule,
}: {
  tier: ProgramTier
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
  recipes?: PhoenixRecipe[]
}) {
  const [tab, setTab] = useViewPreference<PanelTab>(logic.client.id, 'home-panel', ['progress', 'assessments', 'trends'], 'progress')
  const [calendarExpanded, setCalendarExpanded] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const capabilities = getTierCapabilities(tier)
  const planBlocks = useMemo(() => buildPlanBlocks(tier, logic), [tier, logic])

  const plan = schedule.dailyRecommendation || buildDailyRecommendation(logic, schedule)
  const quiet = schedule.preferences?.carouselStyle === 'step'
  const flexible = schedule.preferences?.executionStyle === 'flow'
  const overdueIds = new Set(schedule.overdueEvents.map(event => event.id))
  const preview = schedule.events.filter(event => !['cancelled','skipped'].includes(event.status) &&
    (new Date(event.adjusted_end_at || event.end_at) > new Date(schedule.now) || overdueIds.has(event.id))).slice(0, 3)
  return (
    <section className="tier-dashboard-workspace daily-home" data-tier={tier} data-quiet={quiet}>
      <GuidedToday key={`${logic.client.id}:${schedule.date}`} logic={logic} schedule={schedule} />
      <details className="daily-disclosure" data-tutorial-id="dashboard-calendar"><summary>Your schedule at a glance</summary><SchedulePreview preview={preview} flexible={flexible} schedule={schedule} logic={logic} plan={plan} /></details>
      <DailyDisplayPreferences {...schedule.preferences} />
      <details className="daily-disclosure" id="progress" onToggle={event => {
        const open = event.currentTarget.open
        setDetailsExpanded(open)
        if (!open) setCalendarExpanded(false)
      }}><summary>Progress, assessments, and details</summary>
        {detailsExpanded ? <>
        <div className="tier-tab-list" aria-label="Dashboard information">
          {(['progress', 'assessments', 'trends'] as PanelTab[]).map(item => <button key={item} type="button" aria-pressed={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        {tab === 'progress' ? <ProgressTab logic={logic} tier={tier} /> : tab === 'assessments' ? <AssessmentsTab logic={logic} capabilities={capabilities} /> : <TrendsTab logic={logic} />}
        <details onToggle={event => setCalendarExpanded(event.currentTarget.open)}><summary>Detailed calendar</summary>{calendarExpanded ? <OptionalDashboardModule name="Calendar preview" href="/dashboard/schedule"><DashboardCalendar schedule={schedule} planBlocks={planBlocks} clientId={logic.client.id} /></OptionalDashboardModule> : null}</details>
        </> : null}
      </details>
    </section>
  )
}
function SchedulePreview({ preview, flexible, schedule, logic, plan }: { preview: ScheduleEvent[]; flexible: boolean; schedule: DailyScheduleState; logic: ProgramLogicOutput; plan: ReturnType<typeof buildDailyRecommendation> }) {
    return <div className="daily-preview">
      <section aria-label="Schedule preview"><div className="tier-panel-heading"><h2>{flexible ? 'Room for your day' : 'Coming up'}</h2><Link href="/dashboard/schedule">Schedule</Link></div>
        {preview.length ? preview.map(event => <Link key={event.id} href={event.suggested ? `/dashboard/schedule#event-${event.id}` : getActionRouteForEvent(event, schedule.program || logic.program)}><time>{eventRange(event, schedule.timezone)}</time><strong>{event.title}</strong><small>{event.source_label || (event.source === 'external_calendar' ? event.external_calendar_source || 'Connected calendar' : 'Anastasis')} · {event.status === 'completed' ? 'Done' : schedule.overdueEvents.some(item => item.id === event.id) ? 'Overdue · review in Schedule' : event.suggested ? 'Suggested time · choose in Schedule' : event.flexibility_type === 'fixed' ? 'Fixed commitment' : 'Flexible'}</small></Link>) : <p>No more scheduled items. Leave this space open.</p>}
      </section>
      <section aria-label="Progress summary"><h2>Your recorded progress</h2><p>{logic.assessments.dailyCompleted ? 'Check-in saved.' : 'Check-in available.'} {logic.execution.workoutComplete ? `Completed workout recorded${logic.execution.completedWorkoutTitle ? `: ${logic.execution.completedWorkoutTitle}` : ' today'}.` : logic.execution.workoutInProgress ? 'A partial workout is saved. Continue when ready.' : 'No completed workout recorded today.'}</p><p>{logic.program === 'ember' ? 'Nutrition guidance is available. Meal intake is not tracked in EMBER.' : plan.evidence.food === 'not_logged' ? 'Food not logged yet.' : plan.evidence.food === 'partial' ? 'Food partly logged.' : 'Food logged today.'} {plan.evidence.water === 'not_logged' ? 'Water not logged yet.' : `${Math.round(logic.hydration.consumed)} oz water logged.`}</p></section>
    </div>
  }
