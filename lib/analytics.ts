import posthog from '@/lib/posthog'
import { sanitizeAnalyticsProperties } from '@/lib/analytics/sensitiveHealthData'

export function trackEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | null>
) {
  if (typeof window === 'undefined') return

  posthog.capture(eventName, {
    ...sanitizeAnalyticsProperties(properties),
    timestamp: new Date().toISOString(),
  })
}
