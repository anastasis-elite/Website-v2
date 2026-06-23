import posthog from '@/lib/posthog'

export function trackEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | null>
) {
  if (typeof window === 'undefined') return

  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  })
}
