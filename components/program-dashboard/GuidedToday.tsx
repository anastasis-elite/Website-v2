'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildTodayActivities, type DailyGuideState, type TodayActivity, type TodayActivityId } from '@/lib/dashboard/todayActivities'
import { buildDailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { useDailyScheduleRefresh } from '@/lib/schedule/client'
import { formatLocalTime } from '@/lib/schedule/time'
import { trackEvent } from '@/lib/analytics'
import { recordTodayActionOpened, recordTodayActionCompletions } from '@/lib/analytics/todayJourney'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'

const icons: Record<string, string> = { check_in: '☀', hydration: '◒', schedule: '▦', nutrition: '◡', workout: '↟', recovery: '♡', none: '✦' }
const statusLabels: Record<string, string> = { available: 'Available', upcoming: 'Upcoming', in_progress: 'In progress', completed: 'Completed', deferred: 'Deferred', skipped: 'Skipped' }
const tutorialIds: Partial<Record<TodayActivityId, string>> = { 'check-in': 'dashboard-daily-checkin', water: 'dashboard-water-progress', workout: 'dashboard-nav-workout', nutrition: 'dashboard-nav-nutrition', recovery: 'dashboard-nav-recovery' }
type GuideAction = 'defer' | 'skip' | 'resume' | 'review'

function ActivityOptions({ activity, busy, onAction }: { activity: TodayActivity; busy: boolean; onAction: (id: TodayActivityId, action: GuideAction) => void }) {
  if (activity.status === 'deferred' || activity.status === 'skipped') {
    return activity.canResume
      ? <button type="button" disabled={busy} onClick={() => onAction(activity.id, 'resume')} aria-label={`Resume activity: ${activity.title}`}>Resume activity</button>
      : <Link className="today-change-time" href="/dashboard/schedule">Change in Schedule</Link>
  }
  if (activity.status === 'completed') return null
  if (activity.id === 'schedule') return <details className="today-row-options">
    <summary>Review options</summary><p>After reviewing your schedule, save that step here.</p>
    <button type="button" disabled={busy} onClick={() => onAction(activity.id, 'review')}>I’ve reviewed my schedule</button>
  </details>
  if (!activity.canDefer && !activity.canSkip) return null
  return <details className="today-row-options">
    <summary><span className="sr-only">{activity.title}: </span>Options</summary>
    <div>
      {activity.canDefer ? <button type="button" disabled={busy} onClick={() => onAction(activity.id, 'defer')}>Later today</button> : null}
      {activity.canSkip ? <button type="button" disabled={busy} onClick={() => onAction(activity.id, 'skip')}>Skip for today</button> : null}
    </div>
  </details>
}

export default function GuidedToday({ logic, schedule }: { logic: ProgramLogicOutput; schedule: DailyScheduleState }) {
  const router = useRouter()
  const [savedGuide, setSavedGuide] = useState<{ date: string; value?: DailyGuideState }>(() => ({ date: schedule.date, value: schedule.dailyGuide }))
  const [busy, setBusy] = useState<TodayActivityId | null>(null)
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const viewedDay = useRef('')
  const previousCompleted = useRef<{ date: string; ids: string[] } | null>(null)
  useEffect(() => { setSavedGuide({ date: schedule.date, value: schedule.dailyGuide }) }, [schedule.date, schedule.dailyGuide])
  useEffect(() => { setMessage('') }, [schedule.date])
  const activeSchedule = { ...schedule, dailyGuide: savedGuide.date === schedule.date ? savedGuide.value : schedule.dailyGuide }
  const today = buildTodayActivities(logic, activeSchedule)
  const plan = buildDailyRecommendation(logic, activeSchedule)
  const primaryId = plan.primary.id === 'food-input' ? 'nutrition' : plan.primary.id
  const primary = plan.primary.id === 'safety' ? undefined : today.activities.find(activity => activity.id === primaryId)
  useDailyScheduleRefresh(activeSchedule)

  // A held action becomes available at its explicit return time, including idle tabs.
  const returnAt = Math.min(...Object.values(activeSchedule.dailyGuide?.activities || {}).flatMap(value => value?.status === 'deferred' && value.until && Date.parse(value.until) > Date.now() ? [Date.parse(value.until)] : []))
  useEffect(() => {
    if (!Number.isFinite(returnAt)) return
    const timer = window.setTimeout(() => router.refresh(), Math.max(0, returnAt - Date.now()) + 50)
    return () => window.clearTimeout(timer)
  }, [returnAt, router])
  const completedIds = today.activities.filter(activity => activity.status === 'completed').map(activity => activity.id).join(',')
  useEffect(() => {
    if (viewedDay.current !== schedule.date) {
      viewedDay.current = schedule.date
      trackEvent('today_page_viewed', { tier: logic.program })
    }
    const ids = completedIds ? completedIds.split(',') : []
    const previous = previousCompleted.current
    recordTodayActionCompletions(logic.client.id, schedule.date, ids, previous?.date === schedule.date ? previous.ids : null, logic.program)
    previousCompleted.current = { date: schedule.date, ids }
  }, [completedIds, schedule.date, logic.program, logic.client.id])

  async function updateActivity(activityId: TodayActivityId, action: GuideAction) {
    if (lock.current) return
    lock.current = true; setBusy(activityId); setMessage('')
    try {
      const response = await fetch('/api/dashboard/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: schedule.date, activityId, action }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your choice could not be saved. Try again.')
      setSavedGuide({ date: schedule.date, value: payload.dailyGuide })
      setMessage(action === 'defer' ? 'Saved for later today. Take the next step when you have room.' : action === 'skip' ? 'Skipped for today. You can review your options here.' : action === 'resume' ? 'Ready when you are.' : 'Schedule review saved. Return to your next step when you’re ready.')
      if (action !== 'review') trackEvent(action === 'defer' ? 'activity_deferred' : action === 'skip' ? 'activity_skipped' : 'activity_resumed', { activity: activityId, tier: logic.program })
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your choice could not be saved. Check your connection and try again.')
    } finally { lock.current = false; setBusy(null) }
  }

  const openActivity = (id: string, alreadyCompleted = false) => recordTodayActionOpened(logic.client.id, schedule.date, id, logic.program, alreadyCompleted)
  const quiet = schedule.preferences?.carouselStyle === 'step'
  const complete = today.total > 0 && today.completed === today.total
  return <div className="today-guide">
    {schedule.unavailableSources?.length ? <p role="status">Some schedule details are temporarily unavailable. Your saved activities are still recorded; check your calendar before choosing a time.</p> : null}
    <section className="today-progress" data-testid="today-progress" aria-label={`Today's progress: ${today.completed} of ${today.total}`} data-tutorial-id="dashboard-progress-area">
      <div><h2>Today’s progress</h2><span>{today.total ? `${today.completed} of ${today.total}` : 'No essentials due'}</span></div>
      <div className="today-progress-segments" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(1,today.total)} aria-valuenow={today.completed} aria-valuetext={`${today.completed} of ${today.total} applicable activities completed`}>
        {Array.from({ length: today.total }, (_, index) => <i key={index} className={index < today.completed ? 'is-complete' : ''} />)}
      </div>
      <p>{complete ? 'Your essentials are saved. Leave a little room for yourself.' : 'Saved activities show your progress. Optional activities can wait.'}</p>
    </section>

    <article className="today-next" data-testid="guided-next-step" data-activity-id={primaryId} data-tutorial-id="dashboard-whats-next">
      <div className="today-next-heading"><p className="tier-dashboard-label">Your next step</p><span className="today-activity-icon" aria-hidden="true">{icons[plan.primary.category] || '▦'}</span></div>
      <h2>{plan.primary.id === 'check-in' ? 'Let’s start with you.' : plan.primary.title}</h2>
      <p data-tutorial-id="dashboard-daily-insight">{plan.primary.id === 'check-in' ? 'How’s your energy today? A quick check-in is enough to begin.' : plan.primary.reason}</p>
      <Link className="tier-primary-action" href={plan.primary.href} onClick={() => openActivity(plan.primary.id, plan.primary.completed)}>{plan.primary.id === 'check-in' ? 'Start daily check-in' : plan.primary.id === 'water' ? 'Log water' : plan.primary.id === 'workout' ? logic.execution.workoutInProgress ? 'Resume workout' : 'Open workout' : plan.primary.id === 'recovery' ? 'Open recovery' : plan.primary.category === 'assessment' ? 'Open assessment' : plan.primary.category === 'nutrition' ? logic.program === 'ember' ? 'Open nutrition guidance' : 'Log meal' : 'Open schedule'}</Link>
      {primary?.canDefer ? <button className="today-later" type="button" disabled={busy !== null} onClick={() => updateActivity(primary.id, 'defer')}>{busy === primary.id ? 'Saving…' : 'Later today'}</button> : null}
    </article>
    <p className="today-feedback" role="status" aria-live="polite">{message}</p>

    <section className="today-activities" data-testid="today-activities" aria-label="Your day at a glance" data-tutorial-id="dashboard-nutrition-progress">
      <div className="today-section-heading"><h2>Your day at a glance</h2><span>Go in your own order</span></div>
      <ul>{today.activities.map(activity => <li key={activity.id} data-activity-id={activity.id} data-status={activity.status}>
        <Link href={activity.href} onClick={() => openActivity(activity.id, activity.status === 'completed')} data-tutorial-id={tutorialIds[activity.id]}>
          <span className="today-activity-icon" aria-hidden="true">{activity.status === 'completed' ? '✓' : icons[activity.category] || '▦'}</span>
          <span className="today-activity-copy"><strong>{activity.title}{!activity.countsTowardProgress ? <span className="today-optional-label">Optional</span> : null}</strong>{quiet ? null : <small>{activity.detail}</small>}</span>
          <span className="today-activity-state">{statusLabels[activity.status] || 'Available'}{activity.deferredUntil ? <small>Until {formatLocalTime(activity.deferredUntil, schedule.timezone)}</small> : null}</span>
        </Link>
        <ActivityOptions activity={activity} busy={busy !== null} onAction={updateActivity} />
      </li>)}</ul>
    </section>
  </div>
}
