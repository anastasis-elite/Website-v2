import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

// Production route code with in-process synthetic authentication/storage only.
// This slice retains the released macro API: no macro UUID/replay claim is made.
assert.equal(process.env.PACKAGE_A_TEST_ISOLATED, '1', 'Run through the synthetic isolation guard.')
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-17T17:00:00.000Z') })
after(() => mock.timers.reset())
const { getTierCapabilities } = await importTs('lib/entitlements.ts')
const policy = await importTs('lib/nutrition/memberNutrition.ts')
const { calculateMicronutrientTargets } = await importTs('lib/nutrition/calculateMicronutrientTargets.ts')
const { getClientLocalDate } = await importTs('lib/timezone.ts')
const microTargets = calculateMicronutrientTargets({ age: 35, calories: 2100, weightLbs: 160, waterOz: 96, cyclePhase: 'luteal', trainingLevel: 'general_fitness' })
const macroTargets = { calories: 2100, protein: 125, carbs: 240, fats: 68, inputs: { age: 35 }, calculationStatus: 'complete', statusLabel: 'Calculated', statusDescription: 'Personalized macro targets', lastCalculatedAt: 'qa-calculated-at' }
const macros = { calories: 300, protein: 22, carbs: 30, fats: 10 }
const owner = 'qa-nutrition-owner', clientId = 'QA-NUTRITION-BOUNDARY', waterSubmissionId = 'f2000000-0000-4000-8000-000000000001'
const mocks = {
  'next/server': 'export const NextResponse={json:(body,init)=>Response.json(body,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.memberNutritionDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan=()=>{}',
  '@/lib/mobile/auth': 'export const createMobileRequestContext=async()=>globalThis.memberNutritionMobileContext',
  '@/lib/nutrition/calculateMicronutrientTargets': 'export const calculateMicronutrientTargets=(input)=>{globalThis.memberMicroCalls.push(input);return structuredClone(globalThis.memberMicroTargets)}',
  '@/lib/nutrition/targetService': 'export const calculateClientNutritionTargets=async(input)=>{globalThis.memberTargetCalls.push({clientId:input.clientId,program:input.program});return {target:structuredClone(globalThis.memberMacroTargets),water:96,weightLbs:160,phase:"luteal"}};export const normalizeCyclePhase=value=>value;export const nutritionLogAuditFields=()=>({formula_version:"qa-existing-macro-formula"})',
}
const targetRoute = await importTs('app/api/nutrition/route.ts', mocks)
const prepareRoute = await importTs('app/api/nutrition-log/route.ts', mocks)
const waterRoute = await importTs('app/api/nutrition/add-water/route.ts', mocks)
const mobileWaterRoute = await importTs('app/api/mobile/actions/water/route.ts', mocks)
const macroRoute = await importTs('app/api/nutrition/add-macros/route.ts', mocks)
const post = body => new Request('http://127.0.0.1/qa', { method: 'POST', body: JSON.stringify(body) })
const readLog = (db, extra = '') => prepareRoute.GET(new Request(`http://qa.invalid/api/nutrition-log?client_id=${clientId}&log_date=${db.today}${extra}`))

