'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

export default function TrackEvent({
  event,
  properties = {},
}: {
  event: string
  properties?: Record<string, string | number | boolean | null>
}) {
  useEffect(() => {
    trackEvent(event, properties)
  }, [event])

  return null
}
