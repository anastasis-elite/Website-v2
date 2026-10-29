'use client'

import { useEffect } from 'react'
import { mountHomepageAnalytics } from '@/lib/analytics/homepageStorytelling'

export default function HomepageAnalytics() {
  useEffect(() => {
    const homepage = document.querySelector<HTMLElement>('main.landing-page')
    if (homepage) return mountHomepageAnalytics(homepage)
  }, [])

  return null
}
