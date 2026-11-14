import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { exerciseLoadPresentation, actualWeightForInput, weightDraftForInput } = await importTs('lib/workout/exerciseLoadPresentation.ts')
const raw = () => ({ id: 'row', exercise: 'Seated Cable Row', sets: 4, reps: 8, recommended_weight: 40, calculated_weight: 40,
  selected_variant_id: 'seated_cable_row', selected_equipment: 'cable', load_type: 'total_load' })
const verified = () => ({ ...raw(), assessment_key: 'Row', rep_multiplier: .725, baseline_weight: 40,
  prescription_calculation: { version: 'founder-load-v3', reference_exercise: 'Seated Cable Row',
  assessment_key: 'Row', bodyweight_factor: 0, body_mass_lb: 180, estimated_1rm: 40 / .725, rep_multiplier: .725,
  base_weight: 40, equipment_weight: 40, selected_variant_id: 'seated_cable_row', equipment_modifier: 1 } })

test('legacy external source weights remain retained while current recommendation and new actual input stay unavailable', () => {
  const exercise = raw(), before = structuredClone(exercise)
  assert.equal(exerciseLoadPresentation(exercise).status, 'unverified')
  assert.equal(exerciseLoadPresentation(exercise).recommendationAvailable, false)
  assert.equal(Number.isNaN(actualWeightForInput(exercise, 'lb')), true)
  assert.deepEqual(exercise, before)
})

test('proven founder loads remain available and projected unverified metadata never rewrites the source', () => {
  const exercise = verified(), projectedExercise = { ...exercise, load_guidance_status: 'unverified', load_guidance_reason: 'Review saved load.' }
  assert.equal(exerciseLoadPresentation(exercise).recommendationAvailable, true)
  assert.equal(actualWeightForInput(exercise, 'lb'), 40)
  assert.equal(exerciseLoadPresentation(exercise, { projectedExercise }).recommendationAvailable, false)
  assert.equal(Number.isNaN(actualWeightForInput(exercise, 'lb', { projectedExercise })), true)
  assert.equal(exercise.load_guidance_status, undefined)
  const invalid = verified(); invalid.prescription_calculation.equipment_weight = 45
  assert.equal(exerciseLoadPresentation(invalid).status, 'unverified')
})

test('missing null and zero external loads never become a fabricated recommendation, while bodyweight zero stays legitimate', () => {
  for (const weight of [null, undefined, 0, NaN]) {
    const exercise = { ...raw(), calculated_weight: weight, recommended_weight: weight }
    assert.equal(exerciseLoadPresentation(exercise).recommendationAvailable, false)
    assert.equal(Number.isNaN(actualWeightForInput(exercise, 'lb')), true)
  }
  const bodyweight = { ...raw(), load_type: 'bodyweight', selected_variant_id: undefined, recommended_weight: 0, calculated_weight: 0,
    load_guidance_status: 'not_calculated' }
  assert.equal(exerciseLoadPresentation(bodyweight).status, 'bodyweight')
  assert.equal(actualWeightForInput(bodyweight, 'lb'), 0)
})

test('logged actuals and edited draft inputs retain their units and explicit zero without trusting old load guidance', () => {
  const exercise = { ...raw(), set_logs: [{ weight: 22, weight_unit: 'kg', reps: 7 }] }
  assert.equal(actualWeightForInput(exercise, 'kg'), 22)
  assert.equal(actualWeightForInput(exercise, 'lb'), 48.5)
  assert.equal(actualWeightForInput(exercise, 'kg', {}, 23.5, true), 23.5)
  assert.equal(actualWeightForInput(exercise, 'kg', {}, 0, true), 0)
  assert.equal(Number.isNaN(actualWeightForInput(raw(), 'lb', {}, 40, false)), true)
})

test('manual minimal guided snapshots retain their existing separate recommendation contract', () => {
  const exercise = { ...raw(), prescription: { version: 'founder-selected-v1', weightLb: 40, sets: 4, reps: 8 } }
  assert.equal(exerciseLoadPresentation(exercise, { source: 'manual' }).recommendationAvailable, true)
  assert.equal(actualWeightForInput(exercise, 'lb', { source: 'manual' }), 40)
  assert.equal(exerciseLoadPresentation({ ...exercise, load_guidance_status: 'not_calculated' }, { source: 'manual' }).recommendationAvailable, false)
})

test('uncertain old draft weights are retained separately while only per-exercise entered weights populate an unknown load', () => {
  const exercise = raw()
  for (const weight of [0, 17.5]) {
    const retained = { weight, amount: 8 }, before = structuredClone(retained)
    const presented = weightDraftForInput(exercise, 'lb', {}, retained)
    assert.equal(Number.isNaN(presented.weight), true)
    assert.equal(presented.retainedWeight, weight)
    assert.equal(presented.weightEdited, false)
    assert.deepEqual(retained, before)
    assert.equal(weightDraftForInput(exercise, 'lb', {}, { ...retained, weightEdited: true }).weight, weight)
  }
})
