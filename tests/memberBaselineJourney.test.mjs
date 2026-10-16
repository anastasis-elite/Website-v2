import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

// Only authentication and the database transport are replaced. The route handlers,
// repository templates, load calculations, and nutrient formulas execute unchanged.
const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.memberBaselineDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.memberBaselineInvalidations = (globalThis.memberBaselineInvalidations || 0) + 1 }',
  '@/lib/supabase/admin': 'export const createAdminClient = () => globalThis.memberBaselineDb',
}
for (const [, path] of readFileSync('lib/program/generateProgram.ts', 'utf8').matchAll(/from '(@\/[^']+\.json)'/g)) {
  mocks[path] = `export default ${readFileSync(path.slice(2), 'utf8')}`
}
const initialRoute = await importTs('app/api/assessment/route.ts', mocks)
const strengthRoute = await importTs('app/api/assessment-strength/route.ts', mocks)
const generateRoute = await importTs('app/api/program/generate/route.ts', mocks)
const { calculateClientNutritionTargets } = await importTs('lib/nutrition/targetService.ts', mocks)
const { getDailyExecutionPlan } = await importTs('lib/day/getDailyExecutionPlan.ts', mocks)
const { getProgramWorkout } = await importTs('lib/program/getProgramWorkout.ts', mocks)
const { getClientTimeZone } = await importTs('lib/timezone.ts', mocks)
const owner = 'isolated-ember-baseline-user'
const clientId = 'QA-BASELINE-EMBER-ONLY'
const initial = { trainingDays: '3', equipmentAccess: 'commercial-gym', experienceLevel: 'some-experience', primaryFocus: 'strength', currentLimitations: 'none', recoveryCapacity: 'moderate', sleepQuality: 'decent', stressLevel: 'moderate', cardioPreference: 'walking' }
const strength = { birthdate: '1991-04-15', height_in: '67', weight: '160', weight_goal: 'strength', training_environment: 'gym', shoulder_press_weight: '20', shoulder_press_reps: '8', squat_weight: '95', squat_reps: '8', bench_press_weight: '65', bench_press_reps: '8', close_grip_press_weight: '45', close_grip_press_reps: '8', romanian_deadlift_weight: '95', romanian_deadlift_reps: '8', seated_row_weight: '55', seated_row_reps: '8', bicep_curl_weight: '15', bicep_curl_reps: '10', lateral_raise_weight: '8', lateral_raise_reps: '10' }
const req = (body) => new Request('http://qa.test/api/assessment', { method: 'POST', body: JSON.stringify(body) })

