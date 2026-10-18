import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

assert.equal(process.env.PACKAGE_A_TEST_ISOLATED, '1', 'Run through the synthetic isolation guard.')

// Access and the dispatcher execute their actual code. Only authentication,
// storage and downstream plan engines are in-process synthetic fixtures.
const { hasMemberAccess } = await importTs('lib/commerce/access.ts')
const { getTierCapabilities } = await importTs('lib/entitlements.ts')
const { getDashboardContext } = await importTs('lib/dashboard/getDashboardContext.ts', {
  react: 'export const cache = fn => fn',
  'next/navigation': 'export const redirect = path => { throw new Error("REDIRECT " + path) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.tierDispatchFixture.db',
})
const { getProgramLogicForClient } = await importTs('lib/dashboard/logic/getProgramLogicForClient.ts', {
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async args => { const f = globalThis.tierDispatchFixture; f.dailyInputs.push(args); return f.dailyPlan }',
  '@/lib/assessment/getMonthlyAssessmentStatus': 'export const getMonthlyAssessmentStatus = async (supabase, clientId) => { const f = globalThis.tierDispatchFixture; f.assessmentInputs.push({ supabase, clientId }); return { due: false } }',
  '@/lib/cycle/getCycleStatus': 'export const getCycleStatus = client => { const f = globalThis.tierDispatchFixture; f.cycleClients.push(client); return f.cycleStatus }',
  '@/lib/program/getProgramWorkout': 'export const getProgramWorkout = args => { const f = globalThis.tierDispatchFixture; f.workoutInputs.push(args); return f.workout }',
  './getProgramLogicEngine': 'export const getProgramLogicEngine = async args => { const f = globalThis.tierDispatchFixture; f.engineInputs.push(args); return { program: args.program, client: { id: args.client.client_id, program: args.program } } }',
})

const owner = 'synthetic-tier-owner'
const clientId = 'LOCAL-TIER-CANONICALIZATION'

function fixture(program, { signedIn = true } = {}) {
  const client = Object.freeze({
    client_id: clientId, auth_user_id: owner, program, access: true, active: true,
    // Explicit synthetic gifted access exercises the actual access rule without
    // a purchase, commerce activation or a time-dependent expiration fixture.
    verified_purchase: false, onboarding_completed: true, birthdate: '1990-01-01',
    address_line_1: '1 Synthetic Street', city: 'Synthetic', state: 'IL', postal_code: '60000',
  })
  const outputs = ['ember', 'ignite', 'phoenix'].map(tier => ({ id: `owned-${tier}`, client_id: clientId, program: tier }))
  outputs.push({ id: 'foreign-output', client_id: 'OTHER-CLIENT', program: 'ember' })
  const f = {
    client, reads: [], engineInputs: [], dailyInputs: [], assessmentInputs: [], cycleClients: [], workoutInputs: [],
    dailyPlan: { date: '2026-10-18', synthetic: true }, cycleStatus: { enabled: false },
    workout: { todaysWorkout: { day_name: 'Synthetic plan' }, adjustedExercises: [], cycleAdjustment: null },
    db: {
      auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null }, error: null }) },
      from(table) {
        assert.ok(['clients', 'client_current_profiles', 'program_outputs'].includes(table), `Unexpected synthetic table: ${table}`)
        const filters = []
        let columns
        const q = {
          select(value) { columns = value; return q },
          eq(key, value) { filters.push([key, value]); return q },
          order() { return q }, limit() { return q },
          async maybeSingle() {
            f.reads.push({ table, columns, filters: structuredClone(filters) })
            const rows = table === 'clients' ? [client] : table === 'program_outputs' ? outputs : []
            return { data: rows.find(row => filters.every(([key, value]) => row[key] === value)) || null, error: null }
          },
        }
        return q
      },
    },
  }
  globalThis.tierDispatchFixture = f
  return f
}

function caseVariants(value) {
  return Array.from({ length: 2 ** value.length }, (_, mask) => [...value]
    .map((letter, index) => mask & (1 << index) ? letter.toUpperCase() : letter).join(''))
}

