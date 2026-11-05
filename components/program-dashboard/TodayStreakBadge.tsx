import streakFlame from '@/public/images/card-artwork/streak-flame.webp'
import styles from './TodayPlanTheme.module.css'

export default function TodayStreakBadge({ count, available = false, loading = false }: { count?: number | null; available?: boolean; loading?: boolean }) {
  const confirmed = !loading && available && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
  const label = confirmed ? `${count} ${count === 1 ? 'day' : 'days'} streak` : loading ? 'Streak loading' : 'Streak unavailable'
  return <span className={styles.streakBadge} data-testid="today-streak" aria-label={label} aria-busy={loading || undefined}>
    <img src={streakFlame.src} width="32" height="32" alt="" aria-hidden="true" decoding="async" />
    <span aria-hidden="true">{confirmed ? count : '—'}</span>
  </span>
}
