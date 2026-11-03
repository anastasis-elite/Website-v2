import Link from 'next/link'
import type { RecoveryProgressHistoryData } from '@/lib/dashboard/recoveryProgressHistory'
import type { ProgressRange } from '@/lib/dashboard/progressOverview'
import { addLocalDays } from '@/lib/timezone'
import overviewStyles from './ProgressOverview.module.css'
import styles from './ProgressHistory.module.css'

type History = RecoveryProgressHistoryData
type Value = History['sleep']['records'][number]['duration']
type SourceState = { unavailable: boolean; capped: boolean; invalidCount: number }
const periods = [['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All time']] as const

function href(route: string, range: ProgressRange, signal?: string) {
  const params = new URLSearchParams({ range })
  if (signal) params.set('signal', signal)
  return `${route}?${params}`
}

function RangeNav({ route, range, signal }: { route: string; range: ProgressRange; signal?: string }) {
  return <nav className={overviewStyles.ranges} aria-label="History time period">{periods.map(([value, label]) =>
    <Link key={value} prefetch={false} href={href(route, value, signal)} aria-current={range === value ? 'page' : undefined}>{label}</Link>)}</nav>
}

function recordedDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

function recordedValue(value: Value | undefined, unit: string) {
  return value?.status === 'recorded' ? `${value.value} ${unit}` : value?.status === 'invalid' ? 'Invalid stored value' : 'Not recorded'
}

function missingSource(source: SourceState) {
  return source.unavailable ? 'Unavailable' : source.capped ? 'Not shown in limited history' : 'Not recorded'
}

function SourceNotice({ source, label }: { source: SourceState; label: string }) {
  return <>
    {source.unavailable ? <p role="status">{label} is unavailable. No missing or failed read has been treated as zero.</p> : null}
    {source.capped ? <p role="status" className={styles.notice}>Showing at most 500 recent {label.toLowerCase()} records for this range. Earlier records may be outside this view.</p> : null}
    {source.invalidCount > 0 ? <p className={styles.notice}>Some {label.toLowerCase()} dates or values are invalid. Invalid values are labelled and are not plotted.</p> : null}
  </>
}

function Retry({ route, range, signal }: { route: string; range: ProgressRange; signal?: string }) {
  return <Link className={styles.retry} prefetch={false} href={href(route, range, signal)}>Retry history</Link>
}

function SignalChart({ points, label, unit }: { points: Array<{ date: string; value: number }>; label: string; unit: string }) {
  if (points.length < 2) return <p className={overviewStyles.empty}>{points.length ? 'One record so far. The saved value is in the table.' : 'No unambiguous recorded values to plot in this period.'}</p>
  const visible = points.slice(-12), min = Math.min(...visible.map(point => point.value)), max = Math.max(...visible.map(point => point.value))
  const first = Date.parse(visible[0].date), span = Date.parse(visible.at(-1)!.date) - first || 1
  return <svg className={overviewStyles.spark} viewBox="0 0 240 60" role="img" aria-label={`${label}. ${visible.length} saved values in ${unit}; chart scaled to those values. Dots are individual records, with no inferred values between dates.`}>
    <title>{visible.map(point => `${point.date}: ${point.value} ${unit}`).join('; ')}</title>
    {visible.map(point => <circle key={point.date} cx={8 + (Date.parse(point.date) - first) / span * 224} cy={max === min ? 30 : 48 - (point.value - min) / (max - min) * 34} r="3" />)}
  </svg>
}

function ActivityValue({ activity }: { activity: History['activities']['records'][number] }) {
  return <><strong>{activity.label}</strong> · {recordedValue(activity.duration, 'minutes')}
    {activity.duration.status === 'recorded' ? <small> · {activity.durationSource === 'manual_details' ? 'Saved manual duration' : 'Saved whole-minute duration'}</small> : null}
    {activity.ambiguous ? <small> · Conflicting saved identity; shown separately and not combined.</small> : null}
  </>
}

