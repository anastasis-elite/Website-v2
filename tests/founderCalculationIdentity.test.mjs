import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
function loader(mocks = {}) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; cache.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date, Intl, console, require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name === 'server-only') return {}
      const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      if (!base) return nativeRequire(name)
      return load(/\.(?:json|tsx?)$/.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
    } }, { filename: path })
    return module.exports
  }
  return load
}

const actual = loader()
const { generateProgram, getFounderSelectedExercise } = actual('lib/program/generateProgram.ts')
const { resolveFounderExerciseReference } = actual('lib/program/founderReference.ts')
const { roundTrainingWeight } = actual('lib/program/getEquipmentAdjustedLoad.ts')
const { getManualWorkoutLibrary } = actual('lib/workout/manualWorkout.ts')
const keys = actual('data/reference/masterKey.json')
const variants = actual('data/reference/exerciseVariants.json')
const template = actual('data/template/emberGym.json')
const repTable = actual('data/reference/hypertrophyChart_normalized.json')
const client = { program: 'ember', equipment_access: ['full gym'], timezone: 'Etc/UTC' }
const strength = { seated_row_weight: 300, seated_row_reps: 10, shoulder_press_weight: 100, shoulder_press_reps: 10,
  lateral_raise_weight: 30, lateral_raise_reps: 10, squat_weight: 100, squat_reps: 10 }
const generate = (overrides = {}, generator = generateProgram) => generator({ client, initialAssessment: {}, strengthAssessment: { ...strength, ...overrides } })
const findExercise = (plan, name) => plan.days.flatMap(day => day.exercises).find(exercise => exercise.exercise === name)
const selected = (name, variantId, resolver = getFounderSelectedExercise, extra = {}) => resolver({ client, initialAssessment: {}, strengthAssessment: strength,
  catalogExercise: getManualWorkoutLibrary().find(exercise => exercise.exercise === name), variantId, now: new Date('2026-11-05T12:00:00Z'), ...extra })
const round = value => value < 20 ? Math.round(value) : Math.round(value / 5) * 5

test('Row and Lat share only the measured input, preserving their exact existing .40 and .35 coefficients and formula', () => {
  const before = JSON.stringify(strength), plan = generate()
  const row = findExercise(plan, 'Seated Cable Row'), lat = findExercise(plan, 'Lat Pulldown')
  assert.equal(row.assessment_key, 'Row'); assert.equal(lat.assessment_key, 'Row')
  assert.equal(row.intensity_factor, 0.40); assert.equal(lat.intensity_factor, 0.35)
  for (const exercise of [row, lat]) {
    const multiplier = repTable.find(entry => entry.reps === exercise.reps).multiplier
    const expected = round(300 * (1 + 10 / 30) * exercise.intensity_factor * multiplier)
    assert.equal(exercise.calculated_weight, expected)
    assert.equal(exercise.prescription_calculation.reference_exercise, exercise.exercise)
    assert.equal(exercise.prescription_calculation.version, 'founder-load-v2')
    assert.equal(exercise.prescription_calculation.estimated_1rm, 300 * (1 + 10 / 30))
  }
  assert.notEqual(row.calculated_weight, lat.calculated_weight)
  assert.equal(JSON.stringify(strength), before)
})

test('generated and selected paths use the same exact reference and one existing equipment conversion', () => {
  for (const [name, variantId, equipment] of [
    ['Seated Cable Row', 'seated_cable_row', 'cable'],
    ['Seated Cable Row', 'single_arm_dumbbell_row', 'dumbbell'],
    ['Seated Cable Row', 'machine_row', 'machine'],
    ['Seated Cable Row', 'barbell_row', 'barbell'],
    ['Shoulder Press', 'barbell_shoulder_press', 'barbell'],
    ['Dumbbell Lateral Raise', 'cable_lateral_raise', 'cable'],
  ]) {
    const restrictedClient = { ...client, equipment_access: [equipment] }
    const generated = findExercise(generateProgram({ client: restrictedClient, initialAssessment: {}, strengthAssessment: strength }), name)
    const manual = selected(name, variantId, getFounderSelectedExercise, { client: restrictedClient }).exercise
    assert.equal(generated.selected_variant_id, variantId)
    assert.equal(generated.intensity_factor, manual.intensity_factor)
    assert.equal(generated.calculated_weight, manual.calculated_weight)
    assert.equal(generated.baseline_weight, manual.baseline_weight)
    assert.equal(generated.prescription_calculation.equipment_weight, manual.calculated_weight)
    assert.equal(manual.prescription_calculation.selected_variant_id, variantId)
    assert.equal(manual.calculated_weight, roundTrainingWeight(manual.baseline_weight * manual.available_variants[0].equipment_modifier))
  }
  // Lat has no reference-backed equipment variant in the existing data. It
  // cannot silently borrow Row's variant metadata to invent a manual dose.
  assert.equal(selected('Lat Pulldown', 'seated_cable_row'), null)
})