function database({ store, signedIn = true, failTable = null } = {}) {
  const tables = store || {
    clients: [{ client_id: clientId, auth_user_id: owner, full_name: 'Isolated QA Member', email: 'ember-qa@example.invalid', birthdate: strength.birthdate, program: 'ember', active: true, access: true, verified_purchase: true, onboarding_completed: true, timezone: 'America/Chicago', reproductive_status: 'not_tracking' }],
    client_current_profiles: [], assessments: [], program_outputs: [], nutrition_logs: [], workout_logs: [], recovery_logs: [], cycle_logs: [], daily_health_metrics: [], health_integrations: [], recommendation_audit_logs: [],
  }
  const writes = []
  const db = { tables, writes, async rpc(name, args) {
    assert.equal(name, 'save_strength_assessment')
    const { p_client_id: id, p_period: period, p_expected_revision: revision, p_values: values, p_complete: complete, p_program_json: program } = args
    tables.strength_assessment_sessions ||= []
    const existing = tables.strength_assessment_sessions.find(row => row.client_id === id && row.period === period)
    if (existing?.status === 'completed') return { data: { success: complete && JSON.stringify(existing.values) === JSON.stringify(values), alreadyCompleted: true, status: 409, code: 'conflict', assessment: existing }, error: null }
    if ((existing?.revision || 0) !== revision) return { data: { success: false, status: 409, code: 'conflict', assessment: existing }, error: null }
    if (failTable === 'strength_assessment_sessions' || complete && ['assessments', 'client_current_profiles'].includes(failTable) || complete && program && failTable === 'program_outputs') return { data: null, error: { message: 'QA atomic storage failure' } }
    const savedAt = new Date().toISOString()
    let assessmentId = null
    if (complete) {
      assessmentId = `qa-strength-${tables.assessments.length + 1}`
      tables.assessments.push({ id: assessmentId, client_id: id, auth_user_id: owner, assessment_type: 'strength', data: structuredClone(values), submitted_at: savedAt, assessment_period: period })
      const profile = tables.client_current_profiles.find(row => row.client_id === id)
      if (profile) Object.assign(profile, { current_weight: Number(values.weight), updated_at: savedAt })
      else tables.client_current_profiles.push({ user_id: owner, client_id: id, current_weight: Number(values.weight), updated_at: savedAt })
      if (program) tables.program_outputs.push({ id: `qa-program-${tables.program_outputs.length + 1}`, client_id: id, auth_user_id: owner, program: tables.clients[0].program, status: 'generated', program_json: structuredClone(program), generated_at: savedAt })
    }
    const saved = { client_id: id, auth_user_id: owner, period, status: complete ? 'completed' : 'draft', values: structuredClone(values), revision: revision + 1, saved_at: savedAt, completed_at: complete ? savedAt : null, assessment_id: assessmentId }
    if (existing) Object.assign(existing, saved); else tables.strength_assessment_sessions.push(saved)
    writes.push({ table: 'strength_assessment_sessions', value: saved })
    return { data: { success: true, assessment: saved }, error: null }
  }, auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner, email: 'ember-qa@example.invalid' } : null }, error: null }) }, from(table) {
    const filters = []; let mutation = null; let upsert = false; let sort = null; let size = null; let countOnly = false
    const q = {
      select(_columns, options) { countOnly = Boolean(options?.head); return q },
      eq(key, value) { filters.push(row => row[key] === value); return q },
      in(key, values) { filters.push(row => values.includes(row[key])); return q },
      gte(key, value) { filters.push(row => row[key] >= value); return q },
      lte(key, value) { filters.push(row => row[key] <= value); return q },
      lt(key, value) { filters.push(row => row[key] < value); return q },
      order(key, { ascending = true } = {}) { sort = [key, ascending]; return q },
      limit(value) { size = value; return q },
      insert(value) { mutation = value; return q },
      upsert(value) { mutation = value; upsert = true; return q },
      update(value) { mutation = value; upsert = 'update'; return q },
      maybeSingle: async () => resolve(true), single: async () => resolve(true), then(done) { return Promise.resolve(resolve()).then(done) },
    }
    function resolve(single = false) {
      if (table === failTable) return { data: null, error: { message: 'QA storage failure' } }
      tables[table] ||= []
      if (mutation) {
        const values = Array.isArray(mutation) ? mutation : [mutation]
        for (const value of values) {
          const existing = upsert === 'update' ? tables[table].find(row => filters.every(filter => filter(row))) : upsert ? tables[table].find(row => row.client_id === value.client_id) : null
          if (existing) Object.assign(existing, structuredClone(value))
          else if (upsert !== 'update') tables[table].push({ id: `qa-${table}-${tables[table].length + 1}`, ...structuredClone(value) })
          writes.push({ table, value: structuredClone(value) })
        }
      }
      let rows = tables[table].filter(row => filters.every(filter => filter(row)))
      if (sort) { const [key, ascending] = sort; rows = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)) }
      if (size !== null) rows = rows.slice(0, size)
      return { data: countOnly ? null : single ? rows[0] || null : rows, count: rows.length, error: null }
    }
    return q
  } }
  globalThis.memberBaselineDb = db
  return db
}

