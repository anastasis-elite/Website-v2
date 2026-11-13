import type { CaptureResult, PostHog } from 'posthog-js'
import { filterAnalyticsEvent, SERVER_CONVERSION_EVENTS } from '@/lib/analytics/privacy'
import { ANALYTICS_JOURNEY_OWNER_KEY, getCurrentJourneyId, hasStoredAnalyticsConsent, readAnalyticsConsentContext, resetAnalyticsJourney, storeAnalyticsConsent, writeAnalyticsContextCookie } from '@/lib/analytics/consent'
export { getCurrentJourneyId, readAnalyticsConsentContext } from '@/lib/analytics/consent'

let analytics: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
let scheduled = false
let generation = 0
let currentUser: string | null = null
let identity: string | null = null
let identityPending = false
let initialIdentityResolved = false
export const ANALYTICS_IDENTITY_READY_EVENT = 'analytics-identity-ready'
const pending: Array<{ event: string; properties: Record<string, string | number | boolean> }> = []

export function hasAnalyticsConsent() {
  return hasStoredAnalyticsConsent()
}

/** A previous member's persisted bridge is unusable until auth confirms its owner. */
export function canCaptureAnalytics() {
  if (identityPending || !hasAnalyticsConsent()) return false
  try {
    const owner = window.localStorage.getItem(ANALYTICS_JOURNEY_OWNER_KEY)
    if (owner) return initialIdentityResolved && currentUser !== null && identity === owner && identity.startsWith('member_')
    return !identity || identity.startsWith('anonymous_')
  } catch { return false }
}

function identityReady() {
  if (canCaptureAnalytics()) window.dispatchEvent(new Event(ANALYTICS_IDENTITY_READY_EVENT))
}

function anonymousIdentity() {
  if (identity) return identity
  identity = getCurrentJourneyId() || null
  return identity
}

/** Strip automatic SDK properties after enrichment, at the wire boundary. */
export function scrubAnalyticsCapture(capture: CaptureResult | null): CaptureResult | null {
  if (!capture || !canCaptureAnalytics() || SERVER_CONVERSION_EVENTS.has(capture.event)) return null
  const safe = filterAnalyticsEvent(capture.event, capture.properties)
  if (!safe) return null
  // PostHog's ingestion token is transport metadata, not an event property to
  // accept from callers. Restore the same public project key used by init.
  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!token) return null
  const distinctId = identity || anonymousIdentity()
  const journeyId = getCurrentJourneyId()
  if (!distinctId || !journeyId) return null
  try {
    if (distinctId.startsWith('member_') && window.localStorage.getItem(ANALYTICS_JOURNEY_OWNER_KEY) !== distinctId) return null
    if (distinctId.startsWith('anonymous_') && (window.localStorage.getItem(ANALYTICS_JOURNEY_OWNER_KEY) || distinctId !== journeyId)) return null
  } catch { return null }
  return { uuid: capture.uuid, event: safe.event, properties: { ...safe.properties, token, distinct_id: distinctId, journey_id: journeyId,
    ...(distinctId.startsWith('member_') ? { member_id: distinctId } : {}), $process_person_profile: false, $geoip_disable: true },
    ...(capture.timestamp instanceof Date && Number.isFinite(capture.timestamp.getTime()) ? { timestamp: capture.timestamp } : {}) }
}

async function loadAnalytics() {
  if (analytics || !canCaptureAnalytics()) return analytics
  if (loading) return loading
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  const expectedGeneration = generation
  loading = import('posthog-js').then(({ default: posthog }) => {
    if (!canCaptureAnalytics() || expectedGeneration !== generation) return null
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: false, capture_pageleave: false, autocapture: false, ip: false,
      disable_session_recording: true, enable_recording_console_log: false,
      capture_exceptions: false, capture_performance: false, disable_surveys: true,
      advanced_disable_flags: true, disable_external_dependency_loading: true,
      person_profiles: 'never', persistence: 'memory', before_send: scrubAnalyticsCapture,
    })
    analytics = posthog
    posthog.stopSessionRecording()
    for (const event of pending.splice(0)) if (canCaptureAnalytics()) posthog.capture(event.event, event.properties)
    return posthog
  }).catch(() => { pending.length = 0; return null }).finally(() => { loading = null })
  return loading
}