for (const tier of ['ember', 'ignite', 'phoenix']) {
  test(`${tier}: every accepted letter-case variant dispatches its canonical owned program`, async () => {
    for (const storedProgram of caseVariants(tier)) {
      const f = fixture(storedProgram)
      const before = structuredClone(f.client)
      assert.equal(hasMemberAccess(f.client), true, storedProgram)
      const context = await getDashboardContext()
      const output = await getProgramLogicForClient(context)
      const args = f.engineInputs[0]
      assert.equal(args.program, tier, storedProgram)
      assert.equal(output.program, tier, storedProgram)
      assert.equal(output.client.program, tier, storedProgram)
      assert.equal(getTierCapabilities(output.program).nutritionMicronutrients, tier !== 'ember')
      const programRead = f.reads.find(read => read.table === 'program_outputs')
      assert.deepEqual(programRead.filters, [['client_id', clientId], ['program', tier]])
      assert.equal(f.workoutInputs[0].output.id, `owned-${tier}`)
      assert.deepEqual(f.reads.find(read => read.table === 'clients').filters, [['auth_user_id', owner]])
      assert.equal(args.client, f.client, 'Canonicalizing dispatch does not replace the owned client')
      assert.equal(f.dailyInputs[0].client, f.client)
      assert.equal(f.cycleClients[0], f.client)
      assert.deepEqual(f.client, before, 'Stored tier and client profile are not mutated')
    }
  })
}

test('canonical dispatch retains the provided daily plan and all downstream plan arguments', async () => {
  const f = fixture('EMBER')
  const provided = { date: '2026-10-18', syntheticProvidedPlan: true }
  const context = await getDashboardContext()
  await getProgramLogicForClient({ ...context, dailyPlan: provided })
  const args = f.engineInputs[0]
  assert.equal(f.dailyInputs.length, 0)
  assert.equal(args.dailyPlan, provided)
  assert.equal(args.supabase, f.db)
  assert.equal(args.user.id, owner)
  assert.equal(args.client, f.client)
  assert.equal(args.cycleStatus, f.cycleStatus)
  assert.equal(args.plannedWorkout, f.workout.todaysWorkout)
  assert.equal(args.plannedExercises, f.workout.adjustedExercises)
  assert.equal(args.cycleAdjustment, f.workout.cycleAdjustment)
  assert.equal(args.monthlyAssessmentsDueCount, 0)
})

test('unknown and missing memberships remain denied by actual context before dispatch', async () => {
  for (const storedProgram of ['unknown', '', null, undefined, ' ember ', 'PHOENIX ']) {
    const f = fixture(storedProgram)
    assert.equal(hasMemberAccess(f.client), false)
    await assert.rejects(async () => {
      const context = await getDashboardContext()
      return getProgramLogicForClient(context)
    }, /REDIRECT \/dashboard\/payment-issue/)
    assert.equal(f.engineInputs.length, 0)
    assert.equal(f.reads.some(read => read.table === 'program_outputs'), false)
    assert.equal(f.dailyInputs.length, 0)
  }
})

test('direct dispatcher fallback uses EMBER capabilities without granting membership access', async () => {
  for (const storedProgram of ['unknown', '', null, undefined]) {
    const f = fixture(storedProgram)
    const before = structuredClone(f.client)
    assert.equal(hasMemberAccess(f.client), false)
    const output = await getProgramLogicForClient({ supabase: f.db, user: { id: owner }, client: f.client })
    assert.equal(output.program, 'ember')
    assert.equal(getTierCapabilities(output.program).nutritionMicronutrients, false)
    assert.equal(hasMemberAccess(f.client), false)
    assert.deepEqual(f.client, before)
  }
})

test('unauthenticated requests retain the context login redirect before any dispatch or member query', async () => {
  const f = fixture('EMBER', { signedIn: false })
  await assert.rejects(async () => {
    const context = await getDashboardContext()
    return getProgramLogicForClient(context)
  }, /REDIRECT \/login/)
  assert.deepEqual(f.reads, [])
  assert.deepEqual(f.engineInputs, [])
})
