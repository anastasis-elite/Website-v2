'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildTodayActivities, presentTodayActivities, type DailyGuideState, type TodayActivity, type TodayActivityId } from '@/lib/dashboard/todayActivities'
import { buildDailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { useDailyScheduleRefresh } from '@/lib/schedule/client'
import { formatLocalTime } from '@/lib/schedule/time'
import { trackEvent } from '@/lib/analytics'
import { recordTodayActionOpened, recordTodayActionCompletions } from '@/lib/analytics/todayJourney'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import { getRecoveryPresentation } from '@/lib/recovery/todayCompletion'
import StreakRequirementsCard from '@/components/program-dashboard/StreakRequirementsCard'
import { getStreakRequirementProgress } from '@/lib/dashboard/logic/streakRequirementProgress'

const icons: Record<string, string> = { check_in: '☀', hydration: '◒', schedule: '▦', nutrition: '◡', workout: '↟', recovery: '♡', none: '✦' }
const statusLabels: Record<string, string> = { available: 'Available', upcoming: 'Upcoming', in_progress: 'In progress', completed: 'Completed', deferred: 'Deferred', skipped: 'Skipped' }
const tutorialIds: Partial<Record<TodayActivityId, string>> = { 'check-in': 'dashboard-daily-checkin', water: 'dashboard-water-progress', workout: 'dashboard-nav-workout', nutrition: 'dashboard-nav-nutrition', recovery: 'dashboard-nav-recovery' }
type GuideAction = 'defer' | 'skip' | 'resume' | 'review'
const activityCards: Partial<Record<TodayActivityId, { illustration: string; label: string }>> = {
  water: { illustration: 'water', label: 'Today’s essential' },
  schedule: { illustration: 'schedule', label: 'Your time' },
  'check-in': { illustration: 'check-in', label: 'Start with you' },
  nutrition: { illustration: 'nutrition', label: 'Nourishment' },
  workout: { illustration: 'training', label: 'Movement' },
  recovery: { illustration: 'recovery', label: 'Rest & recovery' },
}

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
  const streakDialog = useRef<HTMLDialogElement>(null)
  const streakTrigger = useRef<HTMLButtonElement | null>(null)
  const streakHeading = useRef<HTMLHeadingElement>(null)
  const streakDialogId = useId()
  useEffect(() => { setSavedGuide({ date: schedule.date, value: schedule.dailyGuide }) }, [schedule.date, schedule.dailyGuide])
  useEffect(() => { setMessage('') }, [schedule.date])
  const activeSchedule = { ...schedule, dailyGuide: savedGuide.date === schedule.date ? savedGuide.value : schedule.dailyGuide }
  const today = buildTodayActivities(logic, activeSchedule)
  const streakProgress = getStreakRequirementProgress(logic.flameState, schedule.date, { programTier: logic.program, now: schedule.now, timezone: schedule.timezone })
  const streakAvailable = streakProgress.available && streakProgress.requiredCount !== null && streakProgress.completedCount !== null
  const requiredCount = streakProgress.requiredCount ?? 0
  const requiredCompleted = streakProgress.completedCount ?? 0
  const remainingRequirements = requiredCount - requiredCompleted
  const streakMessage = !streakAvailable ? 'Your streak requirements could not be confirmed. Open details to review or retry.'
    : streakProgress.secured ? 'Today’s required work is complete. Your streak is secured for today.'
      : `${remainingRequirements} required ${remainingRequirements === 1 ? 'item remains' : 'items remain'} to secure today’s streak.`
  const presentedActivities = presentTodayActivities(logic, activeSchedule, today.activities)
  const plan = buildDailyRecommendation(logic, activeSchedule)
  const primaryId = plan.primary.id === 'food-input' ? 'nutrition' : plan.primary.id
  const primary = plan.primary.id === 'safety' ? undefined : presentedActivities.find(activity => activity.id === primaryId)
  const recovery = logic.execution.recoveryEvidence ? getRecoveryPresentation({ evidence: logic.execution.recoveryEvidence, schedule: activeSchedule }) : null
  const presentationBoundary = Math.min(...[logic.nutrition.pacing?.nextRefreshAt, logic.hydration.presentationPacing?.nextRefreshAt, recovery?.nextRefreshAt]
    .flatMap(value => value && Number.isFinite(Date.parse(value)) ? [Date.parse(value)] : []))
  useDailyScheduleRefresh(activeSchedule, true, Number.isFinite(presentationBoundary) ? new Date(presentationBoundary).toISOString() : undefined)

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
  const workoutDayState = logic.workoutDecision.assignedWorkout?.workout_state
  const inactiveWorkoutDay = workoutDayState === 'rest' || workoutDayState === 'unavailable'
  const illustrated = (id: TodayActivityId) => Boolean(activityCards[id])
  const highlighted = (id: TodayActivityId) => id === 'water' || id === 'schedule'
  const displayActivities = [...presentedActivities.filter(activity => highlighted(activity.id)), ...presentedActivities.filter(activity => !highlighted(activity.id))]
  return <div className="today-guide">
    {schedule.unavailableSources?.length ? <p role="status">Some schedule details are temporarily unavailable. Your saved activities are still recorded; check your calendar before choosing a time.</p> : null}


    <article className="today-next" data-testid="guided-next-step" data-activity-id={primaryId} data-tutorial-id="dashboard-whats-next">
      <div className="today-next-heading"><p className="tier-dashboard-label">Your next step</p><span className="today-activity-icon" aria-hidden="true">{icons[plan.primary.category] || '▦'}</span></div>
      <h2>{plan.primary.id === 'check-in' ? 'Let’s start with you.' : plan.primary.title}</h2>
      <p data-tutorial-id="dashboard-daily-insight">{plan.primary.id === 'check-in' ? 'How’s your energy today? A quick check-in is enough to begin.' : plan.primary.reason}</p>
      <Link className="tier-primary-action" href={plan.primary.href} onClick={() => openActivity(plan.primary.id, plan.primary.completed)}>{plan.primary.id === 'check-in' ? 'Start daily check-in' : plan.primary.id === 'water' ? 'Log water' : plan.primary.id === 'workout' ? logic.execution.workoutInProgress ? 'Resume workout' : 'Open workout' : plan.primary.id === 'recovery' ? 'Open recovery' : plan.primary.category === 'assessment' ? 'Open assessment' : plan.primary.category === 'nutrition' ? logic.program === 'ember' ? 'Open nutrition guidance' : 'Log meal' : 'Open schedule'}</Link>
      {primary?.canDefer ? <button className="today-later" type="button" disabled={busy !== null} onClick={() => updateActivity(primary.id, 'defer')}>{busy === primary.id ? 'Saving…' : 'Later today'}</button> : null}
    </article>
    <p className="today-feedback" role="status" aria-live="polite">{message}</p>

    {inactiveWorkoutDay ? <p className="today-workout-status" role="status" data-workout-state={workoutDayState}><strong>{logic.workout.title}</strong><span>{logic.workoutDecision.reasonForModification}</span></p> : null}

    <section className="today-activities" data-testid="today-activities" aria-label="Your day at a glance" data-tutorial-id="dashboard-nutrition-progress">
      <div className="today-section-heading"><h2>At your pace.</h2><span>Go in your own order</span></div>
      {displayActivities.length ? <ul>{displayActivities.map(activity => <li key={activity.id} data-activity-id={activity.id} data-status={activity.status} data-illustrated={illustrated(activity.id) ? 'true' : undefined}>
        <Link href={activity.href} onClick={() => openActivity(activity.id, today.activities.some(record => record.id === activity.id && record.status === 'completed'))} data-tutorial-id={tutorialIds[activity.id]}>
          {illustrated(activity.id) ? <img src={`/illustrations/today-${activityCards[activity.id]?.illustration}.svg`} width="360" height="180" alt="" className="today-card-illustration" /> : null}
          <span className="today-activity-icon" aria-hidden="true">{activity.status === 'completed' ? '✓' : icons[activity.category] || '▦'}</span>
          <span className="today-activity-copy">{illustrated(activity.id) ? <span className="today-card-kicker">{activityCards[activity.id]?.label}</span> : null}<strong>{activity.title}{!activity.countsTowardProgress ? <span className="today-optional-label">Optional</span> : null}</strong>{quiet ? null : <small>{activity.detail}</small>}</span>
          <span className="today-activity-state">{statusLabels[activity.status] || 'Available'}{activity.deferredUntil ? <small>Until {formatLocalTime(activity.deferredUntil, schedule.timezone)}</small> : null}</span>
        </Link>
        <ActivityOptions activity={activity} busy={busy !== null} onAction={updateActivity} />
      </li>)}</ul> : <p role="status">{complete ? 'Your recorded activities are saved. You can revisit your progress and history anytime.' : 'Nothing else is due right now. Your saved activities are still available.'} <Link href="/dashboard/progress">View progress</Link></p>}
    </section>

    {logic.nutrition.macroReminder ? <aside className="today-feedback" aria-label="Recent nutrition logs">
      <p>{logic.nutrition.macroReminder.message}</p>
      <Link href="/dashboard/nutrition">Review nutrition logs</Link>
    </aside> : null}

    <button type="button" className="today-progress" data-testid="today-progress" aria-haspopup="dialog" aria-controls={streakDialogId}
      aria-label={streakAvailable ? `Today's progress: ${requiredCompleted} of ${requiredCount} required items completed. ${streakMessage}` : 'Today’s progress: streak status unavailable. Open streak details.'}
      data-tutorial-id="dashboard-progress-area" onClick={event => { streakTrigger.current = event.currentTarget; streakDialog.current?.showModal(); streakHeading.current?.focus() }}>
      <span className="today-progress-heading"><span className="today-progress-title">Today’s progress</span><span>{streakAvailable ? `${requiredCompleted} of ${requiredCount}` : 'Status unavailable'}</span></span>
      <span className="today-progress-segments" role="progressbar" aria-label="Required streak work"
        aria-valuemin={streakAvailable ? 0 : undefined} aria-valuemax={streakAvailable ? Math.max(1, requiredCount) : undefined}
        aria-valuenow={streakAvailable ? requiredCompleted : undefined}
        aria-valuetext={streakAvailable ? `${requiredCompleted} of ${requiredCount} required items completed` : 'Streak requirements unavailable'}>
        {Array.from({ length: streakAvailable ? requiredCount : 0 }, (_, index) => <i key={index} className={index < requiredCompleted ? 'is-complete' : ''} />)}
      </span>
      <span className="today-progress-copy">{streakMessage} Open streak details.</span>
    </button>
    <dialog ref={streakDialog} id={streakDialogId} className="today-streak-dialog" aria-labelledby={`${streakDialogId}-title`} aria-describedby={`${streakDialogId}-description`}
      onCancel={event => { event.preventDefault(); streakDialog.current?.close() }} onClose={() => streakTrigger.current?.focus()}>
      <header><h2 ref={streakHeading} tabIndex={-1} id={`${streakDialogId}-title`}>Today’s streak</h2><button type="button" onClick={() => streakDialog.current?.close()}>Close</button></header>
      <p id={`${streakDialogId}-description`}>{streakAvailable ? 'These are the requirements that count toward today’s streak. Saved optional work does not replace an outstanding requirement.' : 'Your saved streak requirements are unavailable. Refresh before relying on a secured status.'}</p>
      <StreakRequirementsCard flame={logic.flameState} expectedDate={schedule.date} now={schedule.now} timezone={schedule.timezone} progress={streakProgress} />
      {!streakAvailable ? <button type="button" className="tier-primary-action" onClick={() => router.refresh()}>Refresh requirements</button> : null}
    </dialog>
  </div>
}
