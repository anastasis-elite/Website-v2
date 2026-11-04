import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const clone = value => JSON.parse(JSON.stringify(value))
const templateFiles = ['emberGym', 'igniteGym', 'phoenixBodybuilding', 'phoenixEndurance', 'phoenixFullTransformation',
  'phoenixGluteSculpt', 'phoenixHypertrophy', 'phoenixRecomposition', 'phoenixStrength', 'phoenixWaistCincher']
const templates = templateFiles.map(file => JSON.parse(readFileSync(`data/template/${file}.json`, 'utf8')))
const variants = JSON.parse(readFileSync('data/reference/exerciseVariants.json', 'utf8'))
function createLoader(jsonOverrides = {}) {
 const cache = new Map()
 function load(path) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path).exports
  if (path.endsWith('.json')) {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return jsonOverrides[path] ? jsonOverrides[path](parsed) : parsed
  }
  const module = { exports: {} };cache.set(path, module)
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Date, Map, Set, Object, Array, Number,
    require(name) {
      if (name === 'server-only') return {}
      const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      if (!base) return require(name)
      return load(base.endsWith('.json') || base.endsWith('.ts') ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
    },
  }, { filename: path })
  return module.exports
 }
 return load
}
const load = createLoader()
const { getExactWeekdayExerciseMapping: mapping, resolveVersionedWeekdayExerciseMappings: inspect } = load('lib/program/weekdayExerciseMapping.ts')
const sourcePlan = template => ({ program: template.program, template_program: template.program,
  template_version: template.version, days: clone(template.days) })
const unsupported = (plan, code, outputProgram) => {
  const before = clone(plan), result = inspect({ programJson: plan, outputProgram })
  assert.equal(result.status, 'unsupported')
  assert.equal(result.issues[0].code, code)
  assert.deepEqual(plan, before)
}

test('exact reviewed identities distinguish chest plus biceps from hamstring work without substring inference', () => {
  assert.deepEqual(clone(mapping('Bench Press').primaryMuscles), ['chest'])
  assert.deepEqual(clone(mapping('Cable Bicep Curl').primaryMuscles), ['biceps'])
  assert.deepEqual(clone(mapping('Seated Ham Curl').primaryMuscles), ['hamstrings'])
  assert.equal(mapping('Dumbbell Press').category, 'ambiguous')
  assert.deepEqual(clone(mapping('Smith Machine Press').primaryMuscles), ['shoulders'])
  assert.deepEqual(clone(mapping('Cable Crunch').primaryMuscles), ['core'])
  assert.equal(mapping('Custom Ham Curl').category, 'unknown')
  assert.equal(mapping('cable bicep curl').category, 'unknown')
  assert.equal(mapping('Cable Bicep Curl changed').category, 'unknown')
})

test('all ten exact current templates are recognized read-only with complete occurrence coverage and explicit missing Sunday', () => {
  const names = new Set(), counts = { movable: 0, ambiguous: 0, non_strength: 0, unknown: 0 }
  let total = 0
  for (const template of templates) {
    const plan = sourcePlan(template), before = clone(plan)
    const result = inspect({ programJson: plan, outputProgram: template.program })
    assert.equal(result.status, 'compatible', template.program)
    assert.equal(result.provenance.templateProgram, template.program)
    assert.equal(result.provenance.templateVersion, 'v1')
    assert.match(result.provenance.sourceTemplateContentSha256, /^[a-f0-9]{64}$/)
    assert.equal(result.provenance.mappingVersion, 'exact-template-placement-v1')
    assert.deepEqual(clone(result.missingWeekdays), template.program === 'phoenixFullTransformation' ? [] : ['Sunday'])
    for (const occurrence of result.occurrences) {
      const original = plan.days.find(day => day.day_name === occurrence.day).exercises[occurrence.index]
      assert.equal(occurrence.exercise, original)
      names.add(original.exercise)
      counts[occurrence.mapping.kind === 'movable' ? 'movable' : occurrence.mapping.category] += 1
      total += 1
    }
    assert.deepEqual(plan, before)
  }
  assert.equal(total, 483)
  assert.equal(names.size, 168)
  assert.equal(counts.unknown, 0, 'every current exact source identity is reviewed or explicitly pinned')
  assert.ok(counts.movable > 0)
  assert.ok(counts.ambiguous > 0)
  assert.ok(counts.non_strength > 0)
})

