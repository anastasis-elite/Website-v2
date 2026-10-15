import type { PostHog } from 'posthog-js'

let analytics: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
let scheduled = false
const pending: Array<Parameters<PostHog['capture']>> = []

async function loadAnalytics() {
  if (loading) return loading
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (typeof window === 'undefined' || !key) return null
  loading = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
    })
    analytics = posthog
    for (const event of pending.splice(0)) posthog.capture(...event)
    return posthog
  }).catch(() => {
    pending.length = 0
    return null // Optional analytics must never delay or fail a daily action.
  })
  return loading
}

export function startDeferredAnalytics() {
  if (scheduled || typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  scheduled = true
  // Wait until startup rendering/input has had time to finish. The bounded queue
  // is memory-only and contains the existing sanitized analytics properties.
  window.setTimeout(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => { void loadAnalytics() }, { timeout: 5000 })
    else void loadAnalytics()
  }, 1500)
}

const deferredAnalytics = {
  capture(...event: Parameters<PostHog['capture']>) {
    if (analytics) return analytics.capture(...event)
    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    if (pending.length >= 50) pending.shift()
    pending.push(event)
    startDeferredAnalytics()
  },
}

export default deferredAnalytics
