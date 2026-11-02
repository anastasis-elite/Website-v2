'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'
import { ANALYTICS_IDENTITY_READY_EVENT, canCaptureAnalytics } from '@/lib/posthog'

export default function TrackEvent({
  event,
  properties = {},
}: {
  event: string
  properties?: Record<string, string | number | boolean | null>
}) {
  const emitted = useRef<string | null>(null)
  useEffect(() => {
    const captureRenderedView = () => {
      if (emitted.current === event || !canCaptureAnalytics()) return
      emitted.current = event
      trackEvent(event, properties)
    }
    captureRenderedView()
    window.addEventListener('analytics-consent-changed', captureRenderedView)
    window.addEventListener(ANALYTICS_IDENTITY_READY_EVENT, captureRenderedView)
    return () => { window.removeEventListener('analytics-consent-changed', captureRenderedView); window.removeEventListener(ANALYTICS_IDENTITY_READY_EVENT, captureRenderedView) }
  }, [event, properties])

  return null
}
