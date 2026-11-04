import Link from 'next/link'
import type { NutritionProgressData } from '@/lib/dashboard/nutritionProgress'
import type { CycleProgressData } from '@/lib/dashboard/cycleProgress'
import type { ProgressPoint, ProgressRange, ProgressSeries } from '@/lib/dashboard/progressOverview'
import styles from './ProgressTrends.module.css'
import historyStyles from './ProgressHistory.module.css'
import overviewStyles from './ProgressOverview.module.css'

const periods = [['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All time']] as const
const nutritionKeys = ['hydration', 'calories', 'protein', 'carbs', 'fats'] as const

function recordedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function RangeNav({ route, range }: { route: string; range: ProgressRange }) {
  return <nav className={overviewStyles.ranges} aria-label="History time period">{periods.map(([value, label]) =>
    <Link key={value} prefetch={false} href={`${route}?range=${value}`} aria-current={value === range ? 'page' : undefined}>{label}</Link>)}</nav>
}

function PointChart({ points, label, unit }: { points: ProgressPoint[]; label: string; unit: string }) {
  const visible = points.slice(-12)
  if (!visible.length) return <p className={styles.empty}>No recorded values in this period.</p>
  if (visible.length === 1) return <p className={styles.empty}>One recorded value so far.</p>
  const min = Math.min(...visible.map(point => point.value)), max = Math.max(...visible.map(point => point.value))
  const first = Date.parse(visible[0].date), span = Date.parse(visible.at(-1)!.date) - first || 1
  return <svg className={styles.chart} viewBox="0 0 240 50" role="img" aria-label={`${label}: ${visible.length} recorded values in ${unit}. Dots show individual records; chart scaled to these values.`}>
    <title>{visible.map(point => `${point.date}: ${point.value} ${unit}`).join('; ')}</title>
    {visible.map(point => <circle key={point.date} cx={8 + (Date.parse(point.date) - first) / span * 224} cy={max === min ? 25 : 41 - (point.value - min) / (max - min) * 32} r="3" />)}
  </svg>
}

function NutritionMetric({ series }: { series: ProgressSeries }) {
  const latest = series.points.at(-1)
  return <div className={styles.metric}>
    <h4>{series.label}</h4>
    {series.unavailable ? <p className={styles.empty}>Temporarily unavailable</p> : <>
      <p className={styles.value}>{latest ? <>{latest.value} <span>{series.unit}</span></> : 'Not recorded'}</p>
      <PointChart points={series.points} label={series.label} unit={series.unit} />
      {latest ? <small>Latest · {recordedDate(latest.date)}</small> : null}
    </>}
  </div>
}

function NutritionCoverage({ data }: { data: NutritionProgressData }) {
  return <p className={styles.note}>{data.capped ? 'Limited history: at most 500 recent daily logs. Totals with incomplete entry history are omitted; earlier records may be outside this view.' : data.periodLabel + '.'}
    {data.coverageStart && data.coverageEnd ? ` Recorded dates shown: ${recordedDate(data.coverageStart)}–${recordedDate(data.coverageEnd)}.` : ''}
    {data.ambiguousDays ? ' Conflicting or incomplete daily totals are excluded from trends.' : ''}
  </p>
}

export function NutritionProgressCard({ data }: { data: NutritionProgressData }) {
  return <section className={`phone-app-card ${styles.card} ${styles.nutrition}`} aria-labelledby="nutrition-progress-heading">
    <div className={styles.heading}><p className={styles.eyebrow}>Nutrition</p><h3 id="nutrition-progress-heading">Your daily nourishment</h3></div>
    <div className={styles.metrics}>{nutritionKeys.map(key => <NutritionMetric key={key} series={data.series[key]} />)}</div>
    <p className={styles.note}>Recorded daily totals · charts show up to 12 latest values. Missing values stay unrecorded.</p>
    <NutritionCoverage data={data} />
    <Link className={styles.action} prefetch={false} href={`/dashboard/progress/nutrition?range=${data.range}`}>View nutrition history <span aria-hidden="true">›</span></Link>
  </section>
}

export function CycleProgressCard({ data }: { data: CycleProgressData }) {
  if (!data.enabled) return null
  const latest = data.intervals.at(-1)
  return <section className={`phone-app-card ${styles.card}`} aria-labelledby="cycle-progress-heading">
    <div className={styles.heading}><p className={styles.eyebrow}>Cycle</p><h3 id="cycle-progress-heading">Between logged starts</h3></div>
    {data.unavailable ? <p className={styles.empty}>Cycle history is temporarily unavailable.</p> : <>
      <p className={styles.value}>{latest ? <>{latest.days} <span>days · latest interval</span></> : 'No interval recorded yet'}</p>
      <PointChart points={data.points} label="Days between logged period starts" unit="days" />
      <p className={styles.note}>{latest ? `${recordedDate(latest.start)} to ${recordedDate(latest.date)}.` : 'Two logged period starts are needed to show an interval.'} Calendar days between saved starts.</p>
    </>}
    {data.capped ? <p className={styles.note}>Limited to recent logged starts. Earlier intervals may be outside this view.</p> : null}
    {data.points.length > 12 ? <p className={styles.note}>Chart: latest 12 intervals.</p> : null}
    <Link className={styles.action} prefetch={false} href={`/dashboard/progress/cycle?range=${data.range}`}>View logged intervals <span aria-hidden="true">›</span></Link>
  </section>
}

