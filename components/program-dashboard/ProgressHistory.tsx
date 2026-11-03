import Link from 'next/link'
import ProgressPhotoComparison from '@/components/ProgressPhotoComparison'
import { ProgressSparkline } from './ProgressOverview'
import type { loadStrengthProgressHistory } from '@/lib/dashboard/strengthProgressHistory'
import type { loadBodyProgressHistory } from '@/lib/dashboard/bodyProgressHistory'
import type { ProgressRange } from '@/lib/dashboard/progressOverview'
import overviewStyles from './ProgressOverview.module.css'
import styles from './ProgressHistory.module.css'

type StrengthData = Awaited<ReturnType<typeof loadStrengthProgressHistory>>
type BodyData = Awaited<ReturnType<typeof loadBodyProgressHistory>>
const periods = [['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All time']] as const

function historyHref(route: string, range: ProgressRange, name?: string, selection?: string) {
  const params = new URLSearchParams({ range })
  if (name && selection) params.set(name, selection)
  return `${route}?${params}`
}

function RangeNav({ route, range, name, selection }: { route: string; range: ProgressRange; name: string; selection?: string }) {
  return <nav className={overviewStyles.ranges} aria-label="History time period">{periods.map(([value, label]) =>
    <Link key={value} prefetch={false} href={historyHref(route, value, name, selection)} aria-current={range === value ? 'page' : undefined}>{label}</Link>)}</nav>
}

function recordedDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

function Retry({ href }: { href: string }) { return <Link className={styles.retry} prefetch={false} href={href}>Retry history</Link> }

function loadTypeLabel(type: string) {
  return type === 'per_hand' ? 'per hand' : type === 'single_side' ? 'one side' : type === 'total_load' ? 'total load' : type || 'load type unspecified'
}

function seriesLabel(series: StrengthData['series'][number]) {
  return [series.label, series.variant || 'variant unspecified', series.equipment || 'equipment unspecified', series.unit, loadTypeLabel(series.loadType), series.sourceKind.includes('legacy') ? 'legacy summary' : 'recorded sets'].join(' · ')
}

function selectionLabel(series: StrengthData['series'][number], all: StrengthData['series']) {
  const label = seriesLabel(series)
  return all.filter(item => seriesLabel(item) === label).length > 1 ? `${label} · record group ${series.id.slice(0, 8)}` : label
}

export function StrengthProgressHistory({ data, selection }: { data: StrengthData; selection?: string }) {
  const route = '/dashboard/progress/strength'
  const selected = data.series.find(item => item.id === selection) || data.series[0]
  const missingSelection = Boolean(selection && !data.series.some(item => item.id === selection))
  return <main className={styles.history}>
    <RangeNav route={route} range={data.range} name="exercise" selection={selected?.id} />
    <section className={styles.panel} aria-labelledby="recorded-loads-heading"><h2 id="recorded-loads-heading">Recorded exercise loads</h2>
      <p>{data.periodLabel}. Recorded units, variants, equipment and load types stay separate. Suggested weights are not progress records.</p>
      {data.capped ? <p role="status" className={styles.notice}>Showing at most 500 recent workout source records for this range. Earlier records may be outside this view.</p> : null}
      {data.detailCapped ? <p role="status" className={styles.notice}>Some exercise details exceed this display’s safe limit. The history shown is partial; your saved logs are unchanged.</p> : null}
      {data.invalidCount > 0 ? <p className={styles.notice}>Some saved values could not supply a valid recorded trend value and are not plotted.</p> : null}
      {data.unavailable ? <><p role="status">Workout history could not be loaded. No zero or completed result has been inferred.</p><Retry href={historyHref(route, data.range)} /></>
        : !selected ? <p role="status">No comparable recorded exercise weights in this period. Saved bodyweight, duration and other activity details remain in workout history below.</p>
          : <>
            {missingSelection ? <p role="status">That exercise is not in the records shown for this period. Choose from the available records.</p> : null}
            <form className={styles.filter} method="GET" action={route} key={`${data.range}:${selected.id}`}>
              <input type="hidden" name="range" value={data.range} />
              <label htmlFor="progress-exercise">Exercise, variant and recorded unit<select id="progress-exercise" name="exercise" defaultValue={selected.id}>{data.series.map(item => <option key={item.id} value={item.id}>{selectionLabel(item, data.series)}</option>)}</select></label>
              <button type="submit">View exercise</button>
            </form>
            <h3>{selectionLabel(selected, data.series)}</h3>
            <p>{selected.sourceKind.includes('legacy') ? 'Legacy summary loads stay separate from individual recorded sets.' : 'Each plotted day shows its highest recorded valid set load. The original sets remain in workout history.'}</p>
            <div className={styles.chart}><ProgressSparkline points={selected.points} label={`${selected.label}, ${selected.unit}, ${loadTypeLabel(selected.loadType)}`} /></div>
            {selected.points.length > 12 ? <p>Chart: latest 12 recorded daily values. The table includes all daily values from the records shown.</p> : null}
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Recorded load table"><table className={styles.table}>
              <caption>{selected.sourceKind.includes('legacy') ? 'Recorded legacy summary by day' : 'Highest recorded set load by day'} · {selected.unit} · {loadTypeLabel(selected.loadType)}</caption>
              <thead><tr><th scope="col">Recorded date</th><th scope="col">Load ({selected.unit})</th></tr></thead>
              <tbody>{selected.points.map(point => <tr key={point.date}><th scope="row"><time dateTime={point.date}>{recordedDate(point.date)}</time></th><td>{point.value} {selected.unit}</td></tr>)}</tbody>
            </table></div>
          </>}
    </section>
    <section className={styles.panel} aria-labelledby="saved-workouts-heading"><h2 id="saved-workouts-heading">Workout history</h2>
      <p>Read-only saved sessions. Completed and partial statuses use the existing saved-work rules; opening history does not change your plan or completion credit.</p>
      {data.unavailable ? <p role="status">Saved sessions are temporarily unavailable.</p> : !data.sessions.length ? <p role="status">No saved workout sessions in this period.</p> : data.sessions.map(session => <details key={session.id} className={styles.session}>
        <summary><time dateTime={session.date}>{recordedDate(session.date)}</time><span>{session.title}</span><span>{session.completed ? 'Completed' : 'Partial / saved work'}</span></summary>
        {session.entries.length ? <ul className={styles.entries}>{session.entries.map(entry => <li key={entry.id}><strong>{entry.label}</strong>{entry.detail}</li>)}</ul> : <p>No confirmed exercise details are available in this saved record.</p>}
      </details>)}
    </section>
  </main>
}

