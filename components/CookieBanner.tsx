'use client'

import { useState, useEffect } from 'react'
import { refreshAnalyticsConsent, setAnalyticsConsent } from '@/lib/posthog'
import { safeAnalyticsPath } from '@/lib/analytics/privacy'

const GA_ID = 'G-TVXM35PHD0'

function loadGoogleAnalytics() {
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = false
  if (document.getElementById('ga-script')) return

  const script1 = document.createElement('script')
  script1.id = 'ga-script'
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  script1.async = true
  document.head.appendChild(script1)

  const script2 = document.createElement('script')
  script2.id = 'ga-init'
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}', {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_path: ${JSON.stringify(safeAnalyticsPath(window.location.pathname) || '/')},
      page_location: ${JSON.stringify(window.location.origin + (safeAnalyticsPath(window.location.pathname) || '/'))},
      page_referrer: '',
    });
  `
  document.head.appendChild(script2)
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let consent: string | null = null
    try { consent = localStorage.getItem('cookie_consent') } catch { /* Capture stays disabled without a stored choice. */ }
    refreshAnalyticsConsent()

    if (consent !== 'accepted' && consent !== 'declined') {
      setVisible(true)
    }

    if (consent === 'accepted') {
      loadGoogleAnalytics()
    } else {
      ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true
    }
    const syncGoogleConsent = () => {
      let accepted = false
      try { accepted = localStorage.getItem('cookie_consent') === 'accepted' } catch { /* No stored choice is not consent. */ }
      if (accepted) loadGoogleAnalytics()
      else (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true
    }
    const storage = (event: StorageEvent) => { if (event.key === 'cookie_consent') syncGoogleConsent() }
    window.addEventListener('analytics-consent-changed', syncGoogleConsent)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener('analytics-consent-changed', syncGoogleConsent); window.removeEventListener('storage', storage) }
  }, [])

  function accept() {
    setAnalyticsConsent('accepted')
    setVisible(false)
    loadGoogleAnalytics()
  }

  function decline() {
    setAnalyticsConsent('declined')
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: '#000',
        color: '#fff',
        padding: '20px',
        zIndex: 1400,
        borderTop: '1px solid rgba(197,139,87,0.4)',
      }}
    >
      <p>
        We use cookies to improve your experience and analyze site traffic.
        You can accept or decline.
      </p>

      <button onClick={accept}>Accept</button>
      <button onClick={decline}>Decline</button>
    </div>
  )
}
