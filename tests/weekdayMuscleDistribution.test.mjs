import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loader(mocks = {}) {
  const cache = new Map()
  const load = path => {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    Function('module', 'exports', 'require', compiled)(module, module.exports, name => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name === 'server-only') return {}
      const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      if (!base) return require(name)
      return load(base.endsWith('.json') || base.endsWith('.ts') ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
    })
    return module.exports
  }
  return load
}
// Pure conservation cases below use a verified synthetic adapter ONLY in this
// test loader. No synthetic/explicit-primary escape exists in runtime source.
const syntheticAdapter = { resolveVersionedWeekdayExerciseMappings({ programJson }) {
  if (!programJson.__testVerifiedWeekdaySource) return { status: 'unsupported', issues: [{ code: 'unverified_template_source', message: 'Not a verified synthetic fixture.' }] }
  return { status: 'compatible', provenance: { templateProgram: 'synthetic-only', templateVersion: 'fixture-v1', mappingVersion: 'test-only' },
    missingWeekdays: [], occurrences: programJson.days.flatMap(day => !Array.isArray(day.exercises) ? [] : day.exercises.map((exercise, index) => ({
      day: day.day_name, index, exercise, mapping: exercise?.__testPinned || { kind: 'movable', primaryMuscles: exercise?.primary_muscles, basis: 'Synthetic fixture only' },
    }))) }
} }
const { redistributeProgramWeek, inspectProgramWeekSource } = loader({ '@/lib/program/weekdayExerciseMapping': syntheticAdapter })('lib/program/weekdayMuscleDistribution.ts')
const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const choices = selected => Object.fromEntries(week.map(day => [day, selected[day] || []]))
const exercise = (name, primary, changes = {}) => ({ exercise: name, primary_muscles: primary, sets: 3, reps: 8,
  recommended_weight: 25, selected_equipment: 'dumbbell', load_type: 'per_hand', ...changes })
const program = training => ({ __testVerifiedWeekdaySource: true, program: 'synthetic-supported', days: week.map((day_name, index) => ({
  day_name, day_intent: index < training.length ? 'training' : 'rest', focus: 'Original focus', exercises: training[index] || [],
})) })
const codes = result => result.issues.map(issue => issue.code)
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

test('custom chest plus biceps and a separate prescribed core day conserve every occurrence and complete dose', () => {
  const sameNameA = exercise('Saved curl', ['biceps'], { order: 7, reps: '8–10', recommended_weight: 12.5, load_type: 'per_hand' })
  const sameNameB = exercise('Saved curl', ['biceps'], { order: 1, sets: 4, reps: 6, recommended_weight: 25, load_type: 'total_load' })
  const original = freeze(program([
    [exercise('Saved row', ['lats'], { secondary_muscles: ['biceps'] }), exercise('Saved press', ['chest'])],
    [sameNameA, exercise('Saved core', ['core'], { sets: '2', reps: '30 seconds', recommended_weight: null })],
    [exercise('Saved shin work', ['feet_ankles'])],
    [exercise('Saved calf work', ['calves']), exercise('Saved glute work', ['glutes'])], [sameNameB],
  ]))
  const before = JSON.stringify(original)
  const selected = freeze(choices({ Monday: ['lats'], Tuesday: ['chest', 'biceps'], Wednesday: ['core'],
    Thursday: ['feet_ankles'], Friday: ['calves', 'glutes'] }))
  const result = redistributeProgramWeek({ programJson: original, days: selected })
  assert.equal(result.status, 'supported')
  assert.equal(result.trainingDayCount, 5)
  assert.equal(result.exerciseCount, 8)
  assert.deepEqual(result.days.map(day => day.day_name), week)
  assert.deepEqual(result.days[1].exercises, [original.days[0].exercises[1], sameNameB, sameNameA])
  assert.equal(result.days[1].focus, 'Chest + Biceps')
  assert.deepEqual(result.days[2].exercises, [original.days[1].exercises[1]])
  assert.deepEqual(result.days[3].exercises, original.days[2].exercises)
  assert.deepEqual(result.days[4].exercises, original.days[3].exercises)
  const output = result.days.flatMap(day => day.exercises)
  for (const entry of original.days.flatMap(day => day.exercises)) assert.equal(output.filter(item => item === entry).length, 1)
  assert.equal(output.reduce((total, entry) => total + Number(entry.sets), 0), 24)
  assert.equal(JSON.stringify(original), before)
  assert.deepEqual(result, redistributeProgramWeek({ programJson: original, days: selected }))
  assert.equal(result.days.filter(day => day.day_intent === 'rest').length, 2)
})