function database(program, { legacy = false, signedIn = true, foreign = false, failTable } = {}) {
  const client = { client_id: clientId, auth_user_id: foreign ? 'qa-other-owner' : owner, program, timezone: 'America/Chicago', birthdate: '1991-04-15' }
  const today = getClientLocalDate(client)
  const oldLog = { id: 'qa-log', client_id: clientId, auth_user_id: owner, log_date: today, ...macroTargets, water_oz: 96, water_consumed_oz: 16, water_submission_ids: [], completed: false, formula_version: 'legacy-macro-formula', calculation_status: 'manual_override', calculation_mode: 'saved_assessment', status_label: 'Saved macro override', status_description: 'A saved macro assessment is in use.', calculated_at: '2026-10-16T16:00:00.000Z',
    nutrition_calculation: { statusLabel: 'Saved macro context', statusDescription: 'Saved assessment-derived macros', calculationMode: 'assessment', calculationStatus: 'complete', normalizedGoal: 'recomp', bmi: 24, leanBodyMassKg: 60, bodyFatPercentUsed: 25, activityFactor: 1.5, rollingActiveEnergy: 300, rollingRestingEnergy: null, safeguardAdjusted: true, safeguardsApplied: ['saved safeguard'], finalMacroPercentages: { protein: 25, carbs: 45, fats: 30 }, micronutrientTargets: { iron: 18 } },
    ...microTargets, meals: [{ id: 'historical-food', food_nutrients: { iron_mg: 5 } }] }
  const remaining = { nutrition_log_id: oldLog.id, calories_remaining: 2100, protein_remaining_g: 125, carbs_remaining_g: 240, fat_remaining_g: 68, fiber_remaining_g: 28, iron_remaining_mg: 18 }
  const tables = { clients: [client], nutrition_logs: legacy ? [structuredClone(oldLog)] : [], nutrition_log_remaining: [remaining], macro_entries: [], nutrition_log_totals_by_block: [] }
  const writes = [], reads = []
  const db = { tables, writes, reads, today, oldLog, client, auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null } }) },
    from(table) {
      let value, mode, options, selection = '*'; const filters = []
      const q = {
        select(columns = '*') { selection = columns; return q },
        eq(key, expected) { filters.push(row => row[key] === expected); return q },
        insert(input) { value = input; mode = 'insert'; return q }, update(input) { value = input; mode = 'update'; return q },
        upsert(input, opts) { value = input; mode = 'upsert'; options = opts; return q },
        single() { return resolve(true) }, maybeSingle() { return resolve(true) }, then(done, reject) { return resolve(false).then(done, reject) },
      }
      async function resolve(single) {
        reads.push({ table, selection }); tables[table] ||= []
        if (table === failTable) return { data: null, error: { message: 'Synthetic saved-log read failed' } }
        let rows = tables[table].filter(row => filters.every(filter => filter(row)))
        if (mode === 'upsert') {
          const existing = tables[table].find(row => row.client_id === value.client_id && row.log_date === value.log_date)
          if (existing && options?.ignoreDuplicates) return { data: null, error: null }
          rows = [existing || { id: 'qa-created-log', water_submission_ids: [] }]
          if (!existing) tables[table].push(rows[0])
        } else if (mode === 'insert') {
          rows = [{ id: 'qa-created-log', water_submission_ids: [], ...structuredClone(value) }]; tables[table].push(rows[0])
        }
        if (mode) {
          for (const row of rows) Object.assign(row, structuredClone(value))
          writes.push({ table, mode, value: structuredClone(value) })
        }
        const project = row => row && (selection === '*' ? structuredClone(row) : Object.fromEntries(selection.split(',').map(key => key.trim()).filter(key => key in row).map(key => [key, structuredClone(row[key])])))
        return { data: single ? project(rows[0]) || null : rows.map(project), error: null }
      }
      return q
    },
    async rpc(name, args) {
      assert.equal(name, 'add_daily_water')
      const row = tables.nutrition_logs.find(item => item.id === args.p_log_id)
      assert.equal(row.auth_user_id, owner)
      if (!row.water_submission_ids.includes(args.p_submission_id)) {
        row.water_submission_ids.push(args.p_submission_id)
        row.water_consumed_oz = Number(row.water_consumed_oz || 0) + args.p_ounces
      }
      writes.push({ rpc: name, args: structuredClone(args) })
      return { data: structuredClone(row), error: null }
    },
  }
  globalThis.memberNutritionDb = db
  globalThis.memberNutritionMobileContext = signedIn ? { supabase: db, client, user: { id: owner } } : { error: 'Unauthorized', status: 401 }
  globalThis.memberMicroTargets = microTargets; globalThis.memberMicroCalls = []
  globalThis.memberMacroTargets = macroTargets; globalThis.memberTargetCalls = []
  return db
}

function assertMicroBoundary(row, entitled) {
  for (const key of Object.keys(microTargets)) {
    assert.equal(key in row, entitled, key)
    if (entitled) assert.equal(row[key], microTargets[key], `${key}: entitled value is unchanged`)
  }
  assert.equal('meals' in row, entitled && 'meals' in row)
}