export function EnergyRecoveryHistory({ data, selection }: { data: History; selection?: string }) {
  const route = '/dashboard/progress/recovery'
  const selected = data.fields.find(field => field.key === selection) ||
    data.fields.find(field => data.checkins.records.some(row => row.values[field.key]?.status === 'recorded')) || data.fields[0]
  const missingSelection = Boolean(selection && !data.fields.some(field => field.key === selection))
  const dates = new Map<string, number>()
  for (const row of data.checkins.records) dates.set(row.date, (dates.get(row.date) || 0) + 1)
  const ambiguous = new Set(data.checkins.ambiguousDates)
  const points = selected ? data.checkins.records.filter(row => dates.get(row.date) === 1 && !ambiguous.has(row.date) && row.values[selected.key]?.status === 'recorded')
    .map(row => ({ date: row.date, value: row.values[selected.key].value! })).sort((a, b) => a.date.localeCompare(b.date)) : []
  return <main className={styles.history}>
    <RangeNav route={route} range={data.range} signal={selected?.key} />
    <section className={styles.panel} aria-labelledby="check-in-history-heading"><h2 id="check-in-history-heading">Saved check-in trends</h2>
      <p>{data.periodLabel}. Ratings retain their saved 1–10 scale; sleep duration is recorded in hours. No historical recovery or readiness score is reconstructed.</p>
      <p>Daily answer records contain check-in answers and sleep values mirrored from the sleep form. A saved answer alone does not establish a completed check-in.</p>
      <SourceNotice source={data.checkins} label="Check-in history" />
      {data.checkins.ambiguousDates.length ? <p className={styles.notice}>Multiple check-ins share a recorded date. They remain separate in the table and are not plotted as one daily value.</p> : null}
      {data.checkins.unavailable ? <Retry route={route} range={data.range} signal={selected?.key} /> : !data.checkins.records.length || !selected ? <p role="status">No dated check-in records are available in this view.</p> : <>
        {missingSelection ? <p role="status">That check-in field is not available. Choose an existing field below.</p> : null}
        <form className={styles.filter} method="GET" action={route} key={`${data.range}:${selected.key}`}><input type="hidden" name="range" value={data.range} />
          <label htmlFor="progress-signal">Recorded check-in field<select id="progress-signal" name="signal" defaultValue={selected.key}>{data.fields.map(field => <option key={field.key} value={field.key}>{field.label} · {field.unit}</option>)}</select></label><button type="submit">View check-in trend</button>
        </form>
        <h3>{selected.label} · {selected.unit}</h3>
        <div className={styles.chart}><SignalChart points={points} label={selected.label} unit={selected.unit} /></div>
        <p>Dots show saved values only. Missing dates have no plotted value.{points.length > 12 ? ' Chart: latest 12 valid values; the table retains the records shown.' : ''}</p>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Saved check-in table"><table className={styles.table}><caption>{selected.label} · saved check-in values in {selected.unit}</caption>
          <thead><tr><th scope="col">Recorded date</th><th scope="col">Recorded value</th></tr></thead><tbody>{data.checkins.records.map(row => <tr key={row.key}><th scope="row"><time dateTime={row.date}>{recordedDate(row.date)}</time></th><td>{recordedValue(row.values[selected.key], selected.unit)}</td></tr>)}</tbody>
        </table></div>
      </>}
    </section>
    <section className={styles.panel} aria-labelledby="sleep-records-heading"><h2 id="sleep-records-heading">Separate saved sleep records</h2>
      <p>Sleep logs and check-in sleep values are separate saved sources. The same night may appear in both; values are not added or averaged together.</p>
      <SourceNotice source={data.sleep} label="Sleep history" />
      {data.sleep.ambiguousDates.length ? <p className={styles.notice}>Multiple sleep logs share a date. Each saved record is shown separately.</p> : null}
      {data.sleep.unavailable ? <Retry route={route} range={data.range} signal={selected?.key} /> : !data.sleep.records.length ? <p role="status">No dated separate sleep logs are available in this view.</p> : <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Saved sleep table"><table className={styles.table}>
        <caption>Sleep log source · hours and quality on the saved 1–10 scale</caption><thead><tr><th scope="col">Recorded date</th><th scope="col">Sleep duration (hours)</th><th scope="col">Sleep quality (/10)</th></tr></thead>
        <tbody>{data.sleep.records.map(row => <tr key={row.key}><th scope="row"><time dateTime={row.date}>{recordedDate(row.date)}</time></th><td>{recordedValue(row.duration, 'hours')}</td><td>{recordedValue(row.quality, '/10')}</td></tr>)}</tbody>
      </table></div>}
    </section>
    <section className={styles.panel} aria-labelledby="recovery-activities-heading"><h2 id="recovery-activities-heading">Saved recovery activities</h2>
      <p>Each entry shows its saved activity duration. Missing durations stay not recorded. Recovery check-ins, sleep, rounds and hold times are not added as recovery minutes.</p>
      <SourceNotice source={data.activities} label="Recovery activity history" />
      {data.activities.unavailable ? <Retry route={route} range={data.range} signal={selected?.key} /> : !data.activities.records.length ? <p role="status">No dated recovery activities are available in this view.</p> : <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Recovery activity table"><table className={styles.table}>
        <caption>Saved recovery activity records · individual durations, not a combined total</caption><thead><tr><th scope="col">Recorded date</th><th scope="col">Activity and saved duration</th></tr></thead>
        <tbody>{data.activities.records.map(activity => <tr key={activity.key}><th scope="row"><time dateTime={activity.date}>{recordedDate(activity.date)}</time></th><td><ActivityValue activity={activity} /></td></tr>)}</tbody>
      </table></div>}
    </section>
  </main>
}

