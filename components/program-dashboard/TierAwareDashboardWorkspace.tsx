'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { formatLocalTime } from '@/lib/schedule/time'
import { getTierCapabilities, type ProgramTier } from '@/lib/entitlements'
import { buildWhatsNextState, type WhatsNextState } from '@/lib/dashboard/whatsNext'

type CalendarMode = 'day' | 'week' | 'month'
type PanelTab = 'progress' | 'assessments' | 'trends'

function calendarEvents(schedule: DailyScheduleState) {
  return schedule.events.filter((event) => !event.virtual)
}

function eventRange(event: ScheduleEvent, timezone: string) {
  return `${formatLocalTime(event.adjusted_start_at || event.start_at, timezone)}-${formatLocalTime(event.adjusted_end_at || event.end_at, timezone)}`
}

function WhatsNextCard({ state, timezone }: { state: WhatsNextState; timezone: string }) {
  const data = state.data as any
  return (
    <article className={`tier-whats-next-card tier-whats-next-${state.type}`}>
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

function DashboardCalendar({
  schedule,
}: {
  schedule: DailyScheduleState
}) {
  const [mode, setMode] = useState<CalendarMode>('day')
  const events = calendarEvents(schedule)
  const visibleEvents = mode === 'day' ? events.slice(0, 6) : events.slice(0, mode === 'week' ? 10 : 14)
  const windows = schedule.openWindows.slice(0, mode === 'day' ? 3 : 5)

  return (
    <section className="tier-calendar-panel" aria-label="Calendar">
      <div className="tier-panel-heading">
        <div>
          <p className="tier-dashboard-label">Calendar</p>
          <h2>{schedule.date}</h2>
        </div>
        <div className="tier-segmented-control" role="tablist" aria-label="Calendar view">
          {(['day', 'week', 'month'] as CalendarMode[]).map((item) => (
            <button key={item} type="button" className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="tier-calendar-list">
        {visibleEvents.map((event) => (
          <article key={event.id} className={`tier-calendar-event tier-calendar-${event.event_type}`}>
            <time>{eventRange(event, schedule.timezone)}</time>
            <strong>{event.title}</strong>
            <small>{event.event_type.replaceAll('_', ' ')} · {event.status}</small>
          </article>
        ))}
        {windows.map((window) => (
          <article key={`${window.start_at}-${window.end_at}`} className="tier-calendar-suggestion">
            <time>{formatLocalTime(window.start_at, schedule.timezone)}</time>
            <strong>Open window</strong>
            <small>{window.minutes} min available</small>
          </article>
        ))}
      </div>
    </section>
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
  const postureCopy = capabilities.postureAssessment
    ? 'Photo upload and posture landmark assessment are available.'
    : 'Photo upload is available. Posture landmark assessment is not included in Ember.'

  return (
    <section className="tier-dashboard-workspace" data-tier={tier}>
      <div className="tier-dashboard-row">
        <DashboardCalendar schedule={schedule} />
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
          <div className="tier-info-grid">
            <article><span>Weight</span><strong>{logic.progress.weight ?? 'No log'}</strong><small>{logic.progress.weightChange === null ? 'Add measurements to build history.' : `${logic.progress.weightChange} change`}</small></article>
            <article data-tutorial-id="dashboard-progress-photos"><span>Photos</span><strong>{logic.progress.photoUrls.length}</strong><small>{logic.progress.photosDue ? 'Photo update is due.' : 'History is available.'}</small></article>
            <article data-tutorial-id="dashboard-measurements"><span>Completion</span><strong>{logic.assessments.completionPercent}%</strong><small>Assessment completion</small></article>
          </div>
        ) : null}

        {tab === 'assessments' ? (
          <div className="tier-info-grid">
            <article data-tutorial-id="dashboard-progress-photos"><span>Photo Upload</span><strong>Available</strong><small>{postureCopy}</small></article>
            <article data-tutorial-id="dashboard-strength-assessment"><span>Strength</span><strong>{logic.assessments.monthlyDueCount ? 'Due' : 'Current'}</strong><small>Strength and monthly assessments remain available.</small></article>
            <article><span>Posture</span><strong>{capabilities.postureAssessment ? 'Available' : 'Not included'}</strong><small>{capabilities.postureAssessment ? 'Confirm automatic landmarks and store posture history.' : 'Progress photo history still works.'}</small></article>
          </div>
        ) : null}

        {tab === 'trends' ? (
          <div className="tier-info-grid">
            {logic.trends.map((trend) => (
              <article key={trend.key}><span>{trend.label}</span><strong>{trend.currentAverage === null ? 'No data' : `${Math.round(trend.currentAverage)}${trend.unit}`}</strong><small>{trend.comparisonPercent === null ? 'Keep logging to build this trend.' : `${trend.comparisonPercent}% vs prior period`}</small></article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  )
}