test('isolated EMBER initial assessment → strength → persisted useful plan → reloaded nutrient guidance', async () => {
  const db = database()
  const initialResponse = await initialRoute.POST(req({ ...initial, client_id: 'OTHER', program: 'phoenix', auth_user_id: 'OTHER' }))
  assert.equal(initialResponse.status, 200)
  assert.equal((await initialResponse.json()).redirect, '/dashboard/assessment/start2')
  const savedInitial = db.tables.assessments[0]
  assert.equal(savedInitial.client_id, clientId)
  assert.equal(savedInitial.auth_user_id, owner)
  assert.equal(savedInitial.program, 'ember')
  assert.equal(savedInitial.assessment_type, 'initial')
  const response = await strengthRoute.POST(req({ ...strength, client_id: clientId, auth_user_id: 'OTHER', program: 'phoenix' }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).redirect, '/dashboard/program')
  assert.equal(db.tables.assessments.filter(row => row.assessment_type === 'strength').length, 1)
  const saved = db.tables.program_outputs[0]
  assert.equal(saved.client_id, clientId)
  assert.equal(saved.auth_user_id, owner)
  assert.equal(saved.program, 'ember')
  const exercises = saved.program_json.days.flatMap(day => day.exercises)
  assert.ok(exercises.length > 0)
  const bench = exercises.find(exercise => exercise.assessment_key === 'Bench')
  assert.ok(bench.estimated_1rm > 65)
  assert.ok(bench.calculated_weight > 0)
  assert.ok(bench.reps > 0 && bench.sets > 0)
  // A fresh transport/session reads records saved by the original requests.
  const reloaded = database({ store: structuredClone(db.tables) })
  assert.equal(getClientTimeZone(reloaded.tables.clients[0]), 'America/Chicago')
  const nutrition = await calculateClientNutritionTargets({ supabase: reloaded, clientId, program: 'ember' })
  assert.equal(nutrition.target.inputs.trainingFrequencyDaysPerWeek, 3)
  assert.ok(Math.abs(nutrition.target.inputs.weightKg - 72.57) < .02)
  assert.ok(Math.abs(nutrition.target.inputs.heightCm - 170.18) < .02)
  assert.equal(nutrition.target.calculationStatus, 'estimated')
  assert.ok(nutrition.target.calories > 0 && nutrition.target.protein > 0)
  assert.equal(nutrition.water, 96)
  const daily = await getDailyExecutionPlan({ supabase: reloaded, client: reloaded.tables.clients[0] })
  assert.equal(daily.dailyTargets.water, 96)
  assert.equal(daily.calories, nutrition.target.calories)
  assert.equal(daily.dailyTargets.protein, nutrition.target.protein)
  assert.equal(daily.dailyTargets.carbs, nutrition.target.carbs)
  assert.equal(daily.dailyTargets.fats, nutrition.target.fats)
  assert.equal(daily.nutritionCalculationStatus, 'estimated')
  const workout = getProgramWorkout({ client: reloaded.tables.clients[0], output: reloaded.tables.program_outputs[0] })
  assert.deepEqual(workout.programJson, saved.program_json)
})

test('saved member limitations and equipment constrain the first generated plan', async () => {
  const db = database()
  assert.equal((await initialRoute.POST(req({ ...initial, equipmentAccess: 'bodyweight', currentLimitations: 'Avoid overhead pressing' }))).status, 200)
  assert.equal((await strengthRoute.POST(req(strength))).status, 200)
  const profile = db.tables.client_current_profiles[0]
  assert.deepEqual(profile.equipment_access, ['bodyweight'])
  assert.deepEqual(profile.limitations, ['Avoid overhead pressing'])
  assert.equal(profile.primary_goal, 'strength')
  assert.equal(profile.workout_days_available, 3)
  const exercises = db.tables.program_outputs[0].program_json.days.flatMap(day => day.exercises)
  assert.ok(exercises.length > 0)
  assert.ok(exercises.every(exercise => !exercise.selected_equipment || exercise.selected_equipment === 'bodyweight'))
})