test('ambiguous blocks, compounds and non-strength activities retain original occurrence and dose with explicit owner decisions', () => {
  for (const name of ['Arm Circuit', 'Core Finisher', 'Barbell RDL', 'Walking Lunge', 'Banded Hip Abduction Finisher', 'Hamstring Lengthening']) {
    assert.equal(mapping(name).kind, 'pinned')
    assert.equal(mapping(name).category, 'ambiguous')
    assert.match(mapping(name).ownerDecision, /program owner/i)
  }
  assert.equal(mapping('Walking/Running').category, 'non_strength')
  assert.equal(mapping('Stair Stepper').category, 'non_strength')
  const plan = sourcePlan(templates.find(template => template.program === 'phoenixFullTransformation'))
  const before = clone(plan), result = inspect({ programJson: plan })
  assert.equal(result.status, 'compatible')
  const breathwork = result.occurrences.find(occurrence => occurrence.exercise.exercise === 'Breathwork')
  assert.equal(breathwork.day, 'Monday')
  assert.equal(breathwork.index, 0)
  assert.equal(breathwork.exercise.reps, '10min')
  assert.equal(breathwork.exercise.sets, '')
  assert.equal(breathwork.mapping.category, 'non_strength')
  assert.deepEqual(plan, before)
})

test('versionless, unknown, mismatched program and track claims fail closed even with explicit primary metadata', () => {
  const template = templates[0]
  const versionless = sourcePlan(template);delete versionless.template_version
  versionless.days[0].exercises[0].primary_muscles = ['glutes']
  unsupported(versionless, 'unverified_template_provenance')
  const unknown = sourcePlan(template);unknown.template_program = 'unknown'
  unsupported(unknown, 'unsupported_template_version')
  const stale = sourcePlan(template);stale.template_version = 'v0'
  unsupported(stale, 'unsupported_template_version')
  const wrongTier = sourcePlan(template);wrongTier.program = 'ignite'
  unsupported(wrongTier, 'template_program_mismatch')
  unsupported(sourcePlan(template), 'template_program_mismatch', 'ignite')
  const wrongTrack = sourcePlan(templates[4]);wrongTrack.phoenix_track = 'phoenixStrength'
  unsupported(wrongTrack, 'template_program_mismatch')
  const forgedMetadata = sourcePlan(template);forgedMetadata.days[0].exercises[0].primary_muscles = ['glutes']
  unsupported(forgedMetadata, 'template_prescription_mismatch')
})

test('modified source fields, dose, occurrence order, weekday shape and equipment exclusions cannot use the map', () => {
  for (const [key, value] of [['exercise', 'Other exercise'], ['sets', 999], ['reps', '999'], ['rest', 'changed'],
    ['tempo', 'changed'], ['notes', 'changed'], ['order', 999], ['weight_placeholder', 'changed']]) {
    const changed = sourcePlan(templates[0]);changed.days[0].exercises[0][key] = value
    unsupported(changed, 'template_prescription_mismatch')
  }
  const reversed = sourcePlan(templates[0]);reversed.days[0].exercises.reverse()
  unsupported(reversed, 'template_prescription_mismatch')
  const missing = sourcePlan(templates[0]);missing.days[0].exercises.pop()
  unsupported(missing, 'template_day_mismatch')
  const addedSunday = sourcePlan(templates[0]);addedSunday.days.push({ day_name: 'Sunday', day_intent: 'rest', focus: '', exercises: [] })
  unsupported(addedSunday, 'template_week_mismatch')
  const changedFocus = sourcePlan(templates[0]);changedFocus.days[0].focus = 'Custom'
  unsupported(changedFocus, 'template_day_mismatch')
  const excluded = sourcePlan(templates[0]);excluded.excluded_exercises = [{ day: 'Monday', exercise: 'Already removed' }]
  unsupported(excluded, 'template_equipment_exclusions')
  const review = sourcePlan(templates[0]);review.equipment_review_required = true
  unsupported(review, 'template_equipment_exclusions')
})

function withGeneratedMetadata(template) {
  const plan = sourcePlan(template)
  plan.generated_at = '2026-11-03T12:00:00Z'
  plan.excluded_exercises = []
  plan.equipment_review_required = false
  const unloaded = new Set(['side plank', 'single-leg glute bridge', 'walking lunge', 'reverse lunge', 'sumo squat', 'bulgarian split squat'])
  for (const day of plan.days) for (const exercise of day.exercises) {
    const group = variants.find(group => group.aliases.some(name => name.trim().toLowerCase().replace(/\s+/g, ' ') === exercise.exercise.trim().toLowerCase().replace(/\s+/g, ' ')))
    const variant = group?.variants.find(variant => variant.id === group.default_variant)
    Object.assign(exercise, { display_name: group?.display_name || exercise.exercise, movement_pattern: group?.pattern || null,
      selected_variant_id: variant?.id || null, selected_variant_name: variant?.name || exercise.exercise,
      selected_equipment: variant?.equipment || null, load_type: unloaded.has(exercise.exercise.toLowerCase()) ? 'bodyweight' : variant?.load_type || 'total_load',
      available_variants: clone(group?.variants || []), calculated_weight: variant ? 25 : null, calculation_note: 'Synthetic preserved generated fields' })
  }
  return plan
}