test('training frequency and rest-day count cannot be increased or collapsed to fill preferences', () => {
  const source = program([[exercise('Press', ['chest'])], [exercise('Curl', ['biceps'])]])
  const fewer = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['chest', 'biceps'] }) })
  assert.equal(fewer.status, 'unsupported')
  assert.match(fewer.issues.find(issue => issue.code === 'training_day_count').message, /2 workdays.*produce 1/)
  const moreSource = program([[exercise('Press', ['chest']), exercise('Row', ['lats'])], [exercise('Curl', ['biceps'])]])
  const more = redistributeProgramWeek({ programJson: moreSource, days: choices({ Wednesday: ['chest'] }) })
  assert.equal(more.status, 'unsupported')
  assert.ok(codes(more).includes('training_day_count'))
  assert.equal('days' in more, false)
})

test('a separate core day is supported only by existing prescribed primary core work', () => {
  const source = program([[exercise('Press', ['chest'])], [exercise('Row', ['lats'])]])
  const result = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['chest', 'lats'], Wednesday: ['core'] }) })
  assert.equal(result.status, 'unsupported')
  assert.ok(codes(result).includes('no_prescribed_group'))
  assert.match(result.issues.find(issue => issue.code === 'no_prescribed_group').message, /Core.*cannot add exercises or weekly sets/)
  assert.deepEqual(source.days[2].exercises, [])
})

test('missing, secondary-only, unknown or noncanonical metadata does not use misleading exercise-name inference', () => {
  for (const changes of [{ primary_muscles: undefined }, { primary_muscles: [], secondary_muscles: ['hamstrings'] },
    { primary_muscles: ['made_up'] }, { primary_muscles: ['quadriceps'] }]) {
    const source = program([[exercise('Seated Ham Curl', ['hamstrings'], changes)]])
    const result = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['biceps'] }) })
    assert.equal(result.status, 'unsupported')
    assert.ok(codes(result).some(code => ['missing_muscle_mapping', 'unsupported_muscle_mapping'].includes(code)))
    assert.equal('days' in result, false)
    assert.equal(inspectProgramWeekSource({ programJson: source }).status, 'unsupported')
  }
})

test('compound primary groups must stay together while secondary groups do not reclassify chest work', () => {
  const compound = exercise('Saved squat', ['quads', 'glutes'])
  const source = program([[compound], [exercise('Saved press', ['chest'], { secondary_muscles: ['biceps'] })]])
  const split = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['quads', 'chest'], Friday: ['glutes'] }) })
  assert.equal(split.status, 'unsupported')
  assert.ok(codes(split).includes('ambiguous_prescription'))
  const together = redistributeProgramWeek({ programJson: source, days: choices({ Tuesday: ['chest'], Friday: ['quads', 'glutes'] }) })
  assert.equal(together.status, 'supported')
  assert.equal(together.days[4].exercises[0], compound)
  assert.equal(together.days[1].exercises[0], source.days[1].exercises[0])
})

test('unselected clear work stays in place while repeated groups and invalid sources fail without partial projection', () => {
  const source = program([[exercise('Press', ['chest'])], [exercise('Curl', ['biceps'])]])
  const missing = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['chest'] }) })
  assert.equal(missing.status, 'supported')
  assert.equal(missing.days[1].exercises[0], source.days[1].exercises[0])
  assert.deepEqual(missing.preferredDays, ['Monday'])
  assert.deepEqual(missing.workDays, ['Monday', 'Tuesday'])
  const repeated = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['chest'], Tuesday: ['chest', 'biceps'] }) })
  assert.equal(repeated.status, 'unsupported'); assert.ok(codes(repeated).includes('multiple_group_days'))
  const invalid = redistributeProgramWeek({ programJson: source, days: { Monday: ['chest'] } })
  assert.deepEqual(codes(invalid), ['invalid_weekdays'])
  const unknown = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['push'], Tuesday: ['biceps'] }) })
  assert.deepEqual(codes(unknown), ['invalid_muscle_group'])
  for (const broken of [{ ...source, days: [source.days[0], source.days[0]] },
    program([[]]), program([[null]]), { ...source, days: [{ day_name: 'Monday', day_intent: 'rest', exercises: source.days[0].exercises }] }]) {
    assert.equal(inspectProgramWeekSource({ programJson: broken }).status, 'unsupported')
  }
})

