import Link from 'next/link'
import type {
  FlameResult,
  StreakItem,
} from '@/lib/dashboard/logic/types'

const labels: Record<StreakItem, string> = {
  nutrition: 'Food logged',
  hydration: 'Water target',
  workoutOrMovement: 'Workout or movement',
  dailyCheckIn: 'Daily check-in',
  recovery: 'Recovery action',
  sleep: 'Sleep log',
  customTasks: 'Today’s tasks',
}

function RequirementContent({
  complete,
  label,
  required,
}: {
  complete: boolean
  label: string
  required: boolean
}) {
  return (
    <>
      <span aria-hidden="true">
        {complete ? '✓' : '○'}
      </span>
      <span>
        {label}
        <small>{required ? 'Counts today' : 'Optional'}</small>
      </span>
    </>
  )
}

export default function StreakRequirementsCard({
  flame,
  compact = false,
}: {
  flame: FlameResult
  compact?: boolean
}) {
  const { requirements } = flame
  const entries = (
    Object.keys(requirements.requiredItems) as StreakItem[]
  ).filter(
    (key) =>
      requirements.requiredItems[key] ||
      requirements.completedItems[key],
  )

  return (
    <section
      className={`streak-requirements-card${
        compact ? ' is-compact' : ''
      }`}
    >
      <div>
        <p>Today&apos;s streak</p>
        <strong>{requirements.completionScore}%</strong>
      </div>

      {requirements.resetMessage ? (
        <p className="streak-reset-message">
          {requirements.resetMessage}
        </p>
      ) : null}

      <ul>
        {entries.map((key) => {
          const destination = requirements.itemDestinations[key]
          const complete = requirements.completedItems[key]
          const required = requirements.requiredItems[key]
          const className = complete
            ? 'complete'
            : required
              ? 'required'
              : 'optional'

          return (
            <li key={key} className={className}>
              {destination ? (
                <Link
                  href={destination.href}
                  aria-label={destination.ariaLabel}
                  className="streak-requirement-action"
                >
                  <RequirementContent
                    complete={complete}
                    label={labels[key]}
                    required={required}
                  />
                </Link>
              ) : (
                <div className="streak-requirement-static">
                  <RequirementContent
                    complete={complete}
                    label={labels[key]}
                    required={required}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
