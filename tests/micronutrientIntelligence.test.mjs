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
    RegExp,
  }
  vm.runInNewContext(output, context, { filename })
  return module.exports
}

const nutrient = loadTs('lib/nutrition/nutrientIntelligence.ts')

const ironFatigueRelationship = {
  nutrientKey: 'iron',
  symptomKey: 'fatigue',
  relationshipType: 'deficiency_association',
  evidenceStrength: 'authoritative',
  sourceKey: 'nih_ods_iron_hp',
}

const zincNauseaRelationship = {
  nutrientKey: 'zinc',
  symptomKey: 'nausea',
  relationshipType: 'toxicity_association',
  evidenceStrength: 'authoritative',
  sourceKey: 'nih_ods_zinc_hp',
}

test('one symptom does not trigger a deficiency diagnosis', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'iron',
    nutrientName: 'Iron',
    symptomKeys: ['fatigue'],
    symptomDays: 4,
    symptomRelationships: [ironFatigueRelationship],
  })

  assert.equal(insight.action, 'monitor_pattern')
  assert.equal(insight.patternState, 'symptom_pattern_possibly_associated_with_inadequacy')
  assert.doesNotMatch(insight.message, /you are deficient|you have|anemic|caused by/i)
})

test('multiple signals can create a pattern insight without diagnosis', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'iron',
    nutrientName: 'Iron',
    totalAmount: 4,
    targetAmount: 18,
    symptomKeys: ['fatigue'],
    symptomDays: 2,
    energyValues: [4, 4, 5],
    menstrualBurdenBand: 'high',
    symptomRelationships: [ironFatigueRelationship],
  })

  assert.equal(insight.action, 'food_first_recommendation')
  assert.equal(insight.confidenceCategory, 'moderate_pattern')
  assert.equal(insight.foodFirst, true)
  assert.doesNotMatch(insight.message, /deficiency|anemia/i)
})

test('persistent menstrual context can escalate without diagnosing', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'iron',
    nutrientName: 'Iron',
    totalAmount: 4,
    targetAmount: 18,
    symptomKeys: ['fatigue'],
    symptomDays: 5,
    readinessValues: [4, 4, 5],
    menstrualBurdenBand: 'very_high',
    symptomRelationships: [ironFatigueRelationship],
  })

  assert.equal(insight.action, 'discuss_labs_with_clinician')
  assert.equal(insight.clinicianEscalation, true)
  assert.match(insight.message, /does not establish a deficiency/i)
})

test('confirmed deficiency remains distinct from inferred pattern', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'b12',
    nutrientName: 'Vitamin B12',
    confirmedClinicalState: 'confirmed_deficiency',
  })

  assert.equal(insight.confidenceCategory, 'confirmed_clinical_data')
  assert.equal(insight.patternState, 'confirmed_deficiency')
  assert.equal(insight.safetyEscalationReason, 'confirmed_clinical_deficiency_record')
})

test('excess intake is evaluated separately from inadequacy', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'zinc',
    nutrientName: 'Zinc',
    supplementAmount: 55,
    totalAmount: 65,
    symptomKeys: ['nausea'],
    symptomDays: 3,
    symptomRelationships: [zincNauseaRelationship],
    referenceValues: [{
      nutrientKey: 'zinc',
      referenceType: 'ul',
      amount: 40,
      unit: 'mg',
      appliesToIntakeSource: 'total',
      sourceKey: 'nih_ods_zinc_hp',
    }],
  })

  assert.equal(insight.patternState, 'intake_above_established_ul')
  assert.equal(insight.action, 'safety_warning_clinician_recommendation')
})

test('UL rules respect source-specific exposure fields', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'magnesium',
    nutrientName: 'Magnesium',
    foodAmount: 320,
    supplementAmount: 150,
    totalAmount: 470,
    referenceValues: [{
      nutrientKey: 'magnesium',
      referenceType: 'ul',
      amount: 350,
      unit: 'mg',
      appliesToIntakeSource: 'supplemental',
      sex: 'any',
      sourceKey: 'nam_dri_summary_tables',
    }],
  })

  assert.notEqual(insight.patternState, 'intake_above_established_ul')
})

