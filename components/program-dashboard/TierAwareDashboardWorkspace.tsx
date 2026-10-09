'use client'

import Link from 'next/link'
import DailyPlanCard from '@/components/DailyPlanCard'
import DailyDisplayPreferences from '@/components/DailyDisplayPreferences'
import { buildDailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { getLocalDaypart, getLocalMinutes } from '@/lib/timezone'
import type { CSSProperties } from 'react'
import { useEffect,useMemo, useState } from 'react'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { formatLocalTime } from '@/lib/schedule/time'
import { getTierCapabilities, type ProgramTier } from '@/lib/entitlements'
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

function itemDaypart(item: CalendarDisplayItem, timezone: string): Daypart {
  const hour = getLocalMinutes(new Date(item.start_at), timezone) / 60
  if (hour < 11) return 'morning'
  if (hour < 17) return 'midday'
  return 'evening'
}

function DashboardCalendar({
  schedule,
  planBlocks,
}: {
  schedule: DailyScheduleState
  planBlocks: PlanBlock[]
}) {
  const [dateExplicit,setDateExplicit]=useState(false);const [segmentExplicit,setSegmentExplicit]=useState(false)
  const [mode, setMode] = useState<CalendarMode>('day')
  const [selectedDate, setSelectedDate] = useState(schedule.date)
  const [daypart, setDaypart] = useState<Daypart>(() => getLocalDaypart(new Date(schedule.now), schedule.timezone))
  useEffect(()=>{if(!dateExplicit)setSelectedDate(schedule.date);if(!segmentExplicit&&!dateExplicit)setDaypart(getLocalDaypart(new Date(schedule.now),schedule.timezone))},[schedule.date,schedule.now,schedule.timezone,dateExplicit,segmentExplicit])
  const items = useMemo(() => buildCalendarItems(schedule.events, schedule.openWindows, schedule.timezone), [schedule.events, schedule.openWindows, schedule.timezone])
  const selectedItems = itemsForDate(items, selectedDate)
  const monthCells = buildMonthGrid({ selectedDate, items, today: schedule.date })
  const weekDays = buildWeekDays(selectedDate, items)
  const selectedPlanBlock = planBlocks.find((block) => block.id === daypart)
  const daypartItems = selectedItems.filter((item) => itemDaypart(item, schedule.timezone) === daypart)
  const showTodayPlan = selectedDate === schedule.date && Boolean(selectedPlanBlock)
  const itemTitles = new Set(daypartItems.map((item) => item.title.trim().toLowerCase()))
  const planTasks = showTodayPlan
    ? selectedPlanBlock!.tasks.filter((task) => !itemTitles.has(task.label.trim().toLowerCase()))
    : []

  function selectDate(date: string) {
    setDateExplicit(true)
    setSelectedDate(date)
    setMode('day')
  }

  function go(delta: number) {
    setDateExplicit(true)
    if (mode === 'month') setSelectedDate((current) => addMonths(current, delta))
    else if (mode === 'week') setSelectedDate((current) => addDays(current, delta * 7))
    else setSelectedDate((current) => addDays(current, delta))
  }

  function today() {
    setDateExplicit(false)
    setSelectedDate(schedule.date)
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
              <button key={item} type="button" className={daypart === item ? 'is-active' : ''} onClick={() => {setSegmentExplicit(true);setDaypart(item)}}>
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

export function ProgressTab({ logic, tier }: { logic: ProgramLogicOutput; tier: ProgramTier }) {
  const nutritionPercent = Math.round((logic.nutrition.protein.percent + logic.nutrition.carbs.percent + logic.nutrition.fats.percent) / 3)
  return (
    <div className="tier-progress-layout">
      <div className="tier-metric-grid" data-testid="dashboard-daily-actions">
        <MetricRing label="Hydration" value={logic.hydration.percent} detail={`${Math.round(logic.hydration.consumed)} / ${Math.round(logic.hydration.target)} oz`} href="/dashboard/nutrition" tutorialId="dashboard-water-progress" />
        <MetricRing label={tier === 'ember' ? 'Macros' : 'Nutrition'} value={nutritionPercent} detail={logic.execution.nutritionLogged ? 'Logged today' : 'Ready to log'} href="/dashboard/nutrition" />
        <MetricRing label="Workout" value={logic.execution.workoutComplete ? 100 : 0} detail={logic.execution.workoutInProgress ? 'Session saved · continue when ready' : logic.workout.assigned ? logic.workout.title : 'Recovery day'} href={`/dashboard/program/${tier}/workout`} />
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
      <Link href="/dashboard/assessment/start" data-tutorial-id="dashboard-strength-assessment"><span>Strength Assessment</span><strong>{logic.assessments.monthlyDueCount ? 'Due' : 'Current'}</strong><small>Functional progress history</small></Link>
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
              <Link href="/dashboard/schedule">Review suggestion</Link>
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
}: {
  tier: ProgramTier
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
  recipes?: PhoenixRecipe[]
}) {
  const [tab, setTab] = useState<PanelTab>('progress')
  const capabilities = getTierCapabilities(tier)
  const planBlocks = useMemo(() => buildPlanBlocks(tier, logic), [tier, logic])

  const plan = schedule.dailyRecommendation || buildDailyRecommendation(logic, schedule)
  const quiet = schedule.preferences?.carouselStyle === 'step'
  const flexible = schedule.preferences?.executionStyle === 'flow'
  const preview = schedule.events.filter(event => !['cancelled','skipped'].includes(event.status) && new Date(event.adjusted_end_at || event.end_at) >= new Date(schedule.now)).slice(0, 3)
  return (
    <section className="tier-dashboard-workspace daily-home" data-tier={tier} data-quiet={quiet}>
      <DailyPlanCard plan={plan} />
      <DailyDisplayPreferences {...schedule.preferences} />
      {quiet ? <p className="daily-quiet-note">One step is enough for now. Your schedule and details are here whenever you need them.</p> : <section className="daily-essentials" aria-label="Daily essentials">
        {plan.supporting.map(action => <Link key={action.id} href={action.href}><strong>{action.title}</strong><span>{action.reason}</span></Link>)}
      </section>}
      {quiet ? <details className="daily-disclosure"><summary>Schedule and progress</summary><SchedulePreview preview={preview} flexible={flexible} schedule={schedule} logic={logic} plan={plan} /></details> : <SchedulePreview preview={preview} flexible={flexible} schedule={schedule} logic={logic} plan={plan} />}
      <details className="daily-disclosure" id="progress"><summary>Progress, assessments, and details</summary>
        <div className="tier-tab-list" aria-label="Dashboard information">
          {(['progress', 'assessments', 'trends'] as PanelTab[]).map(item => <button key={item} type="button" aria-pressed={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        {tab === 'progress' ? <ProgressTab logic={logic} tier={tier} /> : tab === 'assessments' ? <AssessmentsTab logic={logic} capabilities={capabilities} /> : <TrendsTab logic={logic} />}
        <details><summary>Detailed calendar</summary><DashboardCalendar schedule={schedule} planBlocks={planBlocks} /></details>
      </details>
    </section>
  )
}
function SchedulePreview({ preview, flexible, schedule, logic, plan }: { preview: ScheduleEvent[]; flexible: boolean; schedule: DailyScheduleState; logic: ProgramLogicOutput; plan: ReturnType<typeof buildDailyRecommendation> }) {
    return <div className="daily-preview">
      <section aria-label="Schedule preview"><div className="tier-panel-heading"><h2>{flexible ? 'Room for your day' : 'Coming up'}</h2><Link href="/dashboard/schedule">Schedule</Link></div>
        {preview.length ? preview.map(event => <Link key={event.id} href={event.suggested ? `/dashboard/schedule#event-${event.id}` : event.action_route || `/dashboard/schedule#event-${event.id}`}><time>{eventRange(event, schedule.timezone)}</time><strong>{event.title}</strong><small>{event.status === 'completed' ? 'Done' : event.suggested ? 'Suggested time · choose in Schedule' : event.flexibility_type === 'fixed' ? 'Fixed commitment' : 'Flexible'}</small></Link>) : <p>No more scheduled items. Leave this space open.</p>}
      </section>
      <section aria-label="Progress summary"><h2>Your recorded progress</h2><p>{logic.assessments.dailyCompleted ? 'Check-in saved.' : 'Check-in available.'} {logic.execution.workoutComplete ? `Completed workout recorded${logic.execution.completedWorkoutTitle ? `: ${logic.execution.completedWorkoutTitle}` : ' today'}.` : logic.execution.workoutInProgress ? 'A partial workout is saved. Continue when ready.' : 'No completed workout recorded today.'}</p><p>{plan.evidence.food === 'not_logged' ? 'Food not logged yet.' : plan.evidence.food === 'partial' ? 'Food partly logged.' : 'Food logged today.'} {plan.evidence.water === 'not_logged' ? 'Water not logged yet.' : `${Math.round(logic.hydration.consumed)} oz water logged.`}</p></section>
    </div>
  }
