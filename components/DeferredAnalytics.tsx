'use client'

import { useEffect } from 'react'
import { canCaptureAnalytics, readAnalyticsConsentContext, refreshAnalyticsConsent, setAnalyticsIdentity, startDeferredAnalytics } from '@/lib/posthog'
import { ANALYTICS_CONSENT_STORAGE_KEY, writeAnalyticsContextCookie } from '@/lib/analytics/consent'
import { createClient } from '@/lib/supabase/client'

export default function DeferredAnalytics() {
  useEffect(() => {
    let active = true
    let identityVersion = 0
    let identityKnown = false
    let userId: string | null = null
    const syncConsent = async () => {
      refreshAnalyticsConsent()
      const version = identityVersion
      if (identityKnown) await setAnalyticsIdentity(userId)
      if (!active || version !== identityVersion) return
      if (identityKnown) startDeferredAnalytics()
      const context = readAnalyticsConsentContext()
      if (!context) return
      if (!identityKnown && context.accepted && !canCaptureAnalytics()) return
      writeAnalyticsContextCookie(context)
      void fetch('/api/analytics/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context) }).catch(() => {})
    }
    const sync = () => { void syncConsent() }
    const storage = (event: StorageEvent) => { if (event.key === 'cookie_consent' || event.key === ANALYTICS_CONSENT_STORAGE_KEY) sync() }
    window.addEventListener('analytics-consent-changed', sync)
    window.addEventListener('storage', storage)
    startDeferredAnalytics()
    sync()
    let unsubscribe: (() => void) | undefined
    try {
      const supabase = createClient()
      const initialVersion = identityVersion
      void supabase.auth.getUser().then(({ data: { user } }) => { if (active && identityVersion === initialVersion) { identityKnown = true; userId = user?.id || null; sync() } }).catch(() => {})
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) { identityKnown = true; identityVersion++; userId = session?.user.id || null; sync() }
      })
      unsubscribe = () => data.subscription.unsubscribe()
    } catch { /* Public pages and restricted storage do not require analytics identity. */ }
    return () => { active = false; unsubscribe?.(); window.removeEventListener('analytics-consent-changed', sync); window.removeEventListener('storage', storage) }
  }, [])
  return null
}