function byDate<T extends { date: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) grouped.set(row.date, [...(grouped.get(row.date) || []), row])
  return grouped
}

export function ConsistencyProgressHistory({ data }: { data: History }) {
  const route = '/dashboard/progress/consistency'
  const checkins = byDate(data.checkins.records), sleep = byDate(data.sleep.records), activities = byDate(data.activities.records), workouts = byDate(data.workouts.records)
  const savedDates = [...new Set([...checkins.keys(), ...sleep.keys(), ...activities.keys(), ...workouts.keys()])].sort((a, b) => b.localeCompare(a))
  const dayLimit = 500, dates = data.range === 'all' ? savedDates.slice(0, dayLimit)
    : Array.from({ length: data.range === '12w' ? 84 : 28 }, (_, index) => addLocalDays(data.today, -index))
  const unavailable = data.checkins.unavailable || data.sleep.unavailable || data.activities.unavailable || data.workouts.unavailable
  return <main className={styles.history}>
    <RangeNav route={route} range={data.range} />
    <section className={styles.panel} aria-labelledby="day-comparison-heading"><h2 id="day-comparison-heading">Your saved days, side by side</h2>
      <p>{data.periodLabel}. This is a day-by-day comparison of saved records, not evidence that stress, sleep or recovery caused a workout result. No past readiness or recovery score is inferred.</p>
      <p>Check-in sleep and separate sleep logs may describe the same night. They stay separate and are not added together. Workout completion uses the existing saved-work rules.</p>
      <SourceNotice source={data.workouts} label="Workout history" /><SourceNotice source={data.checkins} label="Check-in history" />
      <SourceNotice source={data.sleep} label="Sleep history" /><SourceNotice source={data.activities} label="Recovery activity history" />
      {data.checkins.ambiguousDates.length || data.sleep.ambiguousDates.length ? <p className={styles.notice}>Multiple check-in or sleep records share a date. Their saved values remain separate.</p> : null}
      {savedDates.length > dayLimit && data.range === 'all' ? <p role="status" className={styles.notice}>Showing the most recent 500 dates present in the bounded records. Earlier dates may be outside this view.</p> : null}
      {data.range === 'all' ? <p>All-time range shows dates present in the records shown; dates without a saved record are not inferred.</p> : <p>Dates without a saved entry stay not recorded. A limited or unavailable source is labelled separately.</p>}
      {unavailable ? <Retry route={route} range={data.range} /> : null}
      {!savedDates.length && !unavailable ? <p role="status">No dated workout, check-in, sleep or recovery records are available in this view.</p> : null}
      {dates.length ? <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Day-by-day saved activity comparison"><table className={styles.table}>
        <caption>Saved records by member-local date · comparison only</caption><thead><tr><th scope="col">Recorded date</th><th scope="col">Saved workouts</th><th scope="col">Check-in stress (/10)</th><th scope="col">Check-in sleep (hours)</th><th scope="col">Separate sleep log</th><th scope="col">Recovery activities (minutes)</th></tr></thead>
        <tbody>{dates.map(date => <tr key={date}><th scope="row"><time dateTime={date}>{recordedDate(date)}</time></th>
          <td>{data.workouts.unavailable || !workouts.has(date) ? missingSource(data.workouts) : <ul className={styles.entries}>{workouts.get(date)!.map(row => <li key={row.key}>{row.title} · {row.completed ? 'Completed' : 'Partial / saved work'}</li>)}</ul>}</td>
          <td>{data.checkins.unavailable || !checkins.has(date) ? missingSource(data.checkins) : <ul className={styles.entries}>{checkins.get(date)!.map(row => <li key={row.key}>{recordedValue(row.values.stress, '/10')}</li>)}</ul>}</td>
          <td>{data.checkins.unavailable || !checkins.has(date) ? missingSource(data.checkins) : <ul className={styles.entries}>{checkins.get(date)!.map(row => <li key={row.key}>{recordedValue(row.values.sleepHours, 'hours')}</li>)}</ul>}</td>
          <td>{data.sleep.unavailable || !sleep.has(date) ? missingSource(data.sleep) : <ul className={styles.entries}>{sleep.get(date)!.map(row => <li key={row.key}>{recordedValue(row.duration, 'hours')} · Quality: {recordedValue(row.quality, '/10')}</li>)}</ul>}</td>
          <td>{data.activities.unavailable || !activities.has(date) ? missingSource(data.activities) : <ul className={styles.entries}>{activities.get(date)!.map(row => <li key={row.key}><ActivityValue activity={row} /></li>)}</ul>}</td>
        </tr>)}</tbody>
      </table></div> : null}
    </section>
  </main>
}
