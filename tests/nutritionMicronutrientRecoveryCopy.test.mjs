import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { getTierCapabilities } = await importTs('lib/entitlements.ts')
globalThis.micronutrientRecoveryCopyCapabilities = getTierCapabilities
const legacyCapability = 'export const getTierCapabilities = program => ({ ...globalThis.micronutrientRecoveryCopyCapabilities(program), nutritionMicronutrients: true })'
const recoveryMocks = {
  '@/lib/timezone': 'export const getClientLocalDate = () => "2026-10-17"',
  '@/lib/workout/history': `
    export const loadWorkoutHistory = async ({ authUserId, startDate, completed, limit }) => {
      const fixture = globalThis.micronutrientRecoveryCopyFixture
      fixture.calls.push(['loadWorkoutHistory', { authUserId, startDate, completed, limit }])
      return { data: fixture.workouts, error: null }
    }
  `,
  '@/lib/cycle/getCycleStatus': 'export const getCycleStatus = () => structuredClone(globalThis.micronutrientRecoveryCopyFixture.cycleStatus)',
}
const recovery = await importTs('lib/recovery/getRecoveryRecommendation.ts', recoveryMocks)
// True capability preserves the exact pre-gate member copy for the same inputs/tier.
const previousRecovery = await importTs('lib/recovery/getRecoveryRecommendation.ts', {
  ...recoveryMocks, '@/lib/entitlements': legacyCapability,
})
const insightMocks = {
  '@/lib/accountability/accountabilityEngine': 'export const runAccountabilityPartnerEngine = undefined',
  '@/lib/accountability/astrologyProfile': 'export const buildNatalProfile = undefined',
}
const insights = await importTs('lib/dashboard/dailyInsight.ts', insightMocks)
const previousInsights = await importTs('lib/dashboard/dailyInsight.ts', {
  ...insightMocks, '@/lib/entitlements': legacyCapability,
})
const tiers = ['ember', 'EMBER', 'invalid-tier', null, undefined, 'ignite', 'phoenix']

