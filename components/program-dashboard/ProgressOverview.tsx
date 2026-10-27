import Link from 'next/link'
import type { ProgressOverviewData, ProgressPoint, ProgressSeries } from '@/lib/dashboard/progressOverview'
import styles from './ProgressOverview.module.css'

function Artwork({ kind }: { kind: 'strength' | 'body' | 'energy' | 'consistency' }) {
  if (kind === 'strength' || kind === 'consistency') return <img className={styles.art} src={`/illustrations/today-${kind === 'strength' ? 'training' : 'check-in'}.svg`} width="360" height="180" alt="" />
  return <svg className={styles.art} viewBox="0 0 360 180" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`progress-${kind}`} x2=".8" y2="1"><stop stopColor="#634025"/><stop offset="1" stopColor="#28190e"/></linearGradient></defs>
    <path fill={`url(#progress-${kind})`} d="M0 0h360v180H0z"/><path d="M0 112Q65 66 160 112T360 96V180H0Z" fill="#775032" opacity=".65"/><path d="M0 145Q135 89 250 135T360 127V180H0Z" fill="#462c1b"/>
    {kind === 'energy' ? <><circle cx="180" cy="102" r="32" fill="#c59668"/>{[-60,-30,0,30,60].map(angle => <path key={angle} d="M180 50V38" transform={`rotate(${angle} 180 102)`} stroke="#b88a5e" strokeWidth="3"/>)}<path d="M0 129Q100 81 210 125T360 109V180H0Z" fill="#624128"/><path d="M0 161Q140 110 360 149V180H0Z" fill="#352215"/></> : <>
      <g stroke="#c6a07b" strokeWidth="7"><path d="m67 47 100-15 15 91-100 15Z" fill="#5b3c28"/><path d="m184 31 99 18-16 93-99-18Z" fill="#68482d"/></g>
      <circle cx="132" cy="64" r="11" fill="#b88c61"/><path d="m84 117 32-35 22 15 20-24 17 37" fill="#88623f"/><circle cx="230" cy="67" r="11" fill="#bb946d"/><path d="m180 112 32-25 26 22 19-18 14 34" fill="#8f6946"/>
      <path d="M180 142q68-39 106-18t-23 36q-54 14-81-3t39-28" fill="none" stroke="#b4875e" strokeWidth="16"/><path d="m207 135 3 11m15-17 3 11m15-15 3 11m15-11 1 10" stroke="#4e321f" strokeWidth="2"/>
    </>}
  </svg>
}

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

export default function ProgressOverview({ data, program }: { data: ProgressOverviewData; program: string }) {
  return <>
    <nav className={styles.ranges} aria-label="Progress time period">{([['4w', '4 weeks'], ['12w', '12 weeks'], ['all', 'All time']] as const).map(([range, label]) => <Link key={range} prefetch={false} href={`/dashboard/progress?range=${range}`} aria-current={data.range === range ? 'page' : undefined}>{label}</Link>)}</nav>
    <section className={styles.summary} aria-label="Completed workout sessions"><h2>Small steps. Real progress.</h2>
      <p>{data.completedSessions === null ? 'Workout history unavailable' : <><strong>{data.completedSessions}</strong> sessions completed{data.workoutsCapped ? ' shown' : ''}</>}</p><small>{data.workoutsCapped ? 'Latest 500 workout records' : data.periodLabel}.</small>
      <svg viewBox="0 0 170 110" aria-hidden="true" focusable="false"><g fill="#805535" stroke="#ba9068"><path d="M12 82h32v22H12zM62 60h32v44H62zM112 32h32v72h-32z"/></g><path d="M12 64Q82 64 147 10m-23 4 23-4-4 23" stroke="#bb926c" strokeWidth="4" fill="none"/></svg>
    </section>
    <section aria-labelledby="progress-story"><h2 className={styles.sectionTitle} id="progress-story">Your story, unfolding.</h2><div className={styles.grid}>
      <Link className={`phone-app-card ${styles.card}`} href={`/dashboard/program/${program}/workout#workout-information-panel`}><Artwork kind="strength"/><div className={styles.copy}><p className={styles.eyebrow}>Strength</p><h3>Getting stronger</h3><p>Your recorded lifts over time.</p><Glimpse series={data.strength}/></div></Link>
      <Link className={`phone-app-card ${styles.card}`} href="/dashboard/assessment/measurements"><Artwork kind="body"/><div className={styles.copy}><p className={styles.eyebrow}>Body changes</p><h3>Beyond the scale</h3><p>Photos, measurements &amp; weight.</p><Glimpse series={data.body}/></div></Link>
      <Link className={`phone-app-card ${styles.card}`} href="/dashboard/recovery"><Artwork kind="energy"/><div className={styles.copy}><p className={styles.eyebrow}>How you feel</p><h3>Energy &amp; recovery</h3><p>Patterns in your check-ins.</p><Glimpse series={data.energy} gaps/></div></Link>
      <Link className={`phone-app-card ${styles.card}`} href="#progress-details"><Artwork kind="consistency"/><div className={styles.copy}><p className={styles.eyebrow}>Consistency</p><h3>Showing up for you</h3><p>Your moments of follow-through.</p><div className={styles.glimpse}>
        {data.completedSessions === null ? <p className={styles.empty}>Workout history is temporarily unavailable.</p> : data.completedSessions === 0 ? <p className={styles.empty}>No completed workout sessions in this period.</p> : <svg className={styles.bars} viewBox="0 0 240 70" role="img" aria-label={`Completed workout sessions. ${data.periodLabel}.`}><title>{data.consistency.map(bin => `${bin.start} to ${bin.end}: ${bin.count}`).join('; ')}</title>{data.consistency.map((bin, index) => { const width = 224 / data.consistency.length, height = bin.count / Math.max(1, ...data.consistency.map(item => item.count)) * 42; return <g key={bin.start}><rect x={8 + index * width + 3} y={49 - height} width={Math.max(3, width - 6)} height={height}/><text x={8 + (index + .5) * width} y={height ? 44 - height : 44}>{bin.count}</text>{data.consistency.length <= 4 ? <text x={8 + (index + .5) * width} y="65">{bin.label}</text> : null}</g> })}</svg>}
        {data.completedSessions !== null ? <span className={styles.caption}>{data.completedSessions} completed sessions · {data.workoutsCapped ? 'records shown' : data.periodLabel.toLowerCase()}</span> : null}<span className={styles.arrow} aria-hidden="true">›</span>
      </div></div></Link>
    </div></section>
  </>
}
