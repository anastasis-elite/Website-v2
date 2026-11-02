import { trackEvent } from '@/lib/analytics'
import { ANALYTICS_IDENTITY_READY_EVENT, canCaptureAnalytics } from '@/lib/posthog'
import { ANALYTICS_CONSENT_STORAGE_KEY } from '@/lib/analytics/consent'

export const HOMEPAGE_EXPERIMENT_ID = 'homepage_storytelling_v1'
export const HOMEPAGE_VERSION = 'storytelling_v1'

const sectionEvents = {
  story: 'homepage_story_section_viewed',
  founder: 'homepage_founder_section_viewed',
  community: 'homepage_community_section_viewed',
} as const

const auditEvents = {
  hero: 'audit_cta_clicked_1',
  outcome: 'audit_cta_clicked_2',
  final_cta: 'audit_cta_clicked_3',
} as const

const programLocations: Record<string, string> = {
  seen: 'features',
  start: 'final_cta',
  outcome: 'outcome',
  'how-it-works': 'how_it_works',
  'for-you': 'for_you',
  story: 'story',
  founder: 'founder',
  community: 'community',
}

// The main element survives React's development effect replay. A real homepage
// navigation creates a new main element, and therefore a new measured page view.
const measuredViews = new WeakMap<HTMLElement, Set<string>>()
const handledClicks = new WeakSet<Event>()

function capture(event: string, properties: Record<string, string> = {}) {
  if (!canCaptureAnalytics()) return false
  // Acceptance means collection eligibility, never external ingestion proof.
  return trackEvent(event, {
    page: 'landing',
    experiment_id: HOMEPAGE_EXPERIMENT_ID,
    homepage_version: HOMEPAGE_VERSION,
    ...properties,
  })
}

/** Homepage-only observer; it never reads audit answers, member data, or text. */
export function mountHomepageAnalytics(root: HTMLElement) {
  const measured = measuredViews.get(root) ?? new Set<string>()
  measuredViews.set(root, measured)
  const visibleHeadings = new Set<HTMLElement>()
  const headingSections = new Map<HTMLElement, keyof typeof sectionEvents>()
  let disposed = false

  function captureOnce(event: string) {
    if (measured.has(event)) return true
    if (!capture(event)) return false
    measured.add(event)
    return true
  }

  function isCurrentlyVisible(heading: HTMLElement) {
    if (!heading.isConnected || !root.contains(heading)) return false
    const bounds = heading.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return false
    const width = document.documentElement?.clientWidth || window.innerWidth
    const height = document.documentElement?.clientHeight || window.innerHeight
    const visibleWidth = Math.max(0, Math.min(bounds.right, width) - Math.max(bounds.left, 0))
    const visibleHeight = Math.max(0, Math.min(bounds.bottom, height) - Math.max(bounds.top, 0))
    return visibleWidth * visibleHeight / (bounds.width * bounds.height) >= 0.2
  }

  function captureVisibleSections() {
    if (disposed || !root.isConnected || !canCaptureAnalytics()) return
    captureOnce('landing_page_viewed')
    for (const heading of visibleHeadings) {
      const section = headingSections.get(heading)
      if (section && isCurrentlyVisible(heading) && captureOnce(sectionEvents[section])) observer?.unobserve(heading)
    }
  }

  const observer = typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver((entries) => {
      if (disposed) return
      for (const entry of entries) {
        const heading = entry.target as HTMLElement
        if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
          visibleHeadings.add(heading)
        } else {
          visibleHeadings.delete(heading)
        }
      }
      captureVisibleSections()
    }, { threshold: [0, 0.2] })

  for (const id of Object.keys(sectionEvents) as Array<keyof typeof sectionEvents>) {
    const section = root.querySelector<HTMLElement>(`#${id}`)
    // A heading stays reachable on short mobile/landscape viewports, while
    // 20% of the full founder or story section may exceed the viewport height.
    const heading = section?.querySelector<HTMLElement>('h2')
    if (heading) {
      headingSections.set(heading, id)
      observer?.observe(heading)
    }
  }

  function handleClick(event: MouseEvent) {
    if (disposed || !root.isConnected) return
    // CookieBanner writes localStorage in its React click handler. Read the
    // decision after that handler, including for consent granted in this tab.
    queueMicrotask(captureVisibleSections)
    if (handledClicks.has(event) || !(event.target instanceof Element)) return
    const link = event.target.closest<HTMLAnchorElement>('a[href]')
    if (!link) return

    let url: URL
    try {
      url = new URL(link.href, window.location.origin)
    } catch {
      return
    }
    if (url.origin !== window.location.origin) return
    const auditLocation = link.closest<HTMLElement>('[data-homepage-audit-cta]')
      ?.dataset.homepageAuditCta as keyof typeof auditEvents | undefined
    if (auditLocation && Object.hasOwn(auditEvents, auditLocation) && /^\/audit\/?$/.test(url.pathname)) {
      handledClicks.add(event)
      capture(auditEvents[auditLocation], {
        location: auditLocation,
        cta_location: auditLocation,
      })
      return
    }

    const program = /^\/program(?:\/(ember|ignite|phoenix))?\/?$/.exec(url.pathname)
    if (!program) return
    handledClicks.add(event)
    const sectionId = link.closest('section')?.id || ''
    const location = root.contains(link)
      ? Object.hasOwn(programLocations, sectionId) ? programLocations[sectionId] : 'programs'
      : link.closest('header, nav') ? 'navigation' : 'footer'
    capture('homepage_program_cta_clicked', {
      program: program[1] || 'all',
      location,
      cta_location: location,
    })
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === 'cookie_consent' || event.key === ANALYTICS_CONSENT_STORAGE_KEY) captureVisibleSections()
  }

  document.addEventListener('click', handleClick)
  window.addEventListener('storage', handleStorage)
  window.addEventListener('analytics-consent-changed', captureVisibleSections)
  window.addEventListener(ANALYTICS_IDENTITY_READY_EVENT, captureVisibleSections)
  captureVisibleSections()

  return () => {
    disposed = true
    observer?.disconnect()
    visibleHeadings.clear()
    headingSections.clear()
    document.removeEventListener('click', handleClick)
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('analytics-consent-changed', captureVisibleSections)
    window.removeEventListener(ANALYTICS_IDENTITY_READY_EVENT, captureVisibleSections)
  }
}
