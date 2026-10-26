import styles from './TodayPlanTheme.module.css'

export default function TodayStreakBadge({ count, available = false, loading = false }: { count?: number | null; available?: boolean; loading?: boolean }) {
  const confirmed = !loading && available && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
  const label = confirmed ? `${count} ${count === 1 ? 'day' : 'days'} streak` : loading ? 'Streak loading' : 'Streak unavailable'
  return <span className={styles.streakBadge} data-testid="today-streak" aria-label={label} aria-busy={loading || undefined}>
    <svg viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path d="M13 2c2 7-3 8-2 13 3-1 5-4 5-7 5 5 7 9 5 14-2 6-13 7-17 1C0 17 4 12 7 8c0 4 1 5 2 6-1-5 2-8 4-12Z" fill="currentColor"/><path d="M12 16c-4 5-4 8 0 9 4-1 4-4 0-9Z" fill="#3f2717"/></svg>
    <span aria-hidden="true">{confirmed ? count : '—'}</span>
  </span>
}
