'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { formatLocalTime } from '@/lib/schedule/time'
import { getTierCapabilities, type ProgramTier } from '@/lib/entitlements'
import { buildWhatsNextState, type WhatsNextState } from '@/lib/dashboard/whatsNext'
import { buildDailyInsight, type DailyInsight } from '@/lib/dashboard/dailyInsight'
import { getIgniteDashboardData } from '@/lib/dashboard/ignite/getIgniteDashboardData'
import { getPhoenixDashboardData } from '@/lib/dashboard/phoenix/getPhoenixDashboardData'
import {
  addDays,
  addMonths,
  buildCalendarItems,
  buildMonthGrid,
  buildWeekDays,
  itemsForDate,
  parseDateKey,
  toDateKey,
  type CalendarDisplayItem,
} from '@/lib/calendar/view'

type CalendarMode = 'day' | 'week' | 'month'
type PanelTab = 'progress' | 'assessments' | 'trends'
type Daypart = 'morning' | 'midday' | 'evening'
type PlanBlock = {
  id: Daypart
  title: string
  focus: string
  tasks: Array<{ id: string; label: string; href: string; complete: boolean; detail?: string }>
}

function eventRange(event: ScheduleEvent, timezone: string) {
  return `${formatLocalTime(event.adjusted_start_at || event.start_at, timezone)}-${formatLocalTime(event.adjusted_end_at || event.end_at, timezone)}`
}

function itemDaypart(item: CalendarDisplayItem): Daypart {
  const hour = new Date(item.start_at).getHours()
  if (hour < 11) return 'morning'
  if (hour < 17) return 'midday'
  return 'evening'
}

