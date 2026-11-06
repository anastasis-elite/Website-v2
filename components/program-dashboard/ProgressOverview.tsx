import Link from 'next/link'
import type { ProgressOverviewData, ProgressPoint, ProgressSeries } from '@/lib/dashboard/progressOverview'
import type { RecoveryProgressSummary } from '@/lib/dashboard/recoveryProgressHistory'
import styles from './ProgressOverview.module.css'

export function ProgressSparkline({ points, gaps = false, label }: { points: ProgressPoint[]; gaps?: boolean; label: string }) {
  if (points.length < 2) return <p className={styles.empty}>{points.length ? 'One record so far. More history will reveal a pattern.' : 'Your recorded progress will appear here.'}</p>
  const visible = points.slice(-12), min = gaps ? 1 : Math.min(...visible.map(point => point.value)), max = gaps ? 10 : Math.max(...visible.map(point => point.value))
  const first = Date.parse(visible[0].date), span = Date.parse(visible.at(-1)!.date) - first || 1
  const coordinates = visible.map(point => ({ x: 8 + (Date.parse(point.date) - first) / span * 224, y: max === min ? 30 : 48 - (point.value - min) / (max - min) * 34 }))
  const paths: string[][] = []
  coordinates.forEach((point, index) => { if (!index || gaps && Date.parse(visible[index].date) - Date.parse(visible[index - 1].date) > 86400000) paths.push([]); paths.at(-1)!.push(`${point.x},${point.y}`) })
  return <svg className={styles.spark} viewBox="0 0 240 60" role="img" aria-label={`${label}. ${visible.length} recorded values; ${gaps ? 'energy scale 1 to 10' : 'chart scaled to those values'}.`}>
    <title>{visible.map(point => `${point.date}: ${point.value}`).join('; ')}</title>
    {paths.filter(path => path.length > 1).map((path, index) => <polyline key={index} points={path.join(' ')} />)}
    {coordinates.map((point, index) => <circle key={visible[index].date} cx={point.x} cy={point.y} r="3" />)}
  </svg>
}

function Glimpse({ series, gaps = false }: { series: ProgressSeries; gaps?: boolean }) {
  const first = series.points.slice(-12)[0], last = series.points.at(-1)
  return <div className={styles.glimpse}>
    {series.unavailable ? <p className={styles.empty}>This history is temporarily unavailable.</p> : <><ProgressSparkline points={series.points} gaps={gaps} label={`${series.label} ${series.unit}`} />
      {first && last ? <span className={styles.caption}>{series.label} · {first.value}{series.points.length > 1 ? ` → ${last.value}` : ''} {series.unit}</span> : null}
      {series.points.length > 12 || series.capped ? <small>{series.points.length > 12 ? 'Latest 12 values' : ''}{series.points.length > 12 && series.capped ? ' · ' : ''}{series.capped ? 'Latest 500 source records' : ''}</small> : null}</>}
    <span className={styles.arrow} aria-hidden="true">›</span>
  </div>
}

function RecoveryTotals({ data }: { data?: RecoveryProgressSummary }) {
  return <>
    <dl className={styles.totals}>
      <div><dt>Recovery days{data?.activitiesCapped ? ' shown' : ''}</dt><dd>{data?.daysCompleted ?? 'Unavailable'}</dd></div>
      <div><dt>Recorded minutes{data?.activitiesCapped ? ' shown' : ''}</dt><dd>{data?.recordedMinutes ?? (!data || data.daysCompleted === null ? 'Unavailable' : 'Not recorded')}</dd></div>
      <div><dt>Check-in days{data?.checkinsCapped ? ' shown' : ''}</dt><dd>{data?.checkinDays ?? 'Unavailable'}</dd></div>
    </dl>
    {data?.activitiesCapped || data?.checkinsCapped ? <small className={styles.notice}>Limited to the latest 500 records per source; earlier history may be outside this view.</small> : null}
    {data?.minutesIncomplete ? <small className={styles.notice}>Some records have missing or conflicting evidence. Totals include verified records only.</small> : null}
  </>
}

export default function ProgressOverview({ data, recovery }: { data: ProgressOverviewData; program: string; recovery?: RecoveryProgressSummary }) {
  return <>
    <nav className={styles.ranges} aria-label="Progress time period">{([['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All time']] as const).map(([range, label]) => <Link key={range} prefetch={false} href={`/dashboard/progress?range=${range}`} aria-current={data.range === range ? 'page' : undefined}>{label}</Link>)}</nav>
    <section aria-label="Progress overview"><div className={styles.grid}>
      <Link className={`phone-app-card ${styles.card}`} href={`/dashboard/progress/strength?range=${data.range}`}><div className={styles.copy}><p className={styles.eyebrow}>Strength</p><h3>Getting stronger</h3><p className={styles.completed}>{data.completedSessions === null ? 'Workout history unavailable' : <><strong>{data.completedSessions}</strong> completed workouts{data.workoutsCapped ? ' shown' : ''}</>}</p>
        {data.workoutsCapped ? <small className={styles.notice}>Latest 500 workout records; earlier history may be outside this view.</small> : null}<Glimpse series={data.strength}/></div></Link>
      <Link className={`phone-app-card ${styles.card}`} href={`/dashboard/progress/body?range=${data.range}`}><div className={styles.copy}><p className={styles.eyebrow}>Body changes</p><h3>Beyond the scale</h3><p>Photos, measurements &amp; weight.</p><Glimpse series={data.body}/></div></Link>
      <Link className={`phone-app-card ${styles.card}`} href={`/dashboard/progress/recovery?range=${data.range}`}><div className={styles.copy}><p className={styles.eyebrow}>How you feel</p><h3>Energy &amp; recovery</h3><RecoveryTotals data={recovery} /><Glimpse series={data.energy} gaps/></div></Link>
      <Link className={`phone-app-card ${styles.card}`} href={`/dashboard/progress/consistency?range=${data.range}`}><div className={styles.copy}><p className={styles.eyebrow}>Consistency</p><h3>Showing up for you</h3><p>Your moments of follow-through.</p><div className={styles.glimpse}>
        {data.completedSessions === null ? <p className={styles.empty}>Workout history is temporarily unavailable.</p> : data.completedSessions === 0 ? <p className={styles.empty}>No completed workout sessions in this period.</p> : <svg className={styles.bars} viewBox="0 0 240 70" role="img" aria-label={`Completed workout sessions. ${data.periodLabel}.`}><title>{data.consistency.map(bin => `${bin.start} to ${bin.end}: ${bin.count}`).join('; ')}</title>{data.consistency.map((bin, index) => { const width = 224 / data.consistency.length, height = bin.count / Math.max(1, ...data.consistency.map(item => item.count)) * 42; return <g key={bin.start}><rect x={8 + index * width + 3} y={49 - height} width={Math.max(3, width - 6)} height={height}/><text x={8 + (index + .5) * width} y={height ? 44 - height : 44}>{bin.count}</text>{data.consistency.length <= 4 ? <text x={8 + (index + .5) * width} y="65">{bin.label}</text> : null}</g> })}</svg>}
        {data.completedSessions !== null ? <span className={styles.caption}>{data.completedSessions} completed sessions · {data.workoutsCapped ? 'records shown' : data.periodLabel.toLowerCase()}</span> : null}<span className={styles.arrow} aria-hidden="true">›</span>
      </div></div></Link>
    </div></section>
  </>
}
