import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-15T12:00:00Z') })
after(() => mock.timers.reset())
const period = '2026-11-01', owner = 'assessment-owner', other = 'other-owner'
const valid = { weight: '150', height_in: '65', squat_weight: '0', squat_reps: '8' }
const route = await importTs('app/api/assessment-strength/route.ts', {
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.strengthApiFixture.db',
  '@/lib/program/generateProgram': 'export function generateProgram(input){globalThis.strengthApiFixture.generated.push(structuredClone(input));return {program:input.client.program,days:[]}}',
  '@/lib/safety/evaluateSafetyEscalation': 'export function evaluateSafetyEscalation(input){globalThis.strengthApiFixture.safetyInputs.push(structuredClone(input));return globalThis.strengthApiFixture.safetyFlags}',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan=()=>{globalThis.strengthApiFixture.invalidations++}',
})
const { capabilityForPath } = await importTs('lib/membership/policy.ts')
const req = (body, method = 'POST') => new Request('https://assessment.test/api/assessment-strength', { method, body: JSON.stringify(body) })
const envelope = (values = valid, patch = {}) => ({ expectedClientId: 'OWN', period, revision: 0, values, ...patch })
const stamp = '2026-11-15T12:00:00.000Z'

function fixture({ tier = 'ignite', expired = false, signedIn = true, initial = true } = {}) {
  const client = { client_id: 'OWN', auth_user_id: owner, program: tier, timezone: 'Etc/UTC', access: true, active: true, verified_purchase: tier !== 'free', subscription_ends_at: expired ? '2025-01-01' : '2099-01-01' }
  const state = { client, queries: [], rpcCalls: [], generated: [], safetyInputs: [], safetyFlags: [], invalidations: 0, commits: 0, session: null, rpcResult: null, rpcError: null, queryError: null,
    tables: { clients: [client, { ...client, client_id: 'FOREIGN', auth_user_id: other }],
      assessments: initial ? [{ id: 'initial', client_id: 'OWN', auth_user_id: owner, assessment_type: 'initial', data: { saved: 'initial' }, submitted_at: '2026-10-01T12:00:00Z' }] : [],
      client_current_profiles: [{ client_id: 'OWN', user_id: owner, current_weight: 149 }], strength_assessment_sessions: [] } }
  const db = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner, email_confirmed_at: stamp } : null }, error: null }) },
    from(table) {
      const filters = [], record = { table, filters }; state.queries.push(record)
      let sort, limit
      const query = {
        select() { return query }, eq(key,value) { filters.push(['eq',key,value]); return query },
        lt(key,value) { filters.push(['lt',key,value]); return query }, lte(key,value) { filters.push(['lte',key,value]); return query },
        or(value) { filters.push(['or',value]); return query },
        order(key,options = {}) { sort = [key,options.ascending !== false]; return query }, limit(value) { limit = value; return query },
        single: async () => result(true), maybeSingle: async () => result(true), then(resolve) { return Promise.resolve(result(false)).then(resolve) },
        insert() { throw new Error('The API must use one atomic RPC instead of direct inserts') },
        upsert() { throw new Error('The API must use one atomic RPC instead of direct profile writes') },
      }
      function result(single) {
        if (state.queryError === table) return { data: null, error: { message: 'synthetic read failure' } }
        let rows = table === 'strength_assessment_sessions' ? [...state.tables[table], ...(state.session ? [state.session] : [])] : [...state.tables[table]]
        rows = rows.filter(row => filters.every(([kind,key,value]) => {
          if (kind === 'eq') return row[key] === value
          if (kind === 'lt') return row[key] < value
          if (kind === 'lte') return row[key] <= value
          const selectedPeriod = key.match(/assessment_period\.eq\.([^,]+)/)?.[1]
          const start = key.match(/submitted_at\.gte\.([^,]+)/)?.[1]
          const end = key.match(/submitted_at\.lt\.([^\)]+)/)?.[1]
          return row.assessment_period === selectedPeriod || row.assessment_period == null && row.submitted_at >= start && row.submitted_at < end
        }))
        if (sort) { const [key,ascending] = sort; rows.sort((a,b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)) }
        if (limit) rows = rows.slice(0,limit)
        return { data: single ? rows[0] || null : rows, error: null }
      }
      return query
    },
    async rpc(name,args) {
      assert.equal(name,'save_strength_assessment'); state.rpcCalls.push(structuredClone(args))
      if (state.rpcError) return { data: null, error: { message: 'Synthetic atomic failure; private details must not leave the route' } }
      if (state.rpcResult) return { data: state.rpcResult, error: null }
      if (state.session?.status === 'completed') return { data: { success: true, alreadyCompleted: true, assessment: state.session }, error: null }
      state.session = { client_id: args.p_client_id, auth_user_id: owner, period: args.p_period, revision: args.p_expected_revision + 1, status: args.p_complete ? 'completed' : 'draft', values: args.p_values, saved_at: stamp,
        completed_at: args.p_complete ? stamp : null, assessment_id: args.p_complete ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : null }
      if (args.p_complete) state.commits++
      return { data: { success: true, assessment: state.session }, error: null }
    },
  }
  state.db = db; globalThis.strengthApiFixture = state; return state
}
const get = query => route.GET(new Request('https://assessment.test/api/assessment-strength' + (query || '')))