async function recommendation(module, program, options = {}) {
  const fixture = {
    recoveryLog: options.recoveryLog ?? null,
    nutritionLog: options.nutritionLog === undefined ? { id: 'synthetic-nutrition-log' } : options.nutritionLog,
    flowBurden: options.flowBurden ?? null,
    workouts: options.workouts ?? [],
    mealCount: options.mealCount ?? 0,
    cycleStatus: options.cycleStatus ?? { enabled: false, recoveryCaution: false, recoveryNote: null },
    calls: [],
  }
  globalThis.micronutrientRecoveryCopyFixture = fixture
  const supabase = {
    from(table) {
      fixture.calls.push(['from', table])
      const query = {}
      for (const method of ['select', 'eq', 'order', 'limit']) {
        query[method] = (...args) => { fixture.calls.push([method, ...args]); return query }
      }
      const result = () => ({
        data: table === 'recovery_logs' ? fixture.recoveryLog
          : table === 'nutrition_logs' ? fixture.nutritionLog
          : table === 'cycle_burden_scores' ? fixture.flowBurden : [],
        count: table === 'meal_entries' ? fixture.mealCount : undefined,
        error: null,
      })
      query.maybeSingle = async () => result()
      query.then = (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
      return query
    },
  }
  const output = await module.getRecoveryRecommendation({
    supabase, client: { client_id: 'synthetic-client', program }, user: { id: 'synthetic-user' },
  })
  return { output, calls: fixture.calls }
}

function withoutRecommendation({ recommendation, ...result }) { return result }

const copyCases = [
  {
    name: 'low hydration', options: { recoveryLog: { hydration_level: 4 } }, focus: 'hydration',
    previous: 'Before adding sauna or extra recovery stress, stabilize hydration. Aim for steady water and electrolytes first so your system has enough fluid support to recover well.',
    restricted: 'Before adding sauna or extra recovery stress, stabilize hydration. Aim for steady water first so your system has enough fluid support to recover well.',
  },
  {
    name: 'high flow burden', options: { flowBurden: { burden_band: 'high', burden_score: 28 } }, focus: 'cycle_support',
    previous: 'Today’s cycle log shows higher flow burden. Keep training decisions conservative, prioritize enough food, hydration, electrolytes, and recovery signals, and consider follow-up if this pattern feels unusual or severe.',
    restricted: 'Today’s cycle log shows higher flow burden. Keep training decisions conservative, prioritize enough food, hydration, and recovery signals, and consider follow-up if this pattern feels unusual or severe.',
  },
  {
    name: 'cycle symptom fallback', options: { recoveryLog: { cycle_symptoms: true } }, focus: 'cycle_support',
    previous: 'Cycle symptoms are useful data. Keep recovery supportive today with hydration, minerals, enough food, and lower-pressure movement if your body is asking for it.',
    restricted: 'Cycle symptoms are useful data. Keep recovery supportive today with hydration, enough food, and lower-pressure movement if your body is asking for it.',
  },
  {
    name: 'post-workout food priority', options: { workouts: [{ completed: true }] }, focus: 'nutrition_first',
    previous: 'Training is only one part of the signal. Before adding sauna or extra recovery stress, give your body food, water, and minerals so it can actually adapt.',
    restricted: 'Training is only one part of the signal. Before adding sauna or extra recovery stress, give your body food and water so it can actually adapt.',
  },
]

for (const scenario of copyCases) {
  test(`${scenario.name}: only member copy changes across the capability boundary`, async () => {
    for (const program of tiers) {
      const previous = await recommendation(previousRecovery, program, scenario.options)
      const current = await recommendation(recovery, program, scenario.options)
      assert.equal(previous.output.recommendation, scenario.previous)
      assert.equal(current.output.recommendation, getTierCapabilities(program).nutritionMicronutrients ? scenario.previous : scenario.restricted)
      assert.equal(current.output.recoveryFocus, scenario.focus)
      assert.deepEqual(withoutRecommendation(current.output), withoutRecommendation(previous.output))
      assert.deepEqual(current.calls, previous.calls)
    }
  })
}

test('recovery branch precedence, thresholds, provided cycle note and sauna decisions stay unchanged', async () => {
  const scenarios = [
    { recoveryLog: { sick: true, hydration_level: 2 }, flowBurden: { burden_band: 'high' } },
    { recoveryLog: { dizzy: true, soreness_level: 9 } },
    { recoveryLog: { unusually_fatigued: true, hydration_level: 2 } },
    { recoveryLog: { energy_level: 3, hydration_level: 2 } },
    { recoveryLog: { hydration_level: 5 } },
    { recoveryLog: { hydration_level: 0 } },
    { recoveryLog: { soreness_level: 7 }, flowBurden: { burden_band: 'high' } },
    { recoveryLog: { stress_level: 7 }, flowBurden: { burden_band: 'high' } },
    { recoveryLog: { cycle_symptoms: true }, cycleStatus: { enabled: true, recoveryCaution: true, recoveryNote: 'Use the existing cycle safety guidance.' } },
    { workouts: [{ completed: true }], mealCount: 1 },
    { nutritionLog: null },
    {},
  ]
  for (const options of scenarios) {
    for (const program of tiers) {
      const previous = await recommendation(previousRecovery, program, options)
      const current = await recommendation(recovery, program, options)
      assert.deepEqual(current.output, previous.output)
      assert.deepEqual(current.calls, previous.calls)
    }
  }
})

function insightContext(tier, priority = 'hydration') {
  return {
    tier, date: '2026-10-17', scheduleDensity: 'open', openWindowMinutes: 10,
    nextActionCategory: 'general', hasWorkoutToday: false, workoutComplete: false,
    recoveryRequired: false, lowEnergy: false, highStress: false,
    resilienceInput: {}, resilience: { priority, recommendations: ['Preserved synthetic reason.'] },
  }
}

test('hydration insight keeps its category, reason and tier-specific action while gating electrolytes copy', () => {
  for (const tier of tiers) {
    const context = insightContext(tier)
    const previous = previousInsights.selectDailyInsight(context)
    const current = insights.selectDailyInsight(context)
    assert.equal(previous.message, 'Hydration is the clearest support signal today. Stabilize water and electrolytes before asking your body for more output.')
    assert.equal(current.message, getTierCapabilities(tier).nutritionMicronutrients
      ? previous.message
      : 'Hydration is the clearest support signal today. Stabilize water before asking your body for more output.')
    assert.deepEqual({ ...current, message: previous.message }, previous)
  }
})

test('non-hydration insight selection and outputs stay unchanged', () => {
  for (const priority of ['safety', 'recovery', 'fueling', 'schedule_protection', 'normal_return', 'training', 'general']) {
    for (const tier of tiers) {
      const context = insightContext(tier, priority)
      assert.deepEqual(insights.selectDailyInsight(context), previousInsights.selectDailyInsight(context))
    }
  }
})