test('current generated variant/load additions preserve original objects, dose and equipment without recalculation', () => {
  for (const template of templates) {
    const plan = withGeneratedMetadata(template), before = clone(plan)
    const result = inspect({ programJson: plan, outputProgram: template.program })
    assert.equal(result.status, 'compatible', template.program)
    for (const occurrence of result.occurrences) assert.equal(occurrence.exercise, plan.days.find(day => day.day_name === occurrence.day).exercises[occurrence.index])
    assert.deepEqual(plan, before)
  }
})

test('actual current pure generator output from synthetic full-gym inputs is compatible; filtered equipment output is refused', () => {
  const { generateProgram } = load('lib/program/generateProgram.ts')
  const strengthAssessment = { bench_press_weight: 50, bench_press_reps: 8, shoulder_press_weight: 20, shoulder_press_reps: 8,
    squat_weight: 50, squat_reps: 8, romanian_deadlift_weight: 50, romanian_deadlift_reps: 8,
    seated_row_weight: 40, seated_row_reps: 8, bicep_curl_weight: 10, bicep_curl_reps: 8,
    lateral_raise_weight: 10, lateral_raise_reps: 8, close_grip_press_weight: 30, close_grip_press_reps: 8 }
  for (const program of ['ember', 'phoenixFullTransformation']) {
    const plan = generateProgram({ client: { program, equipment_access: ['full gym'] }, initialAssessment: {}, strengthAssessment })
    const before = clone(plan), result = inspect({ programJson: plan, outputProgram: program })
    assert.equal(result.status, 'compatible', program)
    assert.equal(result.occurrences.length, plan.days.flatMap(day => day.exercises).length)
    assert.deepEqual(clone(plan), before)
  }
  const filtered = generateProgram({ client: { program: 'ember', equipment_access: ['bodyweight'] }, initialAssessment: {}, strengthAssessment })
  assert.ok(filtered.excluded_exercises.length > 0)
  assert.equal(inspect({ programJson: filtered, outputProgram: 'ember' }).issues[0].code, 'template_equipment_exclusions')
})

test('cross-exercise variants, renamed variants, equipment changes and arbitrary dose extensions are rejected', () => {
  const base = withGeneratedMetadata(templates[0])
  const selected = base.days.flatMap(day => day.exercises).find(exercise => exercise.selected_variant_id)
  const originalGroup = variants.find(group => group.variants.some(variant => variant.id === selected.selected_variant_id))
  const wrong = variants.find(group => group !== originalGroup).variants[0]
  for (const patch of [{ selected_variant_id: wrong.id, selected_variant_name: wrong.name, selected_equipment: wrong.equipment, load_type: wrong.load_type },
    { selected_variant_name: 'Changed variant' }, { selected_equipment: 'Other equipment' }, { available_variants: [] },
    { load_type: 'duration' }, { calculated_weight: Infinity }]) {
    const changed = clone(base), exercise = changed.days.flatMap(day => day.exercises).find(exercise => exercise.exercise === selected.exercise)
    Object.assign(exercise, patch)
    const result = inspect({ programJson: changed })
    assert.equal(result.status, 'unsupported')
    assert.equal(result.issues[0].code, 'template_variant_mismatch')
  }
  const arbitrary = clone(base);arbitrary.days[0].exercises[0].duration = 120
  unsupported(arbitrary, 'template_prescription_mismatch')
  const partial = sourcePlan(templates[0]);partial.days[0].exercises[0].calculated_weight = 25
  unsupported(partial, 'template_variant_mismatch')
})

test('unknown primary-metadata-only saved formats are refused instead of accepted as a synthetic runtime escape', () => {
  unsupported({ program: 'ember', days: [{ day_name: 'Monday', day_intent: 'training', exercises: [
    { exercise: 'Unknown plan', primary_muscles: ['chest'], sets: 3, reps: 8 },
  ] }] }, 'unverified_template_provenance')
})

test('a changed source carrying the same version cannot silently reuse its reviewed content fingerprint', () => {
  const changed = createLoader({ [resolve('data/template/emberGym.json')]: template => {
    template.days[0].exercises[0].sets = 999
    return template
  } })('lib/program/weekdayExerciseMapping.ts')
  const plan = sourcePlan(templates[0])
  plan.days[0].exercises[0].sets = 999
  const result = changed.resolveVersionedWeekdayExerciseMappings({ programJson: plan })
  assert.equal(result.status, 'unsupported')
  assert.equal(result.issues[0].code, 'unsupported_template_version')
})