test('untrusted empty assessments and dangerous symptoms do not create an active training plan', async () => {
  let db = database()
  assert.equal((await initialRoute.POST(req({}))).status, 400)
  assert.equal(db.tables.assessments.length, 0)
  db = database({ signedIn: false })
  assert.equal((await strengthRoute.POST(req(strength))).status, 401)
  assert.equal(db.writes.length, 0)
  db = database()
  assert.equal((await initialRoute.POST(req(initial))).status, 200)
  const safetyResponse = await strengthRoute.POST(req({ ...strength, notes: 'chest pain during exercise' }))
  assert.equal(safetyResponse.status, 200)
  assert.equal((await safetyResponse.json()).planStatus, 'safety_paused')
  assert.equal(db.tables.program_outputs.length, 0)
})

test('strength setup requires a saved initial assessment and valid measurements without inventing lift baselines', async () => {
  let db = database()
  const missingInitial = await strengthRoute.POST(req(strength))
  assert.equal(missingInitial.status, 409)
  assert.equal((await missingInitial.json()).redirect, '/dashboard/assessment/start')
  assert.equal(db.writes.length, 0)
  db = database()
  await initialRoute.POST(req(initial))
  for (const invalid of [{ ...strength, height_in: '' }, { ...strength, weight: '-1' }, { ...strength, squat_reps: '1.5' }, { ...strength, squat_weight: '' }]) {
    assert.equal((await strengthRoute.POST(req(invalid))).status, 400)
  }
  assert.equal(db.tables.program_outputs.length, 0)
  const partial = { ...strength, shoulder_press_weight: '', shoulder_press_reps: '', lateral_raise_weight: '0' }
  assert.equal((await strengthRoute.POST(req(partial))).status, 200)
  const saved = db.tables.assessments.find(row => row.assessment_type === 'strength')
  assert.equal(saved.data.shoulder_press_weight, '')
  assert.equal(saved.data.lateral_raise_weight, '0')
})

test('a failed final transaction preserves the draft and retries without a partial baseline', async () => {
  const db = database({ failTable: 'program_outputs' })
  await initialRoute.POST(req(initial))
  const response = await strengthRoute.POST(req(strength))
  assert.equal(response.status, 503)
  const failure = await response.json()
  assert.equal(failure.success, undefined)
  assert.equal(failure.code, 'save_failed')
  assert.equal(db.tables.program_outputs.length, 0)
  assert.equal(db.tables.assessments.filter(row => row.assessment_type === 'strength').length, 0)
  const retry = database({ store: structuredClone(db.tables) })
  assert.equal((await strengthRoute.POST(req(strength))).status, 200)
  assert.equal(retry.tables.assessments.filter(row => row.assessment_type === 'strength').length, 1)
  assert.equal(retry.tables.program_outputs.length, 1)
  assert.ok(globalThis.memberBaselineInvalidations > 0)
})

test('plan retries preserve equipment constraints and safety without repeating saved assessments', async () => {
  const db = database()
  await initialRoute.POST(req({ ...initial, equipmentAccess: 'bodyweight' }))
  await strengthRoute.POST(req(strength))
  db.tables.program_outputs = []
  const retry = database({ store: structuredClone(db.tables) })
  assert.equal((await generateRoute.POST(req({ client_id: clientId }))).status, 200)
  const saved = retry.tables.program_outputs[0]
  assert.ok(saved.program_json.equipment_review_required)
  const exercises = saved.program_json.days.flatMap(day => day.exercises)
  assert.ok(exercises.length > 0)
  assert.ok(exercises.every(exercise => !exercise.selected_equipment || exercise.selected_equipment === 'bodyweight'))
  retry.tables.assessments.find(row => row.assessment_type === 'strength').data.notes = 'chest pain during exercise'
  assert.equal((await generateRoute.POST(req({ client_id: clientId }))).status, 409)
  assert.equal(retry.tables.program_outputs.length, 1)
  assert.equal(retry.tables.assessments.length, 2)
})