for (const program of ['ember', 'ignite', 'phoenix', null, 'unrecognized']) {
  const entitled = program === 'ignite' || program === 'phoenix'
  test(`${program}: capability and scalar projections preserve macros/IDs/audit without mutation`, () => {
    const { oldLog } = database(program)
    const before = structuredClone(oldLog), log = policy.memberNutritionLog(oldLog, program)
    assert.equal(getTierCapabilities(program).nutritionMicronutrients, entitled)
    assert.equal(policy.canTrackMicronutrients(program), entitled)
    assertMicroBoundary(log, entitled)
    for (const key of ['id', 'client_id', 'auth_user_id', 'calories', 'protein', 'carbs', 'fats', 'water_oz', 'water_consumed_oz', 'water_submission_ids', 'formula_version']) assert.deepEqual(log[key], before[key])
    assert.deepEqual(log.nutrition_calculation.finalMacroPercentages, before.nutrition_calculation.finalMacroPercentages)
    assert.equal('micronutrientTargets' in log.nutrition_calculation, entitled)
    assert.deepEqual(oldLog, before)
    const food = policy.memberFoodNutrition({ id: 'qa-food', name: 'Synthetic food', protein_g: 15, fiber_g: 6, cholesterol_mg: 10, iron_mg: 8 }, program)
    assert.equal(food.protein_g, 15); assert.equal('fiber_g' in food, entitled); assert.equal('cholesterol_mg' in food, entitled)
    const remaining = policy.memberNutritionRemaining({ nutrition_log_id: 'qa', protein_remaining_g: 25, fiber_remaining_g: 20, iron_remaining_mg: 10 }, program)
    assert.equal(remaining.protein_remaining_g, 25); assert.equal('fiber_remaining_g' in remaining, entitled)
    assert.equal(policy.memberNutritionLogColumns(program) === '*', entitled)
    assert.equal(policy.memberNutritionRemainingColumns(program) === '*', entitled)
  })

  test(`${program}: saved-log GET preserves optional macro metadata and filters member output without writes`, async () => {
    const db = database(program, { legacy: true })
    const before = structuredClone(db.tables)
    const response = await readLog(db, '&program=phoenix&tier=phoenix')
    assert.equal(response.status, 200)
    const body = await response.json()
    const row = body.nutritionLog
    assertMicroBoundary(row, entitled)
    for (const key of ['id', 'client_id', 'auth_user_id', 'log_date', 'calories', 'protein', 'carbs', 'fats', 'water_oz', 'water_consumed_oz', 'formula_version', 'calculation_status', 'calculation_mode', 'status_label', 'status_description', 'calculated_at']) {
      assert.deepEqual(row[key], before.nutrition_logs[0][key], key)
    }
    assert.deepEqual(row.nutrition_calculation.finalMacroPercentages, before.nutrition_logs[0].nutrition_calculation.finalMacroPercentages)
    for (const [key, value] of Object.entries(before.nutrition_logs[0].nutrition_calculation)) {
      if (key !== 'micronutrientTargets') assert.deepEqual(row.nutrition_calculation[key], value, `Saved macro context: ${key}`)
    }
    assert.equal('micronutrientTargets' in row.nutrition_calculation, entitled)
    if (entitled) assert.deepEqual(row, before.nutrition_logs[0], 'Entitled tiers retain the complete saved row')
    assert.ok(db.reads.some(read => read.table === 'nutrition_logs' && read.selection === '*'), 'Optional persisted metadata is read at the server boundary')
    assert.deepEqual(db.tables, before)
    assert.deepEqual(db.writes, [])
    assert.equal(globalThis.memberMicroCalls.length, 0)
    assert.equal(globalThis.memberTargetCalls.length, 0)
  })

  test(`${program}: target GET ignores forged query program and keeps personalized macros/water`, async () => {
    database(program)
    const response = await targetRoute.GET(new Request(`http://127.0.0.1/api/nutrition?client_id=${clientId}&program=phoenix`))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.program, program || 'ember')
    for (const key of ['calories', 'protein', 'carbs', 'fats', 'statusLabel', 'statusDescription', 'calculationStatus', 'lastCalculatedAt']) assert.equal(body[key], macroTargets[key])
    assert.equal(body.water, 96); assert.equal('micros' in body, entitled); assertMicroBoundary(body, entitled)
    assert.equal(globalThis.memberMicroCalls.length, entitled ? 1 : 0)
    assert.equal(globalThis.memberTargetCalls[0].program, program || 'ember')
  })

  for (const legacy of [false, true]) {
    test(`${program}: prepare ${legacy ? 'existing' : 'new'} log preserves saved history and filters member response`, async () => {
      const db = database(program, { legacy }), before = structuredClone(db.tables.nutrition_logs[0])
      const response = await prepareRoute.POST(post({ client_id: clientId, ...macroTargets, water_oz: 96, createOnly: true }))
      assert.equal(response.status, 200)
      const body = await response.json(); assertMicroBoundary(body.nutritionLog, entitled)
      assert.equal(body.nutritionLog.protein, 125)
      assert.equal(globalThis.memberMicroCalls.length, entitled ? 1 : 0)
      if (legacy) assert.deepEqual(db.tables.nutrition_logs[0], before)
      else for (const key of Object.keys(microTargets)) assert.equal(key in db.writes[0].value, entitled)
    })

    test(`${program}: web water ${legacy ? 'existing' : 'new'} log/retry preserves UUID dedup and historical micros`, async () => {
      const db = database(program, { legacy }), before = structuredClone(db.tables.nutrition_logs[0])
      const input = { clientId, logDate: db.today, submissionId: waterSubmissionId, ounces: 12.5 }
      const first = await waterRoute.POST(post(input)), retry = await waterRoute.POST(post(input))
      assert.equal(first.status, 200); assert.equal(retry.status, 200)
      const body = await retry.json(); assertMicroBoundary(body.nutritionLog, entitled)
      assert.equal(body.nutritionLog.water_consumed_oz, (legacy ? 16 : 0) + 12.5)
      assert.deepEqual(body.nutritionLog.water_submission_ids, [waterSubmissionId])
      assert.equal(db.tables.nutrition_logs.length, 1)
      assert.equal(globalThis.memberMicroCalls.length, !legacy && entitled ? 1 : 0)
      if (legacy) for (const key of [...Object.keys(microTargets), 'meals', 'nutrition_calculation']) assert.deepEqual(db.tables.nutrition_logs[0][key], before[key])
      else for (const key of Object.keys(microTargets)) assert.equal(key in db.writes.find(write => write.mode === 'insert').value, entitled)
    })

    test(`${program}: mobile water ${legacy ? 'existing' : 'new'} response filters micros without changing water behavior`, async () => {
      const db = database(program, { legacy }), before = structuredClone(db.tables.nutrition_logs[0])
      const response = await mobileWaterRoute.POST(post({ ounces: 12.5 }))
      assert.equal(response.status, 200)
      const body = await response.json(); assertMicroBoundary(body.nutritionLog, entitled)
      assert.equal(body.nutritionLog.water_consumed_oz, (legacy ? 16 : 0) + 12.5)
      assert.equal(globalThis.memberMicroCalls.length, !legacy && entitled ? 1 : 0)
      if (legacy) for (const key of [...Object.keys(microTargets), 'meals', 'nutrition_calculation']) assert.deepEqual(db.tables.nutrition_logs[0][key], before[key])
      else for (const key of Object.keys(microTargets)) assert.equal(key in db.writes[0].value, entitled)
    })
  }

  test(`${program}: one released macro save preserves entitlement and filters its remaining response`, async () => {
    const db = database(program, { legacy: true }), before = structuredClone(db.tables.nutrition_logs[0])
    const input = { nutritionLogId: 'qa-log', ...macros, mealPeriod: 'breakfast' }
    const response = await macroRoute.POST(post(input))
    assert.equal(response.status, entitled ? 403 : 200)
    if (entitled) { assert.equal(db.writes.length, 0); return }
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.refreshStatus, 'success')
    assert.equal(db.tables.macro_entries.length, 1)
    assert.equal(body.entry.protein_g, 22)
    assert.equal(body.remaining.protein_remaining_g, 103); assert.equal(body.remaining.calories_remaining, 1800)
    assert.equal('fiber_remaining_g' in body.remaining, false); assert.equal('iron_remaining_mg' in body.remaining, false)
    assert.equal(db.tables.nutrition_log_remaining[0].iron_remaining_mg, 18)
    for (const key of [...Object.keys(microTargets), 'meals']) assert.deepEqual(db.tables.nutrition_logs[0][key], before[key])
  })
}