test('test-only verified source still honors legacy rest intent rather than empty equipment-excluded training', () => {
  const source = { ...program([[exercise('Saved press', ['chest'])]]), program: 'ember' }
  delete source.days[0].day_intent
  delete source.days[2].day_intent
  assert.deepEqual(inspectProgramWeekSource({ programJson: source }), {
    status: 'available', trainingDayCount: 1, exerciseCount: 1, availableGroups: ['chest'],
    retainedEntries: [], mappingProvenance: 'synthetic-only fixture-v1; test-only',
    workDays: ['Monday'], unspecifiedWeekdays: [],
  })
  const result = redistributeProgramWeek({ programJson: source, days: choices({ Wednesday: ['chest'] }) })
  assert.equal(result.status, 'supported'); assert.equal(result.days[2].exercises[0], source.days[0].exercises[0])
  assert.equal(result.days[0].day_intent, 'rest')
  const excluded = { ...source, excluded_exercises: [{ day: 'Wednesday', exercise: 'Unavailable exercise' }] }
  assert.equal(inspectProgramWeekSource({ programJson: excluded }).status, 'unsupported')
  const unknown = { ...source, program: 'unknown' }
  assert.equal(inspectProgramWeekSource({ programJson: unknown }).status, 'unsupported')
})

test('non-strength pins remain exact original occurrences and never become muscle work in a synthetic projection', () => {
  const breathwork = exercise('Breathwork', undefined, { sets: 1, reps: '2 minutes', recommended_weight: null,
    __testPinned: { kind: 'pinned', category: 'non_strength', reason: 'Non-strength prescribed activity.', ownerDecision: '' } })
  const source = freeze(program([[breathwork, exercise('Press', ['chest'])], [exercise('Curl', ['biceps'])]]))
  const before = JSON.stringify(source)
  const result = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['biceps'], Tuesday: ['chest'] }) })
  assert.equal(result.status, 'supported')
  assert.equal(result.days[0].exercises[0], breathwork)
  assert.equal(result.days[0].exercises[1], source.days[1].exercises[0])
  assert.equal(result.days[1].exercises[0], source.days[0].exercises[1])
  for (const original of source.days.flatMap(day => day.exercises)) {
    assert.equal(result.days.flatMap(day => day.exercises).filter(item => item === original).length, 1)
  }
  const status = inspectProgramWeekSource({ programJson: source })
  assert.deepEqual(status.availableGroups, ['chest', 'biceps'])
  assert.deepEqual(status.retainedEntries, [{ day: 'Monday', exercise: 'Breathwork', reason: 'Non-strength prescribed activity.', requiresOwnerDecision: false }])
  assert.equal(JSON.stringify(source), before)
})

test('ambiguous and non-strength entries stay fixed without requiring selected focus on their weekdays', () => {
  const nonStrength = exercise('Walk', undefined, { __testPinned: { kind: 'pinned', category: 'non_strength', reason: 'Non-strength activity.', ownerDecision: '' } })
  const pinned = exercise('Arm Circuit', undefined, { __testPinned: { kind: 'pinned', category: 'ambiguous', reason: 'Circuit exercises are not specified.', ownerDecision: 'Define only if moving the circuit.' } })
  const source = freeze(program([[nonStrength, exercise('Press', ['chest'])], [pinned, exercise('Curl', ['biceps'])]]))
  const before = JSON.stringify(source)
  const result = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['biceps'] }) })
  assert.equal(result.status, 'supported')
  assert.deepEqual(result.days[0].exercises, [nonStrength, source.days[1].exercises[1], source.days[0].exercises[1]])
  assert.deepEqual(result.days[1].exercises, [pinned])
  assert.deepEqual(result.fixedExtraDays, ['Tuesday'])
  assert.equal(result.retainedEntries.find(item => item.exercise === 'Arm Circuit').requiresOwnerDecision, false)
  assert.equal(result.days[1].focus, 'Original focus')
  assert.equal(JSON.stringify(source), before)
})

