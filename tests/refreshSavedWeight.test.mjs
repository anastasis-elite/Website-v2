import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
const fixed = Date.parse('2026-11-02T15:00:00Z')
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [fixed])) } static now() { return fixed } }
function load(path) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path).exports
  if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
  const module = { exports: {} }; cache.set(path, module)
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  runInNewContext(code, { module, exports: module.exports, Date: Clock, Intl, console, require(name) {
    if (name === 'server-only') return {}
    const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
    if (!base) return require(name)
    return load(/\.(?:json|tsx?)$/.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
  } }, { filename: path })
  return module.exports
}

const { projectSavedExercisePrescription: project } = load('lib/program/savedPrescription.ts')
const { actualWeightForInput } = load('lib/workout/exerciseLoadPresentation.ts')
const { getCurrentProgramWorkout } = load('lib/program/getProgramWorkout.ts')
const client = { client_id: 'c1', auth_user_id: 'u1', program: 'ember', current_weight: 180, timezone: 'America/Chicago' }
const assessment = { client_id: 'c1', assessment_type: 'strength', data: { romanian_deadlift_weight: 95, romanian_deadlift_reps: 10 } }
const old = { exercise: 'Barbell RDL', selected_variant_name: 'Barbell Romanian Deadlift', sets: 4, reps: 8, load_guidance_status: 'unverified', load_guidance_reason: 'old', recommended_weight: 1 }
test('unverified saved RDL gets a real current recommendation and populated field without trusting old weight', () => {
 const before = JSON.stringify(old), ex = project(old, 'ember', client, assessment)
 assert.equal(ex.load_guidance_status, undefined)
 assert.equal(ex.sets, 4); assert.equal(ex.reps, 8); assert.equal(ex.exercise, old.exercise)
 assert.equal(ex.prescription_calculation.estimated_1rm, 95 * (1 + 10/30))
 assert.equal(ex.prescription_calculation.version, 'founder-load-v3')
 assert.ok(actualWeightForInput(ex, 'lb') > 1)
 assert.equal(project(ex, 'ember').load_guidance_status, undefined)
 assert.equal(JSON.stringify(old), before)
})
test('missing/current invalid inputs remain unavailable; no saved weight fallback', () => {
 for (const a of [null, { data: {} }, { data: { romanian_deadlift_weight: 95, romanian_deadlift_reps: 'bad' } }]) {
  const ex = project(old, 'ember', client, a)
  assert.equal(ex.load_guidance_status, 'unverified'); assert.ok(Number.isNaN(actualWeightForInput(ex, 'lb')))
 }
 const missingFactor = project({ ...old, exercise: 'Wide-Grip Lat Pulldown' }, 'ember', client, { data: { seated_row_weight: 100, seated_row_reps: 10 } })
 assert.equal(missingFactor.load_guidance_status, 'unverified')
})
test('recorded work, bodyweight options and history projection are never refreshed', () => {
 for (const patch of [{ completed: true }, { skipped: true }, { set_logs: [{ reps: 8, weight: 40 }] }, { actual_reps: 8 }, { confirmed_at: '2026-11-13' }]) {
  const ex = { ...old, ...patch }; assert.equal(project(ex, 'ember', client, assessment), ex)
 }
 const bw = { ...old, load_type: 'bodyweight' }; assert.equal(project(bw, 'ember', client, assessment), bw)
 assert.equal(project(old, 'ember'), old)
})
test('ambiguous equipment cannot be silently replaced', () => {
 const ex = project({ ...old, selected_variant_id: 'unknown' }, 'ember', client, assessment)
 assert.equal(ex.load_guidance_status, 'unverified')
})
function db(result, calls) {
 const q = { select: (...x) => { calls.push(['select', ...x]); return q }, eq: (...x) => { calls.push(['eq', ...x]); return q },
 order: () => q, limit: () => q, maybeSingle: async () => result }
 return { from: name => { calls.push(['from', name]); return q } }
}
const output = { program: 'ember', program_json: { days: [{ day_name: 'Monday', day_intent: 'training', exercises: [old] }] } }
test('current workout query is member-scoped and current input reaches the projection', async () => {
 const calls = [], result = await getCurrentProgramWorkout({ supabase: db({ data: assessment }, calls), user: { id: 'u1' }, client, output })
 assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'client_id' && c[2] === 'c1'))
 assert.ok(result.adjustedExercises[0].calculated_weight > 1)
})
test('identity mismatch/read failure never supplies a current weight', async () => {
 for (const setup of [{ user: { id: 'other' }, result: { data: assessment } }, { user: { id: 'u1' }, result: { error: 'offline' } }, { user: { id: 'u1' }, result: { data: { ...assessment, client_id: 'other' } } }]) {
  const calls = [], result = await getCurrentProgramWorkout({ supabase: db(setup.result, calls), user: setup.user, client, output })
  assert.equal(result.adjustedExercises[0].load_guidance_status, 'unverified')
  if (setup.user.id === 'other') assert.equal(calls.length, 0)
 }
})