test('EMBER macro calculation projection rejects nested injected values while preserving valid saved metadata', () => {
  const { oldLog } = database('ember', { legacy: true })
  oldLog.nutrition_calculation = {
    statusLabel: { micronutrientTargets: { iron: 18 } },
    statusDescription: 'Saved macro assessment', normalizedGoal: 'recomp',
    calculationMode: ['MICRO_INJECTION'], calculationStatus: 'complete',
    bmi: { micronutrients: { magnesium: 320 } }, leanBodyMassKg: 60,
    bodyFatPercentUsed: 25, activityFactor: 1.5, rollingActiveEnergy: Infinity, rollingRestingEnergy: null,
    safeguardAdjusted: { micros: 'MICRO_INJECTION' },
    safeguardsApplied: ['Saved macro safeguard', { micronutrients: 'MICRO_INJECTION' }, ['MICRO_INJECTION'], 1],
    finalMacroPercentages: { protein: 25, carbs: Number.NaN, fats: { iron: 18 }, magnesium: 320 },
    micronutrientTargets: { iron: 18 },
  }
  const before = structuredClone(oldLog)
  const projected = policy.memberNutritionLog(oldLog, 'ember')
  assert.deepEqual(projected.nutrition_calculation, {
    statusDescription: 'Saved macro assessment', normalizedGoal: 'recomp', calculationStatus: 'complete',
    leanBodyMassKg: 60, bodyFatPercentUsed: 25, activityFactor: 1.5, rollingRestingEnergy: null,
    safeguardsApplied: ['Saved macro safeguard'], finalMacroPercentages: { protein: 25 },
  })
  assert.doesNotMatch(JSON.stringify(projected.nutrition_calculation), /iron|magnesium|micro|INJECTION/i)
  assert.deepEqual(oldLog, before, 'Projection does not rewrite the stored legacy calculation')
})

