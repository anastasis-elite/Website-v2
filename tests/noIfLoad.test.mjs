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

const { calculateFounderLoadFromEstimated1RM: calc } = load('lib/program/founderReference.ts')
const { generateProgram } = load('lib/program/generateProgram.ts')
const { projectSavedExercisePrescription: project } = load('lib/program/savedPrescription.ts')
const args = { estimated1RM: 95 * (1 + 10 / 30), bodyweightFactor: 0, bodyMassLb: 180, repMultiplier: .675, group: null, variant: null, bodyweight: false }
test('95 x 10 squat, current BWF zero, produces 85 lb without IF', () => {
 assert.equal(calc(args).adjustedWeight, 85)
 assert.equal(calc({ ...args, bodyweightFactor: .2 }).adjustedWeight, 60)
})
test('missing BWF, mass, nonpositive subtraction and invalid reps cannot invent load', () => {
 for (const patch of [{ bodyweightFactor: undefined }, { bodyweightFactor: null }, { bodyweightFactor: '' }, { bodyweightFactor: -.1 }, { bodyweightFactor: .4, bodyMassLb: null }, { bodyweightFactor: 1 }, { repMultiplier: NaN }]) assert.ok(Number.isNaN(calc({ ...args, ...patch }).adjustedWeight))
 assert.equal(calc({ ...args, bodyMassLb: null }).adjustedWeight, 85)
})
function row() { return generateProgram({ client: { program: 'ember', equipment_access: ['cable'], current_weight: 180 }, initialAssessment: {}, strengthAssessment: { seated_row_weight: 100, seated_row_reps: 10 } }).days.flatMap(d => d.exercises).find(e => e.exercise === 'Seated Cable Row') }
test('new provenance verifies; forged bodyweight coefficient does not', () => {
 const ex = row(); assert.equal(ex.prescription_calculation.version, 'founder-load-v3'); assert.equal(project(ex, 'ember'), ex)
 assert.equal(project({ ...ex, prescription_calculation: { ...ex.prescription_calculation, bodyweight_factor: .9 } }, 'ember').load_guidance_status, 'unverified')
})
test('validated legacy refresh is opt-in and leaves source/session snapshots intact', () => {
 const ex = row(), original = JSON.parse(JSON.stringify(ex))
 const p = ex.prescription_calculation
 Object.assign(p, { version: 'founder-load-v2', intensity_key: 'ember_if', intensity_factor: .6 })
 const refs = load('data/reference/masterKey.json'), ref = refs.find(r => r.exercise === ex.exercise)
 const { calculateLegacyFounderLoadFromEstimated1RM: legacy } = load('lib/program/founderReference.ts')
 p.intensity_factor = ref.ember_if; ex.intensity_factor = ref.ember_if
 const variants = load('data/reference/exerciseVariants.json'), group = variants.find(g => g.variants.some(v => v.id === ex.selected_variant_id)), variant = group.variants.find(v => v.id === ex.selected_variant_id)
 const result = legacy({ estimated1RM: p.estimated_1rm, intensityFactor: p.intensity_factor, repMultiplier: p.rep_multiplier, group, variant, bodyweight: false })
 p.base_weight = ex.baseline_weight = result.baseCalculatedWeight; p.equipment_weight = ex.calculated_weight = ex.recommended_weight = result.adjustedWeight
 const before = JSON.stringify(ex)
 assert.equal(project(ex, 'ember').load_guidance_status, 'unverified')
 const refreshed = project(ex, 'ember', { current_weight: 180 })
 assert.equal(refreshed.prescription_calculation.version, 'founder-load-v3'); assert.equal(refreshed.recommended_weight, original.recommended_weight)
 assert.equal(JSON.stringify(ex), before)
 assert.equal(project({ ...ex, completed: true }, 'ember', { current_weight: 180 }).recommended_weight, ex.recommended_weight)
})
