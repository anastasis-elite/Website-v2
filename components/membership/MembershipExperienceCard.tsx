'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { ExperienceState } from '@/lib/membership/experience'
import styles from './experience.module.css'

/** A failed check-in read never interrupts the member's dashboard. */
export default function MembershipExperienceCard({ clientId }: { clientId: string }) {
  const onExperiencePage = usePathname() === '/dashboard/experience'
  const [state, setState] = useState<ExperienceState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    let active = true, fetching = false
    if (onExperiencePage || dismissed) return
    async function refresh() {
      if (!active || fetching || document.visibilityState !== 'visible') return
      fetching = true
      try {
        const response = await fetch('/api/membership/experience', { cache: 'no-store', credentials: 'same-origin' })
        const value = response.ok ? await response.json() : null
        if (active && value?.clientId === clientId && typeof value.eligible === 'boolean' && Array.isArray(value.milestones)) setState(value)
      } catch { /* The optional card stays absent; the main dashboard remains usable. */ }
      finally { fetching = false }
    }
    const resumed = () => { void refresh() }
    void refresh()
    document.addEventListener('visibilitychange', resumed)
    window.addEventListener('focus', resumed)
    window.addEventListener('anastasis:daily-plan-updated', resumed)
    return () => { active = false; document.removeEventListener('visibilitychange', resumed); window.removeEventListener('focus', resumed); window.removeEventListener('anastasis:daily-plan-updated', resumed) }
  }, [clientId, onExperiencePage, dismissed])
  const milestone = state?.eligible && state.milestones.find(row => row.status === 'open' && row.can_respond && !row.feedback)
  if (onExperiencePage || dismissed || !milestone) return null
  return <aside className={styles.card} aria-label="Membership experience check-in">
    <h2>A moment to check in</h2>
    <p>Your {milestone.months}-month membership check-in is available. How has your experience been, and would you like to continue?</p>
    <div className={styles.actions}><Link href="/dashboard/experience">Share your experience</Link><button type="button" onClick={() => setDismissed(true)}>Not now</button></div>
  </aside>
}
