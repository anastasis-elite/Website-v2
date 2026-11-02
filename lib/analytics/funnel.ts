export type LinkedEvent = {
  event: string
  occurredAt: string
  journeyId?: string | null
  memberId?: string | null
}
export type LinkedFunnelStep = {
  event: string
  label: string
  total: number
  percentOfStart: number
  percentOfPrevious: number
}
export type LinkedFunnel = { id: string; label: string; steps: LinkedFunnelStep[] }

const profiles = [
  { id: 'acquisition', label: 'Landing to subscription', events: ['landing_page_viewed', 'checkout_started', 'subscription_activated'] },
  { id: 'audit', label: 'Capacity Audit', events: ['audit_started', 'audit_page_completed', 'audit_results_viewed'] },
  { id: 'pricing', label: 'Pricing to subscription', events: ['pricing_viewed', 'checkout_started', 'subscription_activated'] },
  { id: 'workout', label: 'Subscription to first workout', events: ['subscription_activated', 'onboarding_completed', 'first_workout_completed'] },
  { id: 'nutrition', label: 'Subscription to first nutrition entry', events: ['subscription_activated', 'first_nutrition_completed'] },
  { id: 'recovery', label: 'Subscription to first recovery entry', events: ['subscription_activated', 'first_recovery_completed'] },
] as const
const labels: Record<string, string> = {
  landing_page_viewed: 'Landing viewed', audit_started: 'Audit started', audit_page_completed: 'Audit completed', audit_results_viewed: 'Results viewed',
  pricing_viewed: 'Pricing viewed', checkout_started: 'Checkout started', subscription_activated: 'Subscription activated', onboarding_completed: 'Onboarding saved',
  first_workout_completed: 'First workout completed', first_nutrition_completed: 'First nutrition saved', first_recovery_completed: 'First recovery saved',
}
export const LINKED_FUNNEL_EVENTS = [...new Set([...profiles.flatMap(profile => [...profile.events]), 'analytics_identity_linked'])]
const journeyPattern = /^anonymous_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const memberPattern = /^member_[0-9a-f]{64}$/
const percent = (part: number, whole: number) => whole > 0 ? Math.round(part / whole * 100) : 0

/** Count only ordered prefixes observed for the same consented pseudonymous identity. */
export function buildLinkedFunnels(input: LinkedEvent[]) {
  const supported = new Set(LINKED_FUNNEL_EVENTS)
  const parsed = input.flatMap(row => {
    const time = typeof row.occurredAt === 'string' ? Date.parse(row.occurredAt) : NaN
    if (!supported.has(row.event) || !Number.isFinite(time)) return []
    const journey = typeof row.journeyId === 'string' && journeyPattern.test(row.journeyId) ? row.journeyId.toLowerCase() : null
    const member = typeof row.memberId === 'string' && memberPattern.test(row.memberId) ? row.memberId : null
    return journey || member ? [{ event: row.event, time, journey, member }] : []
  })
  const associations = new Map<string, Set<string>>()
  for (const row of parsed) {
    if (!row.journey || !row.member) continue
    if (!associations.has(row.journey)) associations.set(row.journey, new Set())
    associations.get(row.journey)!.add(row.member)
  }
  const ambiguous = new Set([...associations].filter(([, members]) => members.size > 1).map(([journey]) => journey))
  const eventsByIdentity = new Map<string, Map<string, number[]>>()
  let acceptedEvents = 0
  for (const row of parsed) {
    if (row.journey && ambiguous.has(row.journey) || row.event === 'analytics_identity_linked') continue
    const linkedMember = row.journey ? associations.get(row.journey)?.values().next().value as string | undefined : undefined
    const identity = linkedMember || row.member || row.journey!
    if (!eventsByIdentity.has(identity)) eventsByIdentity.set(identity, new Map())
    const events = eventsByIdentity.get(identity)!
    if (!events.has(row.event)) events.set(row.event, [])
    events.get(row.event)!.push(row.time)
    acceptedEvents++
  }
  for (const events of eventsByIdentity.values()) for (const times of events.values()) times.sort((a, b) => a - b)
  const funnels: LinkedFunnel[] = profiles.map(profile => {
    const totals = profile.events.map(() => 0)
    for (const events of eventsByIdentity.values()) {
      let previous = -Infinity
      for (const [index, event] of profile.events.entries()) {
        const next = events.get(event)?.find(time => time >= previous)
        if (next === undefined) break
        totals[index]++
        previous = next
      }
    }
    return { id: profile.id, label: profile.label, steps: profile.events.map((event, index) => ({
      event, label: labels[event], total: totals[index], percentOfStart: percent(totals[index], totals[0]),
      percentOfPrevious: percent(totals[index], index > 0 ? totals[index - 1] : totals[0]),
    })) }
  })
  return { funnels, quality: { acceptedEvents, excludedEvents: input.length - acceptedEvents, ambiguousJourneys: ambiguous.size } }
}
