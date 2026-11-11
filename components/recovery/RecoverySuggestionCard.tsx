'use client'

import { useEffect, useId, useState } from 'react'
import { addLocalDays, localDateKey } from '@/lib/timezone'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'
import type { RecoveryRewardSuggestion } from '@/lib/recovery/rewardSuggestion'
import styles from './RecoverySuggestionCard.module.css'

/** Reading or dismissing this optional idea never records recovery completion. */
export default function RecoverySuggestionCard({ suggestion, clientId, date, timezone }: {
  suggestion?: RecoveryRewardSuggestion
  clientId: string
  date: string
  timezone: string
}) {
  const headingId = useId()
  const [dismissedKey, setDismissedKey] = useState('')
  const [expiredKey, setExpiredKey] = useState('')
  const key = `${clientId}:${date}:${suggestion?.id || ''}`
  const matching = suggestion?.version === 1 && suggestion.clientId === clientId &&
    suggestion.date === date && suggestion.timezone === timezone
  let currentDay = false
  try { currentDay = matching && localDateKey(new Date(), timezone) === date } catch { /* Invalid scope stays hidden. */ }

  useEffect(() => {
    if (!matching || !currentDay) return
    const checkDay = () => {
      if (localDateKey(new Date(), timezone) !== date) setExpiredKey(key)
    }
    checkDay()
    const boundary = zonedDateTimeToUtc(addLocalDays(date, 1), '00:00', timezone).getTime()
    const timer = window.setTimeout(checkDay, Math.max(0, boundary - Date.now()) + 1)
    window.addEventListener('focus', checkDay)
    document.addEventListener('visibilitychange', checkDay)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', checkDay)
      document.removeEventListener('visibilitychange', checkDay)
    }
  }, [matching, currentDay, key, date, timezone])

  if (!matching || !currentDay || expiredKey === key || (suggestion.kind === 'reward' && dismissedKey === key)) return null
  const safety = suggestion.kind === 'safety'
  return <aside className={styles.card} aria-labelledby={headingId} data-recovery-suggestion={suggestion.id} data-kind={suggestion.kind}>
    <p className={styles.eyebrow}>{safety ? 'Your care comes first' : 'A little something for you · Optional'}</p>
    <h2 id={headingId}>{suggestion.title}</h2>
    <p>{suggestion.description}</p>
    {safety ? null : <button type="button" onClick={() => setDismissedKey(key)}>Maybe another time</button>}
  </aside>
}