function WhatsNextCard({ state, timezone }: { state: WhatsNextState; timezone: string }) {
  const data = state.data as any
  return (
    <article className={`tier-whats-next-card tier-whats-next-${state.type}`} data-tutorial-id="dashboard-whats-next">
      <p className="tier-dashboard-label">What&apos;s Next</p>
      {state.startTime ? <span className="tier-dashboard-time">{formatLocalTime(state.startTime, timezone)}</span> : null}
      <h2>{state.title}</h2>
      {state.subtitle ? <p>{state.subtitle}</p> : null}

      {state.type === 'workout' && data?.exercises?.length ? (
        <ul className="tier-mini-list">
          {data.exercises.map((exercise: string) => <li key={exercise}>{exercise}</li>)}
        </ul>
      ) : null}

      {state.primaryAction ? (
        <div className="tier-action-row">
          <Link className="tier-primary-action" href={state.primaryAction.href}>{state.primaryAction.label}</Link>
          {state.secondaryActions?.map((action) => (
            <Link key={`${action.label}-${action.href}`} className="tier-secondary-action" href={action.href}>{action.label}</Link>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function DailyInsightCard({ insight }: { insight: DailyInsight }) {
  return (
    <article className={`tier-daily-insight tier-insight-${insight.category}`} data-tutorial-id="dashboard-daily-insight">
      <p className="tier-dashboard-label">Today&apos;s Insight</p>
      <p>{insight.message}</p>
      {insight.action ? (
        <Link href={insight.action.target} className="tier-secondary-action">{insight.action.label}</Link>
      ) : null}
    </article>
  )
}

function DashboardCalendar({
  schedule,
  planBlocks,
}: {
  schedule: DailyScheduleState
  planBlocks: PlanBlock[]
}) {
  const [mode, setMode] = useState<CalendarMode>('day')
  const [selectedDate, setSelectedDate] = useState(schedule.date)
  const [daypart, setDaypart] = useState<Daypart>('morning')
  const items = useMemo(() => buildCalendarItems(schedule.events, schedule.openWindows), [schedule.events, schedule.openWindows])
  const selectedItems = itemsForDate(items, selectedDate)
  const monthCells = buildMonthGrid({ selectedDate, items })
  const weekDays = buildWeekDays(selectedDate, items)
  const selectedPlanBlock = planBlocks.find((block) => block.id === daypart)
  const daypartItems = selectedItems.filter((item) => itemDaypart(item) === daypart)
  const showTodayPlan = selectedDate === schedule.date && Boolean(selectedPlanBlock)
  const itemTitles = new Set(daypartItems.map((item) => item.title.trim().toLowerCase()))
  const planTasks = showTodayPlan
    ? selectedPlanBlock!.tasks.filter((task) => !itemTitles.has(task.label.trim().toLowerCase()))
    : []

  function selectDate(date: string) {
    setSelectedDate(date)
    setMode('day')
  }

  function go(delta: number) {
    if (mode === 'month') setSelectedDate((current) => addMonths(current, delta))
    else if (mode === 'week') setSelectedDate((current) => addDays(current, delta * 7))
    else setSelectedDate((current) => addDays(current, delta))
  }

  function today() {
    setSelectedDate(toDateKey(new Date()))
  }

  const selected = parseDateKey(selectedDate)
  const heading =
    mode === 'month'
      ? selected.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : mode === 'week'
        ? `Week of ${parseDateKey(weekDays[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <section className="tier-calendar-panel" aria-label="Calendar" data-tutorial-id="dashboard-calendar">
      <div className="tier-panel-heading">
        <div>
          <p className="tier-dashboard-label">Calendar</p>
          <h2>{heading}</h2>
        </div>
        <div className="tier-segmented-control" role="tablist" aria-label="Calendar view">
          {(['day', 'week', 'month'] as CalendarMode[]).map((item) => (
            <button key={item} type="button" className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="tier-calendar-nav" aria-label="Calendar navigation">
        <button type="button" onClick={() => go(-1)}>Previous</button>
        <button type="button" onClick={today}>Today</button>
        <button type="button" onClick={() => go(1)}>Next</button>
      </div>

      {mode === 'month' ? (
        <div className="tier-month-calendar" data-testid="calendar-month-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="tier-month-weekday">{day}</span>)}
          {monthCells.map((cell) => (
            <button
              key={cell.date}
              type="button"
              className={`tier-month-cell${cell.inMonth ? '' : ' is-muted'}${cell.isSelected ? ' is-selected' : ''}${cell.isToday ? ' is-today' : ''}`}
              onClick={() => selectDate(cell.date)}
              aria-label={`Open ${cell.date}`}
            >
              <span>{cell.day}</span>
              {cell.items.length ? <strong>{cell.items.length}</strong> : null}
              <div>{cell.items.slice(0, 2).map((item) => <i key={item.id} data-source={item.source}>{item.suggested ? 'Suggested' : item.title}</i>)}</div>
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'week' ? (
        <div className="tier-week-calendar" data-testid="calendar-week-grid">
          {weekDays.map((day) => (
            <button
              key={day.date}
              type="button"
              className={`tier-week-day${day.date === selectedDate ? ' is-selected' : ''}${day.date === schedule.date ? ' is-today' : ''}`}
              onClick={() => selectDate(day.date)}
              aria-pressed={day.date === selectedDate}
            >
              <span>{day.label}</span>
              <strong>{parseDateKey(day.date).getDate()}</strong>
              <div>
                {day.items.length ? day.items.slice(0, 4).map((item) => (
                  <CalendarPill key={item.id} item={item} timezone={schedule.timezone} />
                )) : <small>Open</small>}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'day' ? (
        <div className="tier-day-calendar" data-testid="calendar-day-view">
          <div className="tier-daypart-control" role="tablist" aria-label="Day plan time">
            {(['morning', 'midday', 'evening'] as Daypart[]).map((item) => (
              <button key={item} type="button" className={daypart === item ? 'is-active' : ''} onClick={() => setDaypart(item)}>
                {item}
              </button>
            ))}
          </div>
          {daypartItems.length ? daypartItems.map((item) => (
            <CalendarPill key={item.id} item={item} timezone={schedule.timezone} detailed />
          )) : <p className="tier-calendar-empty">No scheduled items for this part of the day.</p>}
          {showTodayPlan ? (
            <div className="tier-daypart-plan" data-testid="calendar-daypart-plan">
              <div>
                <strong>{selectedPlanBlock!.title}</strong>
                <small>{selectedPlanBlock!.focus}</small>
              </div>
              {planTasks.length ? planTasks.map((task) => (
                <Link key={task.id} href={task.href} className={`tier-plan-task${task.complete ? ' is-complete' : ''}`}>
                  <span>{task.complete ? 'Done' : 'Planned'}</span>
                  <strong>{task.label}</strong>
                  {task.detail ? <small>{task.detail}</small> : null}
                </Link>
              )) : <p className="tier-calendar-empty">This part of the plan is already represented on the calendar.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
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
        { id: 'ember-morning-water', label: 'Build hydration momentum', href: '/dashboard/nutrition', complete: logic.hydration.percent >= 35 },
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
        { id: 'ember-midday-water', label: 'Add water', href: '/dashboard/nutrition', complete: logic.hydration.percent >= 65 },
      ],
    },
    {
      id: 'evening',
      title: 'Evening',
      focus: 'Training + recovery',
      tasks: [
        { id: 'ember-evening-workout', label: logic.workout.assigned ? 'Complete workout' : 'Recovery day', href: '/dashboard/program/ember/workout', complete: logic.execution.workoutComplete },
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
      <div className="tier-compact-heading"><span>Macro Targets</span><Link href="/dashboard/nutrition">{tier === 'ember' ? 'Add macros' : 'Log meal'}</Link></div>
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

function ProgressTab({ logic, tier }: { logic: ProgramLogicOutput; tier: ProgramTier }) {
  const nutritionPercent = Math.round((logic.nutrition.protein.percent + logic.nutrition.carbs.percent + logic.nutrition.fats.percent) / 3)
  return (
    <div className="tier-progress-layout">
      <div className="tier-metric-grid" data-testid="dashboard-daily-actions">
        <MetricRing label="Hydration" value={logic.hydration.percent} detail={`${Math.round(logic.hydration.consumed)} / ${Math.round(logic.hydration.target)} oz`} href="/dashboard/nutrition" tutorialId="dashboard-water-progress" />
        <MetricRing label={tier === 'ember' ? 'Macros' : 'Nutrition'} value={nutritionPercent} detail={logic.execution.nutritionLogged ? 'Logged today' : 'Ready to log'} href="/dashboard/nutrition" />
        <MetricRing label="Workout" value={logic.execution.workoutComplete ? 100 : 0} detail={logic.workout.assigned ? logic.workout.title : 'Recovery day'} href={`/dashboard/program/${tier}/workout`} />
        <MetricRing label="Check-In" value={logic.assessments.dailyCompleted ? 100 : 0} detail={logic.assessments.dailyCompleted ? 'Complete' : 'Open'} href="/dashboard/check-in" tutorialId="dashboard-daily-checkin" />
        <MetricRing label="Recovery" value={logic.execution.recoveryComplete ? 100 : 0} detail={logic.execution.recoveryComplete ? 'Complete' : 'Available'} href="/dashboard/recovery" tone="recovery" />
        <CycleSummary logic={logic} />
      </div>
      <MacroRows logic={logic} tier={tier} />
    </div>
  )
}

function AssessmentsTab({ logic, capabilities }: { logic: ProgramLogicOutput; capabilities: ReturnType<typeof getTierCapabilities> }) {
  const postureCopy = capabilities.postureAssessment
    ? 'Posture landmark assessment available'
    : 'Progress photos available'
  return (
    <div className="tier-assessment-grid" data-testid="dashboard-assessments-tab">
      <Link href="/dashboard/assessment/photos" data-tutorial-id="dashboard-progress-photos"><span>Progress Photos</span><strong>{logic.progress.photoUrls.length ? `${logic.progress.photoUrls.length} saved` : 'Available'}</strong><small>{logic.progress.photosDue ? 'Photo update available' : 'History available'}</small></Link>
      <Link href="/dashboard/assessment/photos"><span>Assessment Photos</span><strong>Available</strong><small>{postureCopy}</small></Link>
      <Link href="/dashboard/assessment/start" data-tutorial-id="dashboard-strength-assessment"><span>Strength Assessment</span><strong>{logic.assessments.monthlyDueCount ? 'Due' : 'Current'}</strong><small>Functional progress history</small></Link>
      <Link href="/dashboard/assessment/measurements" data-tutorial-id="dashboard-measurements"><span>Measurements</span><strong>{logic.progress.weight ?? 'Ready'}</strong><small>Body measurements and trends</small></Link>
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

function TrendsTab({ logic }: { logic: ProgramLogicOutput }) {
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

function CalendarPill({
  item,
  timezone,
  detailed = false,
}: {
  item: CalendarDisplayItem
  timezone: string
  detailed?: boolean
}) {
  return (
    <article className={`tier-calendar-pill source-${item.source}${item.suggested ? ' is-suggestion' : ''}`}>
      <time>{formatLocalTime(item.start_at, timezone)}</time>
      <strong>{item.title}</strong>
      {detailed ? (
        <>
          <small>{item.event_type.replaceAll('_', ' ')} · {item.source.replaceAll('_', ' ')}</small>
          {item.suggested ? (
            <div className="tier-suggestion-actions">
              <Link href="/dashboard/schedule">Schedule</Link>
              <Link href="/dashboard/schedule">Dismiss</Link>
            </div>
          ) : item.event ? (
            <small>{eventRange(item.event, timezone)} · {item.status}</small>
          ) : null}
        </>
      ) : null}
    </article>
  )
}

export default function TierAwareDashboardWorkspace({
  tier,
  logic,
  schedule,
  recipes = [],
}: {
  tier: ProgramTier
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
  recipes?: PhoenixRecipe[]
}) {
  const [tab, setTab] = useState<PanelTab>('progress')
  const capabilities = getTierCapabilities(tier)
  const whatsNext = useMemo(
    () => buildWhatsNextState({ tier, capabilities, logic, schedule, recipes }),
    [tier, capabilities, logic, schedule, recipes],
  )
  const dailyInsight = useMemo(
    () => buildDailyInsight({ tier, logic, schedule }),
    [tier, logic, schedule],
  )
  const planBlocks = useMemo(() => buildPlanBlocks(tier, logic), [tier, logic])

  return (
    <section className="tier-dashboard-workspace" data-tier={tier}>
      <DailyInsightCard insight={dailyInsight} />
      <div className="tier-dashboard-row">
        <DashboardCalendar schedule={schedule} planBlocks={planBlocks} />
        <WhatsNextCard state={whatsNext} timezone={schedule.timezone} />
      </div>

      <section className="tier-info-panel" data-tutorial-id="dashboard-progress-area">
        <div className="tier-tab-list" role="tablist" aria-label="Dashboard information">
          {(['progress', 'assessments', 'trends'] as PanelTab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'progress' ? (
          <ProgressTab logic={logic} tier={tier} />
        ) : null}

        {tab === 'assessments' ? (
          <AssessmentsTab logic={logic} capabilities={capabilities} />
        ) : null}

        {tab === 'trends' ? (
          <TrendsTab logic={logic} />
        ) : null}
      </section>
    </section>
  )
}