test('incoming work from earlier and later days stays between the original fixed prefix and suffix', () => {
  const fixed = name => exercise(name, undefined, { __testPinned: { kind: 'pinned', category: 'ambiguous', reason: 'Unclear saved activity; retain source order.', ownerDecision: '' } })
  const beforeWork = fixed('Unclassified first activity')
  const betweenWork = fixed('Unclassified middle activity')
  const afterWork = fixed('Unclassified last activity')
  const earlier = exercise('Earlier press', ['chest'], { order: 90 })
  const later = exercise('Later press', ['chest'], { order: -5 })
  const originalCore = exercise('Original core', ['core'], { order: 80 })
  const originalCurl = exercise('Original curl', ['biceps'], { order: 0 })
  const source = freeze(program([
    [fixed('Earlier fixed work'), earlier],
    [beforeWork, originalCore, betweenWork, originalCurl, afterWork],
    [later, fixed('Later fixed work')],
  ]))
  const before = JSON.stringify(source)
  const result = redistributeProgramWeek({ programJson: source, days: choices({ Tuesday: ['chest'] }) })
  assert.equal(result.status, 'supported')
  assert.deepEqual(result.days[1].exercises, [beforeWork, earlier, later, originalCore, betweenWork, originalCurl, afterWork])
  assert.deepEqual(result.workDays, ['Monday', 'Tuesday', 'Wednesday'])
  assert.deepEqual(result.fixedExtraDays, ['Monday', 'Wednesday'])
  assert.equal(JSON.stringify(source), before)
})

test('a fixed-only destination refuses an unestablished insertion position without dropping any work', () => {
  const fixed = exercise('Unclassified fixed activity', undefined, { __testPinned: { kind: 'pinned', category: 'ambiguous', reason: 'Fixed original prescription.', ownerDecision: '' } })
  const source = freeze(program([[fixed], [exercise('Curl', ['biceps']), exercise('Press', ['chest'])]]))
  const before = JSON.stringify(source)
  const result = redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['biceps'] }) })
  assert.equal(result.status, 'unsupported')
  assert.ok(codes(result).includes('unestablished_insertion_order'))
  assert.equal('days' in result, false)
  assert.equal(JSON.stringify(source), before)
})

test('an incoming focus keeps actual Endurance source-prefix activities before work and Cooldown Walk last', () => {
  const actual = loader()('lib/program/weekdayMuscleDistribution.ts')
  const template = JSON.parse(readFileSync('data/template/phoenixEndurance.json', 'utf8'))
  const source = freeze({ program: template.program, template_program: template.program, template_version: template.version, days: template.days })
  const original = source.days[0].exercises
  assert.equal(original[0].exercise, 'Incline Walk')
  assert.equal(original.at(-1).exercise, 'Cooldown Walk')
  const result = actual.redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['lats'] }) })
  assert.equal(result.status, 'supported')
  const monday = result.days[0].exercises
  assert.equal(monday[0], original[0])
  assert.equal(monday.at(-1), original.at(-1))
  const incoming = source.days.slice(1).flatMap(day => day.exercises).filter(entry => ['Lat Pulldown', 'Straight-Arm Lat Pulldown', 'Close-Grip Lat Pulldown'].includes(entry.exercise))
  assert.ok(incoming.length > 0)
  for (const entry of incoming) assert.ok(monday.indexOf(entry) > 0 && monday.indexOf(entry) < monday.length - 1)
  assert.deepEqual(monday.filter(entry => original.includes(entry)), original)
})