test('assessment reads/writes require authenticated ownership; current canonical membership gates all mutations', async () => {
  fixture({ signedIn: false })
  for (const response of [await get(),await route.PUT(req(envelope(),'PUT')),await route.POST(req(envelope()))]) {
    assert.equal(response.status,401); assert.equal(response.headers.get('cache-control'),'private, no-store')
  }
  for (const options of [{tier:'free'},{tier:'tracker'},{tier:null},{tier:'legacy-unknown'},{expired:true}]) {
    const state = fixture(options)
    assert.equal((await route.PUT(req(envelope(),'PUT'))).status,403)
    assert.equal((await route.POST(req(envelope()))).status,403)
    assert.equal(state.rpcCalls.length,0); assert.equal(state.generated.length,0)
  }
})

test('draft PUT restores incomplete values via owner-bound GET without generating a plan or completing an action', async () => {
  const state = fixture()
  const values = { weight: '', height_in: '65', squat_weight: '12.' }
  const saved = await route.PUT(req(envelope(values),'PUT'))
  assert.equal(saved.status,200); assert.equal(saved.headers.get('cache-control'),'private, no-store')
  assert.equal((await saved.json()).assessment.status,'draft')
  assert.equal(state.generated.length,0); assert.equal(state.invalidations,0); assert.equal(state.commits,0)
  assert.equal(state.rpcCalls.length,1); assert.equal(state.rpcCalls[0].p_complete,false)
  const restored = await (await get()).json()
  assert.deepEqual(restored.assessment.values,values); assert.equal(restored.assessment.revision,1)
  for (const query of state.queries.filter(query => query.table !== 'clients')) {
    assert.ok(query.filters.some(([kind,key,value]) => kind === 'eq' && key === 'client_id' && value === 'OWN'))
    assert.ok(query.filters.some(([kind,key,value]) => kind === 'eq' && key === 'auth_user_id' && value === owner))
  }
})

test('GET preserves owned historical access for Free, Tracker and expired owners, excluding foreign and future records', async () => {
  for (const options of [{tier:'free'},{tier:'tracker'},{expired:true}]) {
    const state = fixture(options)
    state.tables.assessments.push(
      {id:'owned-history',client_id:'OWN',auth_user_id:owner,assessment_type:'strength',assessment_period:null,submitted_at:'2026-10-10T12:00:00Z',data:{weight:'148',email:'excluded@example.test'}},
      {id:'foreign-history',client_id:'FOREIGN',auth_user_id:other,assessment_type:'strength',assessment_period:'2026-10-01',submitted_at:'2026-10-11T12:00:00Z',data:{weight:'999'}},
      {id:'future-history',client_id:'OWN',auth_user_id:owner,assessment_type:'strength',assessment_period:'2026-12-01',submitted_at:'2026-12-11T12:00:00Z',data:{weight:'999'}})
    const response = await get('?assessmentId=owned-history')
    assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'private, no-store')
    const data = await response.json()
    assert.equal(data.assessment.assessmentId,'owned-history'); assert.equal(data.period,'2026-10-01')
    assert.deepEqual(data.assessment.values,{weight:'148'})
    assert.deepEqual(data.history.map(row => row.assessmentId),['owned-history'])
    assert.equal((await get('?assessmentId=foreign-history')).status,404)
    assert.equal(state.rpcCalls.length,0)
  }
  assert.equal(capabilityForPath('/api/assessment-strength','GET'),'accountData')
  assert.equal(capabilityForPath('/api/assessment-strength','POST'),'assessmentsView')
})