test('nutrient interactions are included as explainable context', () => {
  const interaction = {
    nutrientKey: 'vitamin_c',
    relatedNutrientKey: 'iron',
    interactionType: 'enhances_absorption',
    evidenceStrength: 'authoritative',
    sourceKey: 'nih_ods_iron_hp',
  }
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'vitamin_c',
    nutrientName: 'Vitamin C',
    totalAmount: 20,
    targetAmount: 75,
    energyValues: [4, 5],
    interactions: [interaction],
  })

  assert.equal(insight.interactionsConsidered.length, 1)
  assert.equal(insight.interactionsConsidered[0].relatedNutrientKey, 'iron')
})

test('food and supplements are combined for exposure estimates', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'zinc',
    nutrientName: 'Zinc',
    foodAmount: 12,
    supplementAmount: 32,
    totalAmount: 44,
    referenceValues: [{
      nutrientKey: 'zinc',
      referenceType: 'ul',
      amount: 40,
      unit: 'mg',
      appliesToIntakeSource: 'total',
      sourceKey: 'nih_ods_zinc_hp',
    }],
  })

  assert.equal(insight.patternState, 'intake_above_established_ul')
  assert.ok(insight.why.some((reason) => /supplement intake was included/i.test(reason)))
})

test('missing data does not create false conclusions', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'iodine',
    nutrientName: 'Iodine',
  })

  assert.equal(insight.action, 'no_action')
  assert.equal(insight.patternState, 'none')
})

test('recommendation explanation reflects inputs', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'iron',
    nutrientName: 'Iron',
    totalAmount: 4,
    targetAmount: 18,
    symptomKeys: ['fatigue'],
    symptomDays: 4,
    energyValues: [4, 4],
    menstrualBurdenBand: 'high',
    symptomRelationships: [ironFatigueRelationship],
  })

  assert.ok(insight.why.some((reason) => /intake appears lower/i.test(reason)))
  assert.ok(insight.why.some((reason) => /energy/i.test(reason)))
  assert.ok(insight.why.some((reason) => /menstrual/i.test(reason)))
})

test('historical baseline changes are recognized', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'iron',
    nutrientName: 'Iron',
    totalAmount: 5,
    targetAmount: 18,
    symptomDays: 1,
    menstrualBurdenChangedFromBaseline: true,
  })

  assert.ok(insight.why.some((reason) => /changed from baseline/i.test(reason)))
})

test('no unsafe supplement-dose recommendation is generated', () => {
  const insight = nutrient.evaluateNutrientInsight({
    nutrientKey: 'iron',
    nutrientName: 'Iron',
    totalAmount: 4,
    targetAmount: 18,
    symptomKeys: ['fatigue'],
    symptomDays: 4,
    menstrualBurdenBand: 'high',
    symptomRelationships: [ironFatigueRelationship],
  })

  assert.equal(nutrient.containsUnsafeSupplementDoseRecommendation(insight), false)
  assert.doesNotMatch(insight.message, /take \d+\s*(mg|mcg|iu)/i)
})

test('protected algorithm logic is not exposed client-side', () => {
  const component = readFileSync(resolve(root, 'components/AdaptiveNutritionDashboard.tsx'), 'utf8')
  const api = readFileSync(resolve(root, 'app/api/nutrition/nutrient-insights/route.ts'), 'utf8')

  assert.match(component, /\/api\/nutrition\/nutrient-insights/)
  assert.doesNotMatch(component, /evaluateNutrientInsight|NUTRIENT_INTELLIGENCE_VERSION|weight|threshold/i)
  assert.match(api, /getNutrientInsights/)
})

test('migration adds RLS and reference/user separation', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20260925_micronutrient_intelligence_layer.sql'), 'utf8')

  assert.match(sql, /create table if not exists public\.nutrients/i)
  assert.match(sql, /create table if not exists public\.client_nutrient_recommendations/i)
  assert.match(sql, /alter table public\.client_nutrient_recommendations enable row level security/i)
  assert.match(sql, /clients read own nutrient recommendations/i)
  assert.match(sql, /authenticated read nutrient reference/i)
  assert.doesNotMatch(sql, /service_role/i)
})

test('RLS prevents cross-user access with auth.uid ownership predicates', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20260925_micronutrient_intelligence_layer.sql'), 'utf8')

  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/i)
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id\)/i)
  const clientPolicyBlocks = sql
    .split(/create policy/i)
    .filter((block) => /on public\.client_/i.test(block))
  assert.ok(clientPolicyBlocks.length > 0)
  assert.equal(clientPolicyBlocks.some((block) => /using \(true\)/i.test(block)), false)
})