test('saved-log GET requires authentication and current client ownership before reading saved rows', async () => {
  const anonymous = database('ember', { legacy: true, signedIn: false })
  assert.equal((await readLog(anonymous)).status, 401)
  assert.deepEqual(anonymous.reads, [])
  assert.deepEqual(anonymous.writes, [])

  const foreign = database('phoenix', { legacy: true, foreign: true })
  const before = structuredClone(foreign.tables)
  assert.equal((await readLog(foreign, '&program=phoenix')).status, 404)
  assert.ok(foreign.reads.every(read => read.table === 'clients'))
  assert.deepEqual(foreign.tables, before)
  assert.deepEqual(foreign.writes, [])
})

test('saved-log GET requires a day and returns an absent owned day without preparing or calculating it', async () => {
  const db = database('ember')
  for (const query of [`client_id=${clientId}`, `log_date=${db.today}`, `client_id=${clientId}&log_date=not-a-day`]) {
    const response = await prepareRoute.GET(new Request(`http://qa.invalid/api/nutrition-log?${query}`))
    assert.equal(response.status, 400)
  }
  db.tables.nutrition_logs.push({ ...db.oldLog, log_date: '2026-10-16' })
  const before = structuredClone(db.tables)
  const response = await readLog(db)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { nutritionLog: null })
  assert.deepEqual(db.tables, before)
  assert.deepEqual(db.writes, [])
  assert.equal(globalThis.memberMicroCalls.length, 0)
  assert.equal(globalThis.memberTargetCalls.length, 0)
})

test('saved-log GET cannot expose a row owned by another account and does not mutate storage after read failure', async () => {
  const foreignLog = database('ember', { legacy: true })
  foreignLog.tables.nutrition_logs[0].auth_user_id = 'another-log-owner'
  const foreignBefore = structuredClone(foreignLog.tables)
  assert.deepEqual(await (await readLog(foreignLog)).json(), { nutritionLog: null })
  assert.deepEqual(foreignLog.tables, foreignBefore)
  assert.deepEqual(foreignLog.writes, [])

  const failed = database('ember', { legacy: true, failTable: 'nutrition_logs' })
  const before = structuredClone(failed.tables)
  assert.equal((await readLog(failed)).status, 500)
  assert.deepEqual(failed.tables, before)
  assert.deepEqual(failed.writes, [])
})

test('owner/auth failures do not calculate targets or mutate synthetic storage', async () => {
  const db = database('phoenix', { foreign: true })
  const result = await targetRoute.GET(new Request(`http://127.0.0.1/api/nutrition?client_id=${clientId}&program=phoenix`))
  assert.equal(result.status, 404); assert.equal(db.writes.length, 0); assert.equal(globalThis.memberMicroCalls.length, 0)
  database('ember', { signedIn: false })
  for (const route of [prepareRoute, waterRoute, mobileWaterRoute, macroRoute]) assert.equal((await route.POST(post({}))).status, 401)
})

test('entitled target GET retains the actual micronutrient engine output and training context', async () => {
  const { ['@/lib/nutrition/calculateMicronutrientTargets']: _mockCalculator, ...actualCalculatorMocks } = mocks
  const actualTargetRoute = await importTs('app/api/nutrition/route.ts', actualCalculatorMocks)
  for (const program of ['ignite', 'phoenix', 'IGNITE', ' phoenix ']) {
    database(program)
    const response = await actualTargetRoute.GET(new Request(`http://127.0.0.1/api/nutrition?client_id=${clientId}&program=ember`))
    assert.equal(response.status, 200)
    const body = await response.json()
    const expected = calculateMicronutrientTargets({ age: 35, calories: 2100, weightLbs: 160, waterOz: 96, cyclePhase: 'luteal', trainingLevel: program === 'phoenix' ? 'recovery' : program === 'ignite' ? 'strength_hypertrophy' : 'general_fitness' })
    for (const [key, value] of Object.entries(expected)) assert.equal(body[key], value, `${program}: ${key}`)
  }
})