test('account changes, invalid months/revisions and invalid value types cannot reach the save RPC', async () => {
  const state = fixture()
  assert.equal((await route.PUT(req(envelope(valid,{expectedClientId:'FOREIGN'}),'PUT'))).status,409)
  for (const patch of [{period:'2026-13-01'},{period:'2026-11-15'},{revision:-1},{revision:'0'},{values:null},{values:[]},{values:{weight:true}}]) assert.equal((await route.PUT(req(envelope(valid,patch),'PUT'))).status,400)
  assert.equal((await get('?period=2026-13-01')).status,400)
  assert.equal(state.rpcCalls.length,0); assert.equal(state.generated.length,0)
})

test('one confirmed atomic completion uses canonical identity, allowlisted values and current generation, with retry authority from the RPC', async () => {
  const state = fixture()
  state.tables.client_current_profiles[0].program='phoenix'
  state.tables.client_current_profiles[0].auth_user_id=other
  const submitted = { ...valid, program:'phoenix', auth_user_id:other, client_id:'FOREIGN', access:true }
  const first = await route.POST(req(envelope(submitted)))
  assert.equal(first.status,200)
  const data = await first.json(); assert.equal(data.assessment.status,'completed'); assert.equal(data.planStatus,'generated')
  assert.equal(state.rpcCalls.length,1); assert.equal(state.commits,1); assert.equal(state.invalidations,1)
  assert.equal(state.generated[0].client.program,'ignite'); assert.equal(state.generated[0].client.auth_user_id,owner)
  assert.deepEqual(state.rpcCalls[0].p_values,valid); assert.equal(state.rpcCalls[0].p_client_id,'OWN')
  assert.equal(state.rpcCalls[0].p_program_json.program,'ignite')
  const retry = await (await route.POST(req(envelope(submitted)))).json()
  assert.equal(retry.planStatus,'existing'); assert.equal(state.commits,1)
})

test('initial-assessment, complete-value and safety checks preserve generation pauses without separate partial writes', async () => {
  let state = fixture({initial:false})
  assert.equal((await route.POST(req(envelope()))).status,409); assert.equal(state.rpcCalls.length,0)
  state = fixture()
  assert.equal((await route.POST(req(envelope({weight:'',height_in:'65'})))).status,400)
  state.safetyFlags = [{urgency:'prompt',label:'Synthetic safety signal'}]
  const response = await (await route.POST(req(envelope()))).json()
  assert.equal(response.success,true); assert.equal(response.planStatus,'safety_paused')
  assert.equal(state.generated.length,0); assert.equal(state.rpcCalls[0].p_program_json,null)
  assert.equal(state.commits,1)
})

test('conflicts, rollover and failed or unconfirmed atomic replies never report completion', async () => {
  const state = fixture()
  state.rpcResult = {success:false,status:409,code:'conflict'}
  assert.equal((await route.PUT(req(envelope(),'PUT'))).status,409)
  state.rpcResult = {success:false,status:409,code:'period_changed',currentPeriod:'2026-12-01'}
  assert.equal((await (await route.PUT(req(envelope(),'PUT'))).json()).currentPeriod,'2026-12-01')
  state.rpcError = true
  let response = await route.POST(req(envelope()))
  assert.equal(response.status,503); assert.doesNotMatch(JSON.stringify(await response.json()),/private details/)
  state.rpcError = null
  for (const assessment of [null,{...state.session,status:'draft',values:valid},{client_id:'FOREIGN',auth_user_id:other,status:'completed',values:valid}]) {
    state.rpcResult = {success:true,assessment}
    response = await route.POST(req(envelope()))
    assert.equal(response.status,503); assert.notEqual((await response.json()).success,true)
  }
  assert.equal(state.invalidations,0); assert.equal(state.commits,0)
})
