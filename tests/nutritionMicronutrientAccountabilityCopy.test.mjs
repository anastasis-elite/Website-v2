import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { getTierCapabilities } = await importTs('lib/entitlements.ts')
const current = await importTs('lib/accountability/accountabilityEngine.ts')
globalThis.micronutrientAccountabilityCapabilities = getTierCapabilities
// Enabling only this capability recovers the previous hydration wording while
// exercising the same decisions, profile calculation, and persona handling.
const previous = await importTs('lib/accountability/accountabilityEngine.ts', {
  '@/lib/entitlements': 'export const getTierCapabilities = program => ({ ...globalThis.micronutrientAccountabilityCapabilities(program), nutritionMicronutrients: true })',
})

const previousCopy = 'Stabilize the simple support first: water, electrolytes if you use them, then the next block.'
const restrictedCopy = 'Stabilize the simple support first: water, then the next block.'
const entitledTiers = ['ignite', 'phoenix', 'IGNITE', ' Phoenix ']
const excludedTiers = ['ember', 'EMBER', ' Ember ', 'unknown', '', null, undefined]
const allTiers = [...excludedTiers, ...entitledTiers]
const persona = {
  id: 'synthetic-accountability-persona', name: 'Synthetic persona',
  voiceCharacteristics: ['clear'], conversationalTraits: ['concise'],
  defaultTone: 'steady', relationshipStyle: 'supportive accountability',
  createdAt: '2026-10-18T12:00:00.000Z', updatedAt: '2026-10-18T12:00:00.000Z',
}

function context(program, overrides = {}) {
  return {
    program, userId: 'synthetic-owner', clientId: 'synthetic-client',
    resilienceState: {
      overallState: 'stable', priority: 'hydration', physicalState: {},
      recommendations: ['Use the existing synthetic hydration signal.'],
    },
    dailyInsight: { id: 'synthetic-insight', date: '2026-10-18', category: 'nutrition', message: 'Synthetic objective insight.' },
    availableTime: 15, scheduleLoad: 'steady', persona,
    userPreferences: { supportPreference: 'facts_and_direction', directness: 0.6 },
    recentBehavior: { sampleSize: 5, concisePromptCompletionRate: 0.8 },
    ...overrides,
  }
}

function withoutMessage({ message, ...response }) { return response }

test('IGNITE and PHOENIX retain exact accountability hydration wording, including normalized stored tier spelling', () => {
  for (const program of entitledTiers) {
    const input = context(program)
    const before = previous.runAccountabilityPartnerEngine(input)
    const result = current.runAccountabilityPartnerEngine(input)
    assert.equal(before.message, previousCopy)
    assert.equal(result.message, previousCopy)
    assert.deepEqual(result, before)
  }
})

test('EMBER, missing and unknown tiers omit electrolyte guidance without changing other response fields', () => {
  for (const program of excludedTiers) {
    const input = context(program)
    const before = previous.runAccountabilityPartnerEngine(input)
    const result = current.runAccountabilityPartnerEngine(input)
    assert.equal(before.message, previousCopy)
    assert.equal(result.message, restrictedCopy)
    assert.doesNotMatch(result.message, /electrolyte|mineral|micronutrient/i)
    assert.deepEqual(withoutMessage(result), withoutMessage(before))
    assert.deepEqual(result.partner, persona)
  }
  const missing = context('phoenix')
  delete missing.program
  assert.equal(current.runAccountabilityPartnerEngine(missing).message, restrictedCopy)
  assert.deepEqual(
    withoutMessage(current.runAccountabilityPartnerEngine(missing)),
    withoutMessage(previous.runAccountabilityPartnerEngine(missing)),
  )
})

test('non-hydration branches and earlier capacity branches preserve the complete accountability response', () => {
  const scenarios = [
    ...['safety', 'recovery', 'fueling', 'schedule_protection', 'normal_return', 'training', 'conservative', 'excessive_load']
      .map(priority => ({ resilienceState: { overallState: 'stable', priority, physicalState: {}, recommendations: [] } })),
    {
      resilienceState: { overallState: 'stable', priority: 'optimization', physicalState: {}, recommendations: [] },
      dailyInsight: { id: 'synthetic-done', date: '2026-10-18', category: 'progress', message: 'Synthetic completed day.' },
    },
    ...['diligence', 'patience', 'kindness', 'generosity', 'selfControl', 'humility', 'temperance'].map(capacity => ({
      resilienceState: {
        overallState: 'stable', priority: capacity === 'diligence' ? 'training' : 'conservative',
        primaryCapacity: { capacity, state: 'balanced', confidence: 0.8, reasons: ['Synthetic capacity signal.'] },
        physicalState: {}, recommendations: [],
      },
      availableTime: capacity === 'diligence' ? 45 : 15,
    })),
    // These capacity branches intentionally precede hydration in the engine.
    ...['patience', 'kindness', 'generosity', 'selfControl', 'humility', 'temperance'].map(capacity => ({
      resilienceState: {
        overallState: 'stable', priority: 'hydration',
        primaryCapacity: { capacity, state: 'balanced', confidence: 0.8, reasons: ['Synthetic capacity signal.'] },
        physicalState: {}, recommendations: [],
      },
    })),
  ]
  for (const overrides of scenarios) {
    for (const program of allTiers) {
      const input = context(program, overrides)
      assert.deepEqual(current.runAccountabilityPartnerEngine(input), previous.runAccountabilityPartnerEngine(input))
    }
  }
})

globalThis.micronutrientAccountabilityEngine = current.runAccountabilityPartnerEngine
const dailyInsight = await importTs('lib/dashboard/dailyInsight.ts', {
  './resilienceEngine': 'export const evaluateResilience = () => ({ overallState: "stable", priority: "hydration", physicalState: {}, recommendations: ["Synthetic hydration priority."] })',
  '@/lib/accountability/accountabilityEngine': 'export const runAccountabilityPartnerEngine = context => { globalThis.micronutrientAccountabilityCalls.push(context); return globalThis.micronutrientAccountabilityEngine(context) }',
  '@/lib/accountability/astrologyProfile': 'export const buildNatalProfile = undefined',
})

test('daily insight passes its trusted tier into accountability rather than inferring another program', () => {
  for (const program of allTiers) {
    globalThis.micronutrientAccountabilityCalls = []
    const result = dailyInsight.buildDailyInsight({
      tier: program,
      logic: { client: { id: 'synthetic-client', program: 'phoenix', accountability: { persona } } },
      schedule: {
        date: '2026-10-18', events: [], openWindows: [{ minutes: 15 }],
        nextAction: { category: 'general' },
      },
    })
    assert.equal(globalThis.micronutrientAccountabilityCalls.length, 1)
    const [passed] = globalThis.micronutrientAccountabilityCalls
    assert.equal(passed.program, program)
    assert.equal(passed.clientId, 'synthetic-client')
    assert.equal(passed.resilienceState.priority, 'hydration')
    assert.deepEqual(passed.persona, persona)
    assert.equal(result.accountability.message, entitledTiers.includes(program) ? previousCopy : restrictedCopy)
    assert.equal(passed.dailyInsight.message, result.message)
  }
})
