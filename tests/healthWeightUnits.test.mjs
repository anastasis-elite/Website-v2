import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { importTs } from './typescriptModule.mjs'

// The 16 health-weight cases are reused from combinedNutritionReaders.test.mjs
// at 4703c733b189accb34d3476135f9b73a4524f902 for the live 57cf462 base.
// Test-only adaptations: omit 12 consolidated history/auth cases and their
// foreign-row/period-error fixtures; check baseline identity, macros and water
// rather than the held consolidated micronutrient entitlement policy.
// The installed SDK, target service and GET handler execute with in-process
// synthetic transports. This is not real Auth/RLS or device-provider acceptance.
// Every physical network request and every write is refused.
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-17T17:00:00Z') })
after(() => mock.timers.reset())
const { calculateClientNutritionTargets } = await importTs('lib/nutrition/targetService.ts')
const route = await importTs('app/api/nutrition/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.combinedNutritionDb',
})
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const clientId = 'QA-COMBINED-NUTRITION-ONLY'
const currentValues = { birthdate: '1991-04-15', weight: '160', height_in: '67', weight_goal: 'strength' }
const row = (id, period, submittedAt, data = currentValues, extra = {}) => ({ id, client_id: clientId,
  auth_user_id: owner, assessment_type: 'strength', assessment_period: period, submitted_at: submittedAt, data, ...extra })
const current = () => row('qa-current-period', '2026-10-01', '2026-10-02T17:00:00Z')

function compareValues(a, b, { ascending, nullsFirst = !ascending }) {
  if (a == null || b == null) {
    if (a == null && b == null) return 0
    return a == null ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1)
  }
  const value = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  return value * (ascending ? 1 : -1)
}

function database(program, { assessments = [current()], healthMetrics = [] } = {}) {
  const client = { client_id: clientId, auth_user_id: owner, program, timezone: 'America/Chicago', birthdate: currentValues.birthdate }
  const tables = {
    clients: [client],
    assessments: [
      ...structuredClone(assessments),
      row('qa-initial', null, '2026-08-01T17:00:00Z', { trainingDays: '3', experienceLevel: 'some-experience', primaryFocus: 'strength' }, { assessment_type: 'initial' }),
    ],
    cycle_logs: [{ client_id: clientId, cycle_phase: 'luteal', log_date: '2026-10-17' }],
    daily_health_metrics: structuredClone(healthMetrics), health_integrations: [],
  }
  const calls = []
  const db = createClient('http://127.0.0.1:9', 'synthetic-combined-reader-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
      assert.equal(url.origin, 'http://127.0.0.1:9')
      assert.equal(init?.method || (typeof input === 'object' && input.method) || 'GET', 'GET', 'This fixture never accepts a mutation')
      const table = url.pathname.replace('/rest/v1/', '')
      assert.ok(Object.hasOwn(tables, table), `Unmocked table ${table}; no network fallback exists`)
      const call = { table, url: url.toString(), query: Object.fromEntries(url.searchParams), error: null }
      calls.push(call)
      let rows = tables[table].filter(value => [...url.searchParams].every(([key, expression]) => {
        if (['select', 'order', 'limit'].includes(key)) return true
        const actual = value[key]
        if (expression === 'is.null') return actual == null
        if (expression === 'not.is.null') return actual != null
        const match = /^(eq|gte|lte|lt|in)\.(.*)$/.exec(expression)
        assert.ok(match, `Unmocked filter ${key}=${expression}`)
        const [, op, expected] = match
        if (op === 'eq') return String(actual) === expected
        if (op === 'gte') return actual != null && String(actual) >= expected
        if (op === 'lte') return actual != null && String(actual) <= expected
        if (op === 'lt') return actual != null && String(actual) < expected
        return expected.slice(1, -1).split(',').includes(String(actual))
      }))
      const ordering = (url.searchParams.get('order') || '').split(',').filter(Boolean).map(expression => {
        const [key, direction, nulls] = expression.split('.')
        return { key, ascending: direction !== 'desc', ...(nulls ? { nullsFirst: nulls === 'nullsfirst' } : {}) }
      })
      if (ordering.length) rows = [...rows].sort((a, b) => {
        for (const order of ordering) {
          const compared = compareValues(a[order.key], b[order.key], order)
          if (compared) return compared
        }
        return 0
      })
      if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')))
      const selection = url.searchParams.get('select') || '*'
      if (selection !== '*') rows = rows.map(value => Object.fromEntries(selection.split(',').filter(key => key in value).map(key => [key, value[key]])))
      return Response.json(rows)
    } },
  })
  db.auth.getUser = async () => ({ data: { user: { id: owner } }, error: null })
  globalThis.combinedNutritionDb = db
  return { db, tables, calls, client }
}

async function getTargets(client = clientId, claimedProgram = 'phoenix') {
  const response = await route.GET(new Request(`http://127.0.0.1/api/nutrition?client_id=${client}&program=${claimedProgram}&auth_user_id=forged-owner`))
  return { response, body: await response.json() }
}

