'use client'

import { useEffect } from 'react'
import { startDeferredAnalytics } from '@/lib/posthog'

export default function DeferredAnalytics() {
  useEffect(() => { startDeferredAnalytics() }, [])
  return null
}
