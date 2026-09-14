import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')

function loadTs(relativePath) {
  const filename = resolve(root, relativePath)
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  const context = {
    module,
    exports: module.exports,
    require: () => ({}),
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
  }
  vm.runInNewContext(output, context, { filename })
  return module.exports
}

const menstrual = loadTs('lib/cycle/menstrualFlow.ts')
const patterns = loadTs('lib/physiology/patternEngine.ts')
const recommendationEffects = loadTs('lib/physiology/recommendationEffects.ts')
const suggestedFoods = loadTs('lib/nutrition/suggestedFoods.ts')
const analytics = loadTs('lib/analytics/sensitiveHealthData.ts')

test('one symptom alone does not create a hormone-associated pattern', () => {
  const [flag] = patterns.evaluatePhysiologyPatterns({
    evidence: [{
      pattern: 'estrogen_associated',
      domain: 'symptoms',
      direction: 'supporting',
      strength: 'high',
      observation: 'Breast tenderness reported once.',
      observedAt: '2026-09-01T12:00:00.000Z',
    }],
  })

  assert.equal(flag.confidence, 0)
  assert.match(flag.suppressedReason, /single independent domain/i)
})

test('regional fat distribution alone does not create a hormone-associated pattern', () => {
  const [flag] = patterns.evaluatePhysiologyPatterns({
    evidence: [{
      pattern: 'insulin_metabolic_associated',
      domain: 'regional_body_composition',
      direction: 'supporting',
      strength: 'high',
      observation: 'Trunk distribution increased in one assessment.',
      observedAt: '2026-09-01T12:00:00.000Z',
    }],
  })

  assert.equal(flag.confidence, 0)
})

test('posture alone never creates a hormone-associated pattern', () => {
  const [flag] = patterns.evaluatePhysiologyPatterns({
    evidence: [{
      pattern: 'estrogen_associated',
      domain: 'posture_musculoskeletal',
      direction: 'supporting',
      strength: 'high',
      observation: 'Anterior pelvic tilt may distort waist geometry.',
      observedAt: '2026-09-01T12:00:00.000Z',
    }],
  })

  assert.equal(flag.confidence, 0)
  assert.match(flag.suppressedReason, /Posture alone/i)
})

test('one heavy period alone does not create a persistent endocrine-associated flag', () => {
  const burden = menstrual.calculateDailyMenstrualFlowBurden({
    products: [{
      productType: 'pad',
      absorbency: 'overnight',
      quantity: 4,
      saturation: '100',
      leakOrOverflow: true,
    }],
  })

  const [flag] = patterns.evaluatePhysiologyPatterns({
    evidence: [{
      pattern: 'progesterone_associated',
      domain: 'menstrual_reproductive',
      direction: 'supporting',
      strength: 'high',
      observation: `One day had ${burden.burdenBand} flow burden.`,
      observedAt: '2026-09-01T12:00:00.000Z',
    }],
  })

  assert.equal(flag.confidence, 0)
})

test('multiple concordant domains can increase confidence', () => {
  const [flag] = patterns.evaluatePhysiologyPatterns({
    evidence: [
      {
        pattern: 'stress_recovery_associated',
        domain: 'menstrual_reproductive',
        direction: 'supporting',
        strength: 'moderate',
        observation: 'High burden repeats on Cycle Days 1-2.',
        observedAt: '2026-07-01T12:00:00.000Z',
      },
      {
        pattern: 'stress_recovery_associated',
        domain: 'recovery',
        direction: 'supporting',
        strength: 'moderate',
        observation: 'Energy repeatedly falls during the same window.',
        observedAt: '2026-08-01T12:00:00.000Z',
      },
      {
        pattern: 'stress_recovery_associated',
        domain: 'nutrition',
        direction: 'supporting',
        strength: 'low',
        observation: 'Under-fueling often appears near the same window.',
        observedAt: '2026-09-01T12:00:00.000Z',
      },
    ],
  })

  assert.ok(flag.confidence > 0.35)
  assert.equal(flag.suppressedReason, null)
})