export function NutritionProgressHistory({ data }: { data: NutritionProgressData }) {
  const route = '/dashboard/progress/nutrition'
  const unavailable = nutritionKeys.some(key => data.series[key].unavailable)
  const dates = [...new Set(nutritionKeys.flatMap(key => data.series[key].points.map(point => point.date)))].sort((a, b) => b.localeCompare(a))
  const values = Object.fromEntries(nutritionKeys.map(key => [key, new Map(data.series[key].points.map(point => [point.date, point.value]))])) as Record<typeof nutritionKeys[number], Map<string, number>>
  return <main className={historyStyles.history}>
    <RangeNav route={route} range={data.range} />
    <section className={historyStyles.panel} aria-labelledby="nutrition-history-heading"><h2 id="nutrition-history-heading">Recorded nutrition trends</h2>
      <p>Daily totals use confirmed meal entries and manual macro entries once. Hydration uses recorded water. Missing entries and unavailable history are labelled separately from a recorded zero.</p>
      <NutritionCoverage data={data} />
      {unavailable ? <><p role="status">Some nutrition history is temporarily unavailable. Unavailable values are excluded from charts.</p><Link className={historyStyles.retry} prefetch={false} href={`${route}?range=${data.range}`}>Retry nutrition history</Link></> : null}
      <div className={styles.metrics}>{nutritionKeys.map(key => <NutritionMetric key={key} series={data.series[key]} />)}</div>
      <p>Charts show the latest 12 recorded values for each metric. Dots show saved totals only; dates with no value are not filled in.</p>
      {!dates.length ? <p role="status">No unambiguous daily nutrition values are available in this view.</p> : <div className={historyStyles.tableScroll} tabIndex={0} role="region" aria-label="Recorded daily nutrition table"><table className={historyStyles.table}>
        <caption>Recorded daily nutrition totals · {data.periodLabel.toLowerCase()}</caption>
        <thead><tr><th scope="col">Recorded date</th>{nutritionKeys.map(key => <th key={key} scope="col">{data.series[key].label} ({data.series[key].unit})</th>)}</tr></thead>
        <tbody>{dates.map(date => <tr key={date}><th scope="row"><time dateTime={date}>{recordedDate(date)}</time></th>{nutritionKeys.map(key => <td key={key}>{data.series[key].unavailable ? 'Unavailable' : values[key].has(date) ? values[key].get(date) : 'Not recorded'}</td>)}</tr>)}</tbody>
      </table></div>}
    </section>
  </main>
}

export function CycleProgressHistory({ data }: { data: CycleProgressData }) {
  const route = '/dashboard/progress/cycle'
  return <main className={historyStyles.history}>
    <RangeNav route={route} range={data.range} />
    <section className={historyStyles.panel} aria-labelledby="cycle-history-heading"><h2 id="cycle-history-heading">Days between logged period starts</h2>
      {!data.enabled ? <p role="status">Cycle tracking is currently off. Logged intervals are hidden.</p> : <>
        <p>{data.periodLabel}. Each interval counts calendar days from one logged period start to the next. The later start must be in the selected range; the preceding start may be earlier.</p>
        {data.capped ? <p className={historyStyles.notice}>Showing intervals from at most 500 recent logged starts, plus a preceding start where available. Earlier intervals may be outside this view.</p> : null}
        {data.invalidCount ? <p className={historyStyles.notice}>Some saved dates were invalid and are excluded.</p> : null}
        {data.unavailable ? <><p role="status">Logged cycle history is temporarily unavailable. A failed read is not a zero-day interval.</p><Link className={historyStyles.retry} prefetch={false} href={`${route}?range=${data.range}`}>Retry cycle history</Link></> : !data.intervals.length ? <p role="status">Two logged period starts are needed to show an interval in this range.</p> : <>
          <PointChart points={data.points} label="Days between logged period starts" unit="days" />
          <p>Chart: latest 12 recorded intervals. The table retains the intervals shown.</p>
          <div className={historyStyles.tableScroll} tabIndex={0} role="region" aria-label="Logged cycle interval table"><table className={historyStyles.table}>
            <caption>Calendar days between consecutive logged period starts</caption><thead><tr><th scope="col">Earlier start</th><th scope="col">Next start</th><th scope="col">Days between starts</th></tr></thead>
            <tbody>{[...data.intervals].reverse().map(interval => <tr key={interval.date}><td><time dateTime={interval.start}>{recordedDate(interval.start)}</time></td><th scope="row"><time dateTime={interval.date}>{recordedDate(interval.date)}</time></th><td>{interval.days} days</td></tr>)}</tbody>
          </table></div>
        </>}
      </>}
      <Link className={styles.action} prefetch={false} href="/dashboard/cycle">Open cycle tracking <span aria-hidden="true">›</span></Link>
    </section>
  </main>
}