test('actual adapter refuses unknown, versionless, stale or modified saved formats even with explicit primary arrays', () => {
  const actual = loader()('lib/program/weekdayMuscleDistribution.ts')
  const template = JSON.parse(readFileSync('data/template/phoenixFullTransformation.json', 'utf8'))
  const valid = { program: template.program, template_program: template.program, template_version: template.version, days: template.days }
  const versions = [program([[exercise('Saved press', ['chest'])]]), { ...valid, template_version: undefined },
    { ...valid, template_program: 'unknown' }, { ...valid, template_version: 'stale-v0' }]
  const changed = structuredClone(valid)
  changed.days[0].exercises[0].sets = 999
  const addedMetadata = structuredClone(valid)
  addedMetadata.days[0].exercises[0].primary_muscles = ['core']
  for (const source of [...versions, changed, addedMetadata]) {
    const before = JSON.stringify(source)
    const result = actual.redistributeProgramWeek({ programJson: source, days: choices({ Monday: ['chest'] }) })
    assert.equal(result.status, 'unsupported')
    assert.equal('days' in result, false)
    assert.equal(JSON.stringify(source), before)
  }
})

test('all ten exact real template families support a meaningful focus move while preserving fixed extras and missing days', () => {
  const actual = loader()('lib/program/weekdayMuscleDistribution.ts')
  const files = ['emberGym', 'igniteGym', 'phoenixBodybuilding', 'phoenixEndurance', 'phoenixFullTransformation',
    'phoenixGluteSculpt', 'phoenixHypertrophy', 'phoenixRecomposition', 'phoenixStrength', 'phoenixWaistCincher']
  for (const file of files) {
    const template = JSON.parse(readFileSync(`data/template/${file}.json`, 'utf8'))
    const source = freeze({ program: template.program, template_program: template.program, template_version: template.version, days: template.days })
    const before = JSON.stringify(source)
    const status = actual.inspectProgramWeekSource({ programJson: source })
    assert.equal(status.status, 'available', file)
    assert.match(status.mappingProvenance, new RegExp(`${template.program} ${template.version}`))
    assert.ok(status.retainedEntries.length > 0, file)
    assert.ok(status.retainedEntries.every(entry => entry.requiresOwnerDecision === false), file)
    assert.deepEqual(status.unspecifiedWeekdays, file === 'phoenixFullTransformation' ? [] : ['Sunday'], file)
    const group = file === 'emberGym' || file === 'igniteGym' || file === 'phoenixWaistCincher' ? 'core' : 'glutes'
    const result = actual.redistributeProgramWeek({ programJson: source, days: choices({ Monday: [group] }) })
    assert.equal(result.status, 'supported', `${file}: ${JSON.stringify(result.issues)}`)
    assert.deepEqual(result.preferredDays, ['Monday'], file)
    assert.equal(result.trainingDayCount, status.trainingDayCount, file)
    assert.equal(result.exerciseCount, source.days.flatMap(day => day.exercises).length, file)
    assert.deepEqual(result.days.map(day => day.day_name), source.days.map(day => day.day_name), file)
    assert.deepEqual(result.unspecifiedWeekdays, status.unspecifiedWeekdays, file)
    assert.ok(result.fixedExtraDays.length > 0, file)
    const projected = result.days.flatMap(day => day.exercises)
    const originals = source.days.flatMap(day => day.exercises)
    for (const entry of originals) assert.equal(projected.filter(item => item === entry).length, originals.filter(item => item === entry).length, file)
    for (const fixed of status.retainedEntries) {
      const originalDay = source.days.find(day => day.day_name === fixed.day)
      const projectedDay = result.days.find(day => day.day_name === fixed.day)
      for (const entry of originalDay.exercises.filter(entry => entry.exercise === fixed.exercise)) assert.ok(projectedDay.exercises.includes(entry), file)
    }
    assert.ok(source.days.some(day => day.day_name !== 'Monday' && day.exercises.some(entry =>
      !result.days.find(projectedDay => projectedDay.day_name === day.day_name).exercises.includes(entry))), `${file}: meaningful move`)
    if (status.unspecifiedWeekdays.length) {
      const absent = actual.redistributeProgramWeek({ programJson: source, days: choices({ Sunday: [group] }) })
      assert.equal(absent.status, 'unsupported', file)
      assert.ok(codes(absent).includes('unspecified_destination'), file)
      assert.equal('days' in absent, false, file)
    }
    assert.equal(JSON.stringify(source), before, file)
  }
})

