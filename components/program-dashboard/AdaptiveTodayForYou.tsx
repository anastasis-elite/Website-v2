import Link from 'next/link'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import { formatLocalTime } from '@/lib/schedule/time'

function eventTime(event: ScheduleEvent, timezone: string) {
  return formatLocalTime(event.adjusted_start_at || event.start_at, timezone)
}

function eventIsActive(event: ScheduleEvent, now: string) {
  const current = new Date(now).getTime()
  return (
    new Date(event.adjusted_start_at || event.start_at).getTime() <= current &&
    new Date(event.adjusted_end_at || event.end_at).getTime() >= current
  )
}

function urgencyLabel(urgency: DailyScheduleState['nextAction']['urgency']) {
  if (urgency === 'none') return 'clear'
  return urgency
}

export default function AdaptiveTodayForYou({
  schedule,
  streak,
  insight,
}: {
  schedule: DailyScheduleState
  streak: number
  insight: string
}) {
  const activeEvent = schedule.events.find((event) => eventIsActive(event, schedule.now))
  const requiredRemaining = schedule.events.filter(
    (event) => event.required && !['completed', 'cancelled', 'skipped'].includes(event.status),
  )
  const incomplete = schedule.events.filter(
    (event) => !['completed', 'cancelled', 'skipped'].includes(event.status),
  )
  const completed = schedule.completedEvents.slice(0, 4)
  const appliedAdjustments = schedule.adjustments.filter((item) => item.applied)
  const recommendedAdjustments = schedule.adjustments.filter((item) => !item.applied)
  const dayComplete =
    schedule.nextAction.urgency === 'none' ||
    (requiredRemaining.length === 0 && incomplete.length === 0)

  return (
    <section className={`adaptive-today${dayComplete ? ' is-complete' : ''}`} aria-label="Today for you">
      <div className="adaptive-today-main">
        <p className="adaptive-kicker">Today for You</p>
        <h2>{dayComplete ? 'Day complete' : 'What matters now?'}</h2>
        <p className="adaptive-current">
          Current state: <strong>{activeEvent?.title || 'Open window'}</strong>
        </p>

        {dayComplete ? (
          <div className="adaptive-complete-state">
            <strong>Streak status: {streak} day{streak === 1 ? '' : 's'}</strong>
            <p>{insight}</p>
            <small>Tonight: protect recovery, prep tomorrow, and let completed work recede.</small>
          </div>
        ) : (
          <div className="adaptive-next-action">
            <span className={`adaptive-urgency adaptive-urgency-${schedule.nextAction.urgency}`}>
              {urgencyLabel(schedule.nextAction.urgency)}
            </span>
            <h3>{schedule.nextAction.title}</h3>
            <p>{schedule.nextAction.reason}</p>
            {schedule.nextAction.start_at ? (
              <small>Start: {formatLocalTime(schedule.nextAction.start_at, schedule.timezone)}</small>
            ) : null}
            {schedule.nextAction.action_route ? (
              <Link href={schedule.nextAction.action_route} className="adaptive-primary-action">
                Execute next action
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <aside className="adaptive-today-side">
        <div>
          <p className="adaptive-kicker">Adaptive State</p>
          {appliedAdjustments.length ? (
            <strong>Applied: {appliedAdjustments[0].title}</strong>
          ) : recommendedAdjustments.length ? (
            <strong>Recommendation ready</strong>
          ) : (
            <strong>No automatic changes</strong>
          )}
          <span>
            {appliedAdjustments[0]?.reason ||
              recommendedAdjustments[0]?.reason ||
              'The effective schedule is using the planned order.'}
          </span>
        </div>

        <div>
          <p className="adaptive-kicker">Remaining Required</p>
          <strong>{requiredRemaining.length}</strong>
          <span>{requiredRemaining.length ? 'Required actions still need attention.' : 'Required actions are closed.'}</span>
        </div>
      </aside>

      <div className="adaptive-action-list">
        {incomplete.slice(0, 5).map((event) => (
          <Link
            key={event.id}
            href={event.action_route || schedule.nextAction.action_route || '/dashboard/schedule'}
            className={`adaptive-action-row adaptive-${event.priority}`}
          >
            <time>{eventTime(event, schedule.timezone)}</time>
            <span>
              <strong>{event.title}</strong>
              <small>{event.event_type.replaceAll('_', ' ')} · {event.status}</small>
            </span>
          </Link>
        ))}

        {completed.length ? (
          <div className="adaptive-completed-row">
            Completed: {completed.map((event) => event.title).join(' · ')}
          </div>
        ) : null}
      </div>
    </section>
  )
}