export function startDeferredAnalytics() {
  if (scheduled || !canCaptureAnalytics() || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  scheduled = true
  window.setTimeout(() => {
    scheduled = false
    if (!canCaptureAnalytics()) return
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => { void loadAnalytics() }, { timeout: 5000 })
    else void loadAnalytics()
  }, 1500)
}

export function resetAnalyticsIdentity(retainConsentClient = false) {
  generation++; pending.length = 0; currentUser = null; identity = null; identityPending = false; initialIdentityResolved = true
  resetAnalyticsJourney(!retainConsentClient)
  analytics?.stopSessionRecording()
  analytics?.reset(true)
}

export async function setAnalyticsIdentity(userId: string | null) {
  let previousOwner: string | null = null
  try { previousOwner = window.localStorage.getItem(ANALYTICS_JOURNEY_OWNER_KEY) } catch { /* No persisted bridge is available. */ }
  if (userId === currentUser && !identityPending && (userId !== null ? identity === previousOwner : !previousOwner)) {
    initialIdentityResolved = true
    identityReady()
    return
  }
  if (!hasAnalyticsConsent() || !userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    resetAnalyticsIdentity(!hasAnalyticsConsent())
    identityReady()
    return
  }
  const accountChanged = currentUser !== null && currentUser !== userId
  if (accountChanged) { resetAnalyticsIdentity(); previousOwner = null }
  else { generation++; pending.length = 0; identity = null }
  identityPending = true
  currentUser = userId
  const expectedGeneration = generation
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`anastasis-analytics-v1:${userId.toLowerCase()}`))
    if (generation !== expectedGeneration || !hasAnalyticsConsent()) return
    const memberIdentity = `member_${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
    if (previousOwner && previousOwner !== memberIdentity) resetAnalyticsIdentity()
    currentUser = userId
    getCurrentJourneyId()
    window.localStorage.setItem(ANALYTICS_JOURNEY_OWNER_KEY, memberIdentity)
    identity = memberIdentity
    identityPending = false
    initialIdentityResolved = true
    writeAnalyticsContextCookie(readAnalyticsConsentContext())
    identityReady()
  } catch { currentUser = null; identity = null; identityPending = false; initialIdentityResolved = true; resetAnalyticsJourney(true) }
}

export function refreshAnalyticsConsent() {
  if (!hasAnalyticsConsent()) {
    resetAnalyticsIdentity(true)
    analytics?.opt_out_capturing()
    return
  }
  // before_send rejects the SDK opt-in event as well as person-profile events.
  analytics?.opt_in_capturing()
  startDeferredAnalytics()
}

export function setAnalyticsConsent(choice: 'accepted' | 'declined') {
  storeAnalyticsConsent(choice)
  refreshAnalyticsConsent()
  window.dispatchEvent(new Event('analytics-consent-changed'))
}

const deferredAnalytics = {
  // This reports local acceptance only, never a provider delivery receipt.
  capture(event: string, properties?: Record<string, unknown>): boolean {
    if (!canCaptureAnalytics() || SERVER_CONVERSION_EVENTS.has(event) || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return false
    const safe = filterAnalyticsEvent(event, properties)
    if (!safe || !getCurrentJourneyId()) return false
    if (analytics) {
      try { return Boolean(analytics.capture(safe.event, safe.properties)) } catch { return false }
    }
    if (pending.length >= 50) return false
    pending.push(safe)
    startDeferredAnalytics()
    return true
  },
}
export default deferredAnalytics
