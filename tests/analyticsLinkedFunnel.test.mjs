import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'

const { buildLinkedFunnels } = await importTs('lib/analytics/funnel.ts')
const journeyA = 'anonymous_11111111-1111-4111-8111-111111111111'
const journeyB = 'anonymous_22222222-2222-4222-8222-222222222222'
const memberA = 'member_' + 'a'.repeat(64)
const memberB = 'member_' + 'b'.repeat(64)
const event = (name, second, patch = {}) => ({ event: name, occurredAt: `2026-11-01T12:00:${String(second).padStart(2, '0')}Z`, journeyId: journeyA, ...patch })
const totals = (result, id = 'acquisition') => result.funnels.find(funnel => funnel.id === id).steps.map(step => step.total)

test('consented anonymous landing, member checkout and server activation join as one ordered journey', () => {
  const report = buildLinkedFunnels([
    event('landing_page_viewed', 0), event('checkout_started', 1, { memberId: memberA }),
    event('subscription_activated', 2, { journeyId: journeyB, memberId: memberA }),
    event('analytics_identity_linked', 3, { memberId: memberA }),
    event('onboarding_completed', 4, { journeyId: journeyB, memberId: memberA }),
    event('first_workout_completed', 5, { journeyId: journeyB, memberId: memberA }),
  ])
  assert.deepEqual(totals(report), [1, 1, 1])
  assert.deepEqual(totals(report, 'workout'), [1, 1, 1])
  assert.equal(report.funnels[0].steps[2].percentOfPrevious, 100)
})

test('unrelated identities and out-of-order stages never become conversions', () => {
  const report = buildLinkedFunnels([
    event('checkout_started', 0), event('subscription_activated', 1), event('landing_page_viewed', 2),
    event('subscription_activated', 4, { journeyId: journeyB }),
  ])
  assert.deepEqual(totals(report), [1, 0, 0])
  assert.equal(report.funnels[0].steps[2].percentOfPrevious, 0)
  const withLaterAttempt = buildLinkedFunnels([
    event('checkout_started', 0), event('landing_page_viewed', 1), event('checkout_started', 2), event('subscription_activated', 3),
  ])
  assert.deepEqual(totals(withLaterAttempt), [1, 1, 1], 'A later actual ordered attempt remains eligible.')
})

test('reloads and retried event snapshots count each conversion once per linked identity', () => {
  const stream = [event('landing_page_viewed', 0), event('checkout_started', 1), event('subscription_activated', 2)]
  const report = buildLinkedFunnels([...stream, ...structuredClone(stream), event('landing_page_viewed', 3), event('checkout_started', 4)])
  assert.deepEqual(totals(report), [1, 1, 1])
  for (const funnel of report.funnels) for (const step of funnel.steps) assert.ok(step.percentOfStart <= 100 && step.percentOfPrevious <= 100)
})

test('account boundaries remain separate and conflicting anonymous bridges are excluded', () => {
  const isolated = buildLinkedFunnels([
    event('landing_page_viewed', 0, { memberId: memberA }), event('checkout_started', 1, { memberId: memberA }),
    event('subscription_activated', 2, { journeyId: journeyB, memberId: memberB }),
  ])
  assert.deepEqual(totals(isolated), [1, 1, 0])
  const ambiguous = buildLinkedFunnels([
    event('landing_page_viewed', 0), event('checkout_started', 1, { memberId: memberA }),
    event('analytics_identity_linked', 2, { memberId: memberB }), event('subscription_activated', 3, { memberId: memberB }),
  ])
  assert.deepEqual(totals(ambiguous), [0, 0, 0])
  assert.equal(ambiguous.quality.ambiguousJourneys, 1)
})

test('unlinked totals and invalid identifiers cannot supply a funnel denominator; optional audit is independent', () => {
  const report = buildLinkedFunnels([
    event('landing_page_viewed', 0, { journeyId: null }), event('checkout_started', 1, { journeyId: 'someone@example.test' }),
    event('subscription_activated', 2, { journeyId: null, memberId: 'raw-user-id' }),
    event('audit_started', 3), event('audit_page_completed', 4), event('audit_results_viewed', 5),
  ])
  assert.deepEqual(totals(report), [0, 0, 0])
  assert.deepEqual(totals(report, 'audit'), [1, 1, 1])
  assert.equal(report.quality.excludedEvents, 3)
})

test('report route requests bounded safe production fields and returns aggregates without attribution IDs', async () => {
  const route = await importTs('app/api/aos/analytics/route.ts', {
    'next/server': 'export const NextResponse = {json:(body,options)=>Response.json(body,options)}',
  })
  const previous = { fetch: globalThis.fetch, key: process.env.POSTHOG_PERSONAL_API_KEY, project: process.env.POSTHOG_PROJECT_ID }
  process.env.POSTHOG_PERSONAL_API_KEY = 'synthetic-test-key'
  process.env.POSTHOG_PROJECT_ID = 'synthetic-project'
  const queries = []
  globalThis.fetch = async (_url, options) => {
    const query = JSON.parse(options.body).query.query
    queries.push(query)
    if (query.includes('LIMIT 10000')) return Response.json({ results: [
      ['landing_page_viewed', '2026-11-01T12:00:00Z', journeyA, null],
      ['checkout_started', '2026-11-01T12:00:01Z', journeyA, memberA],
      ['subscription_activated', '2026-11-01T12:00:02Z', journeyA, memberA],
    ] })
    return Response.json({ results: [] })
  }
  try {
    const response = await route.GET()
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.deepEqual(payload.linkedFunnels.find(funnel => funnel.id === 'acquisition').steps.map(step => step.total), [1, 1, 1])
    assert.equal(payload.linkedQuality.truncated, false)
    assert.equal(queries.length, 3)
    assert.match(queries[2], /SELECT event, timestamp, properties\.journey_id, properties\.member_id/)
    assert.match(queries[2], /analytics_environment = 'production'/)
    assert.match(queries[2], /LIMIT 10000/)
    assert.doesNotMatch(queries[2], /current_url|email|capacity|recommended_program|person\.properties/)
    assert.doesNotMatch(JSON.stringify(payload), /anonymous_111|member_aaaa/)
    const ui = readFileSync('components/AOSAnalyticsLive.tsx', 'utf8')
    assert.match(ui, /They are not used to calculate conversion rates/)
    assert.match(ui, /linkedFunnels\.find/)
    assert.doesNotMatch(ui, /percent\(checkoutCompleted, checkoutStarted\)/)
  } finally {
    globalThis.fetch = previous.fetch
    if (previous.key === undefined) delete process.env.POSTHOG_PERSONAL_API_KEY; else process.env.POSTHOG_PERSONAL_API_KEY = previous.key
    if (previous.project === undefined) delete process.env.POSTHOG_PROJECT_ID; else process.env.POSTHOG_PROJECT_ID = previous.project
  }
})