export function BodyProgressHistory({ data, selection }: { data: BodyData; selection?: string }) {
  const route = '/dashboard/progress/body'
  const preferred = ['waist', 'weight'].map(key => data.fields.find(field => field.key === key)).filter((field): field is BodyData['fields'][number] => Boolean(field))
  const defaultField = [...preferred, ...data.fields].find(field => data.rows.some(row => row.values[field.key]?.status === 'recorded')) || preferred[0] || data.fields[0]
  const selected = data.fields.find(field => field.key === selection) || defaultField
  const missingSelection = Boolean(selection && !data.fields.some(field => field.key === selection))
  const counts = new Map<string, number>()
  data.rows.forEach(row => counts.set(row.date, (counts.get(row.date) || 0) + 1))
  const ambiguousDates = new Set(data.ambiguousDates || [])
  const points = selected ? data.rows.filter(row => row.values[selected.key]?.status === 'recorded' && row.values[selected.key]?.value !== null && counts.get(row.date) === 1 && !ambiguousDates.has(row.date))
    .map(row => ({ date: row.date, value: row.values[selected.key].value! })).sort((a, b) => a.date.localeCompare(b.date)) : []
  return <main className={styles.history}>
    <RangeNav route={route} range={data.range} name="measurement" selection={selected?.key} />
    <section className={styles.panel} aria-labelledby="measurement-history-heading"><h2 id="measurement-history-heading">Measurement history</h2>
      <p>{data.periodLabel}. Dates and units retain the saved entries. A blank entry is not a zero measurement.</p>
      {data.capped ? <p role="status" className={styles.notice}>Showing at most 500 recent measurement source records for this range. Earlier records may be outside this view.</p> : null}
      {data.invalidCount > 0 ? <p className={styles.notice}>Some saved fields contain invalid values. They are labelled in the table and are not plotted.</p> : null}
      {data.ambiguousDateCount > 0 ? <p className={styles.notice}>Multiple entries share a recorded date. They are shown separately in the table and are not combined in the chart.</p> : null}
      {data.unavailable ? <><p role="status">Measurement history could not be loaded. Missing history has not been treated as zero.</p><Retry href={historyHref(route, data.range)} /></>
        : !data.rows.length || !selected ? <p role="status">No saved measurements in this period.</p> : <>
          {missingSelection ? <p role="status">That measurement is not available. Choose an existing measurement below.</p> : null}
          <form className={styles.filter} method="GET" action={route} key={`${data.range}:${selected.key}`}><input type="hidden" name="range" value={data.range} />
            <label htmlFor="progress-measurement">Measurement<select id="progress-measurement" name="measurement" defaultValue={selected.key}>{data.fields.map(field => <option key={field.key} value={field.key}>{field.label} · {field.unit}</option>)}</select></label><button type="submit">View measurement</button>
          </form>
          <h3>{selected.label} · {selected.unit}</h3>
          <div className={styles.chart}><ProgressSparkline points={points} label={`${selected.label} ${selected.unit}`} /></div>
          {points.length > 12 ? <p>Chart: latest 12 valid recorded values. The table retains the records shown, including missing and invalid entries.</p> : null}
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Measurement history table"><table className={styles.table}>
            <caption>{selected.label} · original saved unit: {selected.unit}</caption><thead><tr><th scope="col">Recorded date</th><th scope="col">Recorded value</th></tr></thead>
            <tbody>{data.rows.map(row => { const value = row.values[selected.key]; return <tr key={row.key}><th scope="row"><time dateTime={row.date}>{recordedDate(row.date)}</time></th><td>{value?.status === 'recorded' ? `${value.value} ${selected.unit}` : value?.status === 'invalid' ? 'Invalid stored value' : 'Not recorded'}</td></tr> })}</tbody>
          </table></div>
        </>}
    </section>
    <section className={styles.panel} aria-labelledby="private-photo-history-heading"><h2 id="private-photo-history-heading">Private photo comparison</h2>
      <p>First and latest saved photo sets across all dates. The measurement range does not filter this comparison. Photos use temporary private access; unavailable views stay unavailable.</p>
      {data.photosAllowed && data.comparison ? <ProgressPhotoComparison comparison={data.comparison} /> : <p role="status">Photo comparison is not available for this membership.</p>}
    </section>
  </main>
}
