import posthog from '@/lib/posthog'

export function trackEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | null>
): boolean {
  if (typeof window === 'undefined') return false

  return posthog.capture(eventName, properties)
}