test('exact saved identity remains the diagnostic identity when generated display aliases differ', () => {
  const actual = loader()('lib/program/weekdayMuscleDistribution.ts')
  const strength = JSON.parse(readFileSync('data/template/phoenixStrength.json', 'utf8'))
  const source = { program: strength.program, template_program: strength.program, template_version: strength.version, days: strength.days }
  const prescribed = source.days.flatMap(day => day.exercises).find(entry => entry.exercise === 'Dumbbell Press')
  const variants = JSON.parse(readFileSync('data/reference/exerciseVariants.json', 'utf8'))
  const group = variants.find(entry => entry.aliases.some(alias => alias.trim().toLowerCase() === prescribed.exercise.toLowerCase()))
  const variant = group.variants.find(entry => entry.id === group.default_variant)
  Object.assign(prescribed, { display_name: group.display_name, movement_pattern: group.pattern,
    selected_variant_id: variant.id, selected_variant_name: variant.name, selected_equipment: variant.equipment,
    load_type: variant.load_type, available_variants: structuredClone(group.variants), calculated_weight: 25,
    calculation_note: 'Synthetic coherent generated metadata' })
  assert.notEqual(prescribed.display_name, prescribed.exercise)
  const before = JSON.stringify(source)
  const aliased = actual.inspectProgramWeekSource({ programJson: source })
  const retained = aliased.retainedEntries.find(entry => entry.exercise === 'Dumbbell Press')
  assert.ok(retained)
  assert.equal(retained.requiresOwnerDecision, false)
  assert.equal(aliased.retainedEntries.some(entry => entry.exercise === prescribed.display_name), false)
  assert.equal(JSON.stringify(source), before)
  const generator = readFileSync('lib/program/generateProgram.ts', 'utf8').split('export const PHOENIX_PRESCRIPTION_TRACKS')[0]
  assert.equal(generator.includes('primary_muscles'), false)
  assert.match(generator, /\.\.\.exercise/)
})

test('actual pure generator outputs from synthetic full-gym inputs support reviewed focus movement without changing prescriptions', () => {
  const load = loader()
  const actual = load('lib/program/weekdayMuscleDistribution.ts')
  const { generateProgram } = load('lib/program/generateProgram.ts')
  const strengthAssessment = { bench_press_weight: 50, bench_press_reps: 8, shoulder_press_weight: 20, shoulder_press_reps: 8,
    squat_weight: 50, squat_reps: 8, romanian_deadlift_weight: 50, romanian_deadlift_reps: 8,
    seated_row_weight: 40, seated_row_reps: 8, bicep_curl_weight: 10, bicep_curl_reps: 8,
    lateral_raise_weight: 10, lateral_raise_reps: 8, close_grip_press_weight: 30, close_grip_press_reps: 8 }
  const files = ['emberGym', 'igniteGym', 'phoenixBodybuilding', 'phoenixEndurance', 'phoenixFullTransformation',
    'phoenixGluteSculpt', 'phoenixHypertrophy', 'phoenixRecomposition', 'phoenixStrength', 'phoenixWaistCincher']
  for (const file of files) {
    const template = JSON.parse(readFileSync(`data/template/${file}.json`, 'utf8'))
    const source = freeze(generateProgram({ client: { program: template.program, equipment_access: ['full gym'] }, initialAssessment: {}, strengthAssessment }))
    const before = JSON.stringify(source)
    const group = ['emberGym', 'igniteGym', 'phoenixWaistCincher'].includes(file) ? 'core' : 'glutes'
    const result = actual.redistributeProgramWeek({ programJson: source, outputProgram: template.program, days: choices({ Monday: [group] }) })
    assert.equal(result.status, 'supported', `${file}: ${JSON.stringify(result.issues)}`)
    const projected = result.days.flatMap(day => day.exercises)
    for (const entry of source.days.flatMap(day => day.exercises)) assert.equal(projected.filter(item => item === entry).length, 1, file)
    assert.equal(JSON.stringify(source), before, file)
    assert.equal(result.days.length, template.days.length, file)
  }
  const filtered = generateProgram({ client: { program: 'ember', equipment_access: ['bodyweight'] }, initialAssessment: {}, strengthAssessment })
  const refused = actual.redistributeProgramWeek({ programJson: filtered, outputProgram: 'ember', days: choices({ Monday: ['core'] }) })
  assert.equal(refused.status, 'unsupported')
  assert.ok(codes(refused).includes('template_equipment_exclusions'))
})