function assertSelectedInputs(nutrition) {
  assert.ok(Math.abs(nutrition.target.inputs.weightKg - 72.5747792) < .0001)
  assert.ok(Math.abs(nutrition.target.inputs.heightCm - 170.18) < .0001)
  assert.equal(nutrition.target.inputs.trainingFrequencyDaysPerWeek, 3)
  assert.equal(nutrition.weightLbs, 160)
  assert.equal(nutrition.water, 96)
  assert.equal(nutrition.phase, 'luteal')
}

function assertMemberBoundary(body, nutrition, program) {
  assert.equal(body.client_id, clientId)
  assert.equal(body.program, program, 'Stored tier remains authoritative over forged query input')
  for (const key of ['calories', 'protein', 'carbs', 'fats', 'calculationStatus', 'statusLabel', 'statusDescription', 'lastCalculatedAt']) {
    assert.deepEqual(body[key], nutrition.target[key], `${program}: personalized ${key} survives member boundary`)
  }
  assert.equal(body.water, nutrition.water)

}

for (const program of ['ember', 'ignite', 'phoenix']) {
  for (const [label, pounds, kilograms] of [
    ['80 lb below the legacy cutoff', 80, 36.2873896],
    ['90 lb at the legacy cutoff', 90, 40.8233133],
    ['160 lb already interpreted correctly', 160, 72.5747792],
    ['95 kg above the legacy cutoff', 95 / 0.45359237, 95],
  ]) {
    test(`${program}: health-weight kg/lb equivalence for ${label}`, async () => {
      const results = []
      for (const [value, unit] of [[kilograms, 'kg'], [pounds, 'lb']]) {
        const fixture = database(program, {
          assessments: [row('qa-health-fallback', '2026-10-01', '2026-10-02T17:00:00Z', { ...currentValues, weight: null })],
          healthMetrics: [{ client_id: clientId, metric_date: '2026-10-16', metric_type: 'body_weight', value, unit,
            source_providers: [unit === 'kg' ? 'health_connect' : 'apple_health'] }],
        })
        const before = structuredClone(fixture.tables)
        const nutrition = await calculateClientNutritionTargets({ supabase: fixture.db, clientId, program })
        assert.ok(Math.abs(nutrition.target.inputs.weightKg - kilograms) < 1e-10, `${value} ${unit} must resolve to ${kilograms} kg; got ${nutrition.target.inputs.weightKg}`)
        const { response, body } = await getTargets()
        assert.equal(response.status, 200)
        assertMemberBoundary(body, nutrition, program)
        assert.deepEqual(fixture.tables, before, 'Unit normalization reads never rewrite historical samples or targets')
        // Only floating-point representation of the canonical input may differ;
        // all rounded energy, macro, composition and hydration outputs must agree.
        const comparable = structuredClone(nutrition)
        delete comparable.target.inputs.weightKg
        results.push(comparable)
      }
      assert.deepEqual(results[0], results[1])
    })
  }

  test(`${program}: health-weight valid prior kg/lb outputs and assessment precedence are unchanged`, async () => {
    for (const [value, unit] of [[70, 'kg'], [160, 'lb']]) {
      const results = []
      for (const storedUnit of [undefined, unit]) {
        const fixture = database(program, {
          assessments: [row('qa-health-fallback', '2026-10-01', '2026-10-02T17:00:00Z', { ...currentValues, weight: null })],
          healthMetrics: [{ client_id: clientId, metric_date: '2026-10-16', metric_type: 'body_weight', value, unit: storedUnit }],
        })
        results.push(await calculateClientNutritionTargets({ supabase: fixture.db, clientId, program }))
      }
      assert.deepEqual(results[0], results[1], `${value} ${unit}: previously correct output stays identical`)
    }
    const fixture = database(program, { healthMetrics: [
      { client_id: clientId, metric_date: '2026-10-16', metric_type: 'body_weight', value: 95, unit: 'kg' },
    ] })
    assertSelectedInputs(await calculateClientNutritionTargets({ supabase: fixture.db, clientId, program }))
  })

}

test('health-weight legacy unknown-unit behavior and latest dated record selection remain unchanged', async () => {
  const assessments = [row('qa-health-fallback', '2026-10-01', '2026-10-02T17:00:00Z', { ...currentValues, weight: null })]
  for (const unit of [undefined, null, '', 'stone']) {
    for (const value of [80, 95]) {
      const fixture = database('ember', { assessments, healthMetrics: [
        { client_id: clientId, metric_date: '2026-10-16', metric_type: 'body_weight', value, unit },
      ] })
      const nutrition = await calculateClientNutritionTargets({ supabase: fixture.db, clientId, program: 'ember' })
      assert.equal(nutrition.target.inputs.weightKg, value > 90 ? value * 0.45359237 : value)
    }
  }
  const fixture = database('ember', { assessments, healthMetrics: [
    { client_id: clientId, metric_date: '2026-10-15', metric_type: 'body_weight', value: 80, unit: 'lb' },
    { client_id: clientId, metric_date: '2026-10-16', metric_type: 'body_weight', value: 95, unit: 'kg' },
  ] })
  const nutrition = await calculateClientNutritionTargets({ supabase: fixture.db, clientId, program: 'ember' })
  assert.equal(nutrition.target.inputs.weightKg, 95)
})