test('duplicate exact references, ambiguous aliases and conflicting assessment identities are unavailable', () => {
  const row = keys.find(key => key.exercise === 'Seated Cable Row')
  const group = variants.find(group => group.pattern === 'row')
  for (const mocks of [
    { '@/data/reference/masterKey.json': keys.filter(key => key.exercise !== 'Seated Cable Row') },
    { '@/data/reference/masterKey.json': [...keys, { ...row, ember_if: .99 }] },
    { '@/data/reference/exerciseVariants.json': [...variants, { ...group, pattern: 'second_row' }] },
    { '@/data/reference/exerciseVariants.json': variants.map(entry => entry.pattern === 'row' ? { ...entry, assessment_key: 'Bench' } : entry) },
    { '@/data/reference/exerciseVariants.json': variants.map(entry => entry.pattern === 'row' ? { ...entry, variants: [...entry.variants, entry.variants[0]] } : entry) },
  ]) {
    const load = loader(mocks), functions = load('lib/program/generateProgram.ts')
    assert.equal(selected('Seated Cable Row', 'seated_cable_row', functions.getFounderSelectedExercise), null)
    const unavailable = findExercise(generate({}, functions.generateProgram), 'Seated Cable Row')
    assert.ok(['not_calculated', 'unverified'].includes(unavailable.load_guidance_status))
    assert.equal(unavailable.prescription_status, undefined)
    assert.equal(unavailable.recommended_weight, null)
  }
  const ambiguous = resolveFounderExerciseReference('Dumbbell Press')
  assert.equal(ambiguous.status, 'unavailable')
  assert.equal(resolveFounderExerciseReference('Row-ish').status, 'unavailable')
  assert.equal(resolveFounderExerciseReference(' seated CABLE row ').reference.ember_if, .40)
})

test('zero, missing and invalid measured inputs never become an external-load prescription in either path', () => {
  for (const invalid of [undefined, '', null, 0, '0', -1, NaN, Infinity, true, [], {}, 3001]) {
    const inputs = { ...strength, seated_row_weight: invalid }
    const generated = findExercise(generateProgram({ client, strengthAssessment: inputs }), 'Seated Cable Row')
    assert.equal(generated.load_guidance_status, 'unverified', `Generated input ${String(invalid)}`)
    assert.equal(generated.prescription_status, undefined)
    assert.equal(generated.calculated_weight, null)
    assert.equal(selected('Seated Cable Row', 'seated_cable_row', getFounderSelectedExercise, { strengthAssessment: inputs }), null)
  }
  for (const invalid of [undefined, '', 0, -1, 1.5, 101, NaN, Infinity, true, []]) {
    const inputs = { ...strength, seated_row_reps: invalid }
    assert.equal(findExercise(generateProgram({ client, strengthAssessment: inputs }), 'Seated Cable Row').load_guidance_status, 'unverified')
    assert.equal(selected('Seated Cable Row', 'seated_cable_row', getFounderSelectedExercise, { strengthAssessment: inputs }), null)
  }
  const bodyweight = findExercise(generate({ squat_weight: 0 }), 'Sumo Squat')
  assert.equal(bodyweight.calculated_weight, 0)
  assert.equal(bodyweight.prescription_status, undefined)
  assert.equal(findExercise(generate({ seated_row_weight: 0.001 }), 'Seated Cable Row').load_guidance_status, 'unverified')
})

test('missing or duplicate coefficient/rep metadata is unavailable without replacing the established tables', () => {
  for (const mocks of [
    { '@/data/reference/masterKey.json': keys.map(key => key.exercise === 'Seated Cable Row' ? { ...key, ember_if: undefined } : key) },
    { '@/data/reference/hypertrophyChart_normalized.json': [] },
    { '@/data/reference/hypertrophyChart_normalized.json': [...repTable, ...repTable] },
  ]) {
    const functions = loader(mocks)('lib/program/generateProgram.ts')
    assert.equal(findExercise(generate({}, functions.generateProgram), 'Seated Cable Row').load_guidance_status, 'unverified')
    assert.equal(selected('Seated Cable Row', 'seated_cable_row', functions.getFounderSelectedExercise), null)
  }
  assert.equal(JSON.stringify(actual('data/reference/masterKey.json')), JSON.stringify(keys))
  assert.equal(JSON.stringify(actual('data/reference/hypertrophyChart_normalized.json')), JSON.stringify(repTable))
  assert.equal(JSON.stringify(actual('data/template/emberGym.json')), JSON.stringify(template))
})
