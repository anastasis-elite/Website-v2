import Link from 'next/link'
import type { StreakRequirementEntry, StreakRequirementProgress } from '@/lib/dashboard/logic/streakRequirementProgressTypes'

function Requirement({ entry }: { entry: StreakRequirementEntry }) {
  const content = <><span aria-hidden="true">{entry.complete ? '✓' : '○'}</span><span>{entry.label}<small>{entry.complete ? 'Completed' : 'Outstanding'}</small><small>{entry.description}</small></span></>
  return <li className={entry.complete ? 'complete' : 'required'} data-requirement={entry.id}>
    {entry.destination ? <Link href={entry.destination.href} aria-label={`${entry.label}: ${entry.complete ? 'Completed' : 'Outstanding'} requirement. ${entry.destination.ariaLabel}`} className="streak-requirement-action">{content}</Link>
      : <div className="streak-requirement-static">{content}</div>}
    {entry.alternativeDestinations?.map(destination => <Link key={destination.href} href={destination.href} className="streak-requirement-alternative" aria-label="Or record a recovery activity to meet the workout or movement requirement">Or record a recovery activity</Link>)}
  </li>
}

export default function StreakRequirementsCard({ compact = false, progress }: {
  compact?: boolean; progress?: StreakRequirementProgress
}) {
  const current = progress || { available: false as const, requiredCount: null, completedCount: null, secured: false, entries: [], resetMessage: null }
  if (!current.available) return <section className={`streak-requirements-card${compact ? ' is-compact' : ''}`}>
    <p role="status">Today’s streak requirements could not be confirmed. Refresh to try again.</p>
  </section>
  const outstanding = current.entries.filter(entry => !entry.complete), completed = current.entries.filter(entry => entry.complete)
  return <section className={`streak-requirements-card${compact ? ' is-compact' : ''}`} aria-label="Today’s streak requirements">
    <div><p>Today&apos;s streak</p><strong>{current.completedCount} of {current.requiredCount}</strong></div>
    <p role="status">{current.secured ? 'Today’s streak is secured.' : 'Complete the outstanding requirements to secure today’s streak.'}</p>
    {current.resetMessage ? <p className="streak-reset-message">{current.resetMessage}</p> : null}
    <h3>Outstanding requirements</h3>
    {outstanding.length ? <ul>{outstanding.map(entry => <Requirement key={entry.id} entry={entry} />)}</ul> : <p>No outstanding requirements.</p>}
    <h3>Completed requirements</h3>
    {completed.length ? <ul>{completed.map(entry => <Requirement key={entry.id} entry={entry} />)}</ul> : <p>No required items are complete yet.</p>}
  </section>
}