test('conflicting domains decrease confidence', () => {
  const concordant = patterns.evaluatePhysiologyPatterns({
    evidence: [
      {
        pattern: 'stress_recovery_associated',
        domain: 'menstrual_reproductive',
        direction: 'supporting',
        strength: 'moderate',
        observation: 'High burden repeats.',
        observedAt: '2026-07-01T12:00:00.000Z',
      },
      {
        pattern: 'stress_recovery_associated',
        domain: 'recovery',
        direction: 'supporting',
        strength: 'moderate',
        observation: 'Energy repeatedly falls.',
        observedAt: '2026-08-01T12:00:00.000Z',
      },
    ],
  })[0]

  const discordant = patterns.evaluatePhysiologyPatterns({
    evidence: [
      ...concordant.supportingEvidence,
      {
        pattern: 'stress_recovery_associated',
        domain: 'longitudinal_response',
        direction: 'conflicting',
        strength: 'high',
        observation: 'Readiness remains stable during the same window.',
        observedAt: '2026-09-01T12:00:00.000Z',
      },
    ],
  })[0]

  assert.ok(discordant.confidence < concordant.confidence)
  assert.equal(discordant.conflictingEvidence.length, 1)
})

test('high flow plus low energy can influence food priority without diagnosing anemia', () => {
  const effects = recommendationEffects.buildPhysiologyRecommendationEffects({
    flowBurden: {
      burdenScore: 10,
      burdenBand: 'high',
      factors: ['pad_heavy'],
      algorithmVersion: menstrual.MENSTRUAL_FLOW_BURDEN_VERSION,
    },
    flowEnergyPattern: true,
    activePatterns: [],
  })

  const foods = suggestedFoods.buildSuggestedFoods({
    remaining: {
      calories_remaining: 500,
      protein_remaining_g: 25,
      iron_remaining_mg: 8,
      vitamin_c_remaining_mg: 40,
      potassium_remaining_mg: 500,
      magnesium_remaining_mg: 80,
      sodium_remaining_mg: 800,
    },
    loggedFoodIds: [],
    avoidTerms: [],
    recommendationEffects: effects.effects,
    candidates: [
      { id: 'rice', name: 'White Rice', calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0 },
      { id: 'beef-orange', name: 'Beef and Orange Bowl', calories: 360, protein_g: 30, carbs_g: 35, fat_g: 10, iron_mg: 4, vitamin_c_mg: 55, potassium_mg: 500 },
    ],
  })

  assert.equal(foods[0].foodId, 'beef-orange')
  assert.doesNotMatch(`${foods[0].reason} ${foods[0].contribution}`, /anemia|deficien|ferritin|hemoglobin/i)
})

test('sensitive reproductive data is excluded from analytics payloads', () => {
  const clean = analytics.sanitizeAnalyticsProperties({
    button: 'save',
    menstrualFlow: 'heavy',
    symptomSeverity: 'severe',
    labFerritin: 12,
  })

  assert.deepEqual(clean, { button: 'save' })
  assert.equal(analytics.analyticsPayloadHasSensitiveHealthData({ cycleDay: 2 }), true)
})

test('migration preserves raw logs, algorithm versions, and existing cycle data', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20260914_menstrual_burden_physiology_patterns.sql'), 'utf8')

  assert.match(sql, /create table if not exists public\.menstrual_product_logs/i)
  assert.match(sql, /raw_entry jsonb not null default/i)
  assert.match(sql, /create table if not exists public\.cycle_burden_scores/i)
  assert.match(sql, /algorithm_version text not null/i)
  assert.match(sql, /unique \(user_id, client_id, log_date\)/i)
  assert.match(sql, /clients update own cycle burden scores/i)
  assert.match(sql, /alter table public\.cycle_logs\s+add column if not exists/i)
  assert.doesNotMatch(sql, /drop table public\.cycle_logs/i)
  assert.doesNotMatch(sql, /delete from public\.cycle_logs/i)
})

test('lab evidence remains separate and is not converted into a diagnosis', () => {
  const [flag] = patterns.evaluatePhysiologyPatterns({
    evidence: [
      {
        pattern: 'estrogen_associated',
        domain: 'clinician_lab',
        direction: 'supporting',
        strength: 'high',
        observation: 'Clinician-entered serum estradiol is available for professional interpretation.',
        observedAt: '2026-09-01T12:00:00.000Z',
      },
      {
        pattern: 'estrogen_associated',
        domain: 'menstrual_reproductive',
        direction: 'supporting',
        strength: 'moderate',
        observation: 'Recurring cycle-associated symptom timing.',
        observedAt: '2026-09-02T12:00:00.000Z',
      },
    ],
  })

  const clinicianRecord = patterns.buildClinicianPatternObservation(flag)
  assert.equal(flag.classification, 'algorithmic_wellness_observation_non_diagnostic')
  assert.match(clinicianRecord.nonDiagnosticBoundary, /No hormone concentration was determined/i)
  assert.doesNotMatch(JSON.stringify(clinicianRecord), /estrogenHigh|estrogen high|estrogen_domin/i)
})
