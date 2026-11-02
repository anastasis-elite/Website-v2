import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const policy = await importTs('lib/membership/policy.ts')
const access = await importTs('lib/commerce/access.ts')
const require = createRequire(import.meta.url)
const owner = 'boundary-owner'
const member = (program, changes = {}) => ({ client_id: 'OWN', auth_user_id: owner, program, access: true, active: true, verified_purchase: false, subscription_ends_at: '2099-01-01T00:00:00Z', timezone: 'Etc/UTC', ...changes })
const mocks = {
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.memberBoundaryDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan=()=>{}',
}
const cycleRoutes = await Promise.all(['cycle','cycle/flow','cycle/quick-log','cycle/quick-symptoms','cycle/start-period'].map(path => importTs(`app/api/${path}/route.ts`, mocks)))
const phoenix = await importTs('app/api/phoenix/tasks/route.ts', mocks)
const mobile = await importTs('lib/mobile/auth.ts', { '@supabase/supabase-js': 'export const createClient=()=>globalThis.memberBoundaryDb' })

function database(client = member('phoenix'), signedIn = true) {
  const writes = [], lookups = []
  const user = signedIn ? { id: owner, email_confirmed_at: '2026-01-01T00:00:00Z' } : null
  const db = { writes, lookups, auth: { getUser: async token => ({ data: { user: token && token !== 'valid-token' ? null : user }, error: null }) },
    from(table) {
      const filters = []; let mutation
      const query = { select() { return query }, eq(key,value) { filters.push([key,value]); return query }, in() { return query }, order() { return query }, limit() { return query },
        upsert(value) { mutation = value; return query }, update(value) { mutation = value; return query }, delete() { mutation = { deleted: true }; return query },
        maybeSingle: async () => resolve(true), then(done) { return Promise.resolve(resolve()).then(done) } }
      function resolve(single = false) {
        if (mutation) { writes.push({table,value:mutation,filters}); return { data: null, error: null } }
        if (table === 'clients') { lookups.push(filters); return { data: client && filters.every(([key,value]) => client[key] === value) ? client : null, error: null } }
        return { data: single ? null : [], error: null }
      }
      return query
    },
  }
  globalThis.memberBoundaryDb = db
  return db
}
function middlewareHarness() {
  let calls = 0
  const module = { exports: {} }
  const output = ts.transpileModule(readFileSync('middleware.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const cookies = { getAll: () => [], set() {} }
  const NextResponse = { next: () => ({ kind: 'next', cookies }), json: (body, options) => ({ kind: 'json', body, status: options.status, cookies }), redirect: url => ({ kind: 'redirect', url, cookies }) }
  const modules = { 'next/server': { NextResponse }, '@supabase/ssr': { createServerClient() { calls++; return globalThis.memberBoundaryDb } }, '@/lib/commerce/access': access, '@/lib/membership/policy': policy }
  runInNewContext(output,{module,exports:module.exports,process,require:name=>modules[name]||require(name)})
  return { middleware: module.exports.middleware, config: module.exports.config, get calls() { return calls } }
}
function req(path, method = 'POST', body, bearer) {
  const request = new Request('https://boundary.test'+path,{method,headers:bearer?{Authorization:'Bearer '+bearer}:undefined,body:body===undefined?undefined:JSON.stringify(body)})
  Object.defineProperty(request,'nextUrl',{value:{pathname:new URL(request.url).pathname,searchParams:new URL(request.url).searchParams,clone(){return new URL(request.url)}}})
  Object.defineProperty(request,'cookies',{value:{getAll:()=>[],set(){}}})
  return request
}

test('cycle maps to paid coaching and Phoenix tasks grant only active Phoenix accounts', () => {
  for (const path of ['/api/cycle','/api/cycle/flow','/api/cycle/quick-log','/api/cycle/quick-symptoms','/api/cycle/start-period']) assert.equal(policy.capabilityForPath(path,'POST'),'generatedCoaching')
  assert.equal(policy.capabilityForPath('/api/phoenix/tasks','POST'),'phoenixTasks')
  for (const tier of ['free','tracker','ember','ignite','unknown',null]) assert.equal(policy.membershipCan(member(tier),'phoenixTasks'),false)
  assert.equal(policy.membershipCan(member('phoenix'),'phoenixTasks'),true)
  assert.equal(policy.membershipCan(member('phoenix',{subscription_ends_at:'2020-01-01T00:00:00Z'}),'phoenixTasks'),false)
  assert.equal(policy.membershipCan(member('phoenix',{active:false}),'phoenixTasks'),false)
})

test('only explicit known operations map within protected member prefixes; public and secret jobs remain outside', async () => {
  const known = ['/api/account/profile','/api/account/password','/api/billing/portal','/api/check-access','/api/membership/enroll','/api/tracker/nutrition','/api/workout-log','/api/workout-set-log','/api/program/generate','/api/program/workout','/api/recovery/activity','/api/recovery-log','/api/nutrition','/api/nutrition-log','/api/nutrition/add-water','/api/nutrition/recurring-foods','/api/today-meals','/api/assessment','/api/assessment-strength','/api/assessment-photos/upload','/api/assessment-window/save','/api/schedule/checkoff','/api/schedule/owned-id/complete','/api/onboarding/profile','/api/cycle/flow','/api/phoenix/tasks','/api/calendars/google/callback','/api/calendars/owned-id/sync','/api/daily-check-in','/api/mobile/dashboard','/api/mobile/health/sync','/api/mobile/schedule/owned-id/defer']
  for (const path of known) { assert.equal(policy.isProtectedApiPath(path),true,path); assert.notEqual(policy.capabilityForPath(path),null,path) }
  const view = middlewareHarness()
  for (const path of ['/api/auth/login','/api/auth/free-signup','/api/checkout','/api/stripe/webhook','/api/commerce/invitations/cron']) {
    assert.equal(policy.isProtectedApiPath(path),false,path)
    assert.equal((await view.middleware(req(path))).kind,'next')
  }
  assert.equal((await view.middleware(req('/api/calendars/cron','GET'))).kind,'next')
  assert.equal(view.calls,0,'Public and independently authenticated jobs must not initialize member cookie auth')
  for (const prefix of ['/api/phoenix/:path*','/api/mobile/:path*','/api/account/:path*','/api/billing/:path*','/api/assessment-window/:path*']) assert.ok(view.config.matcher.includes(prefix))
})

test('unmapped protected APIs deny even Phoenix members before any cookie or database lookup', async () => {
  database()
  const view = middlewareHarness()
  for (const path of ['/api/cycle/new-operation','/api/phoenix/tasks/new-operation','/api/account/admin','/api/billing/private-state','/api/program/new-operation','/api/nutrition/new-operation','/api/mobile/unknown','/api/mobile/health/unknown']) {
    assert.equal(policy.isProtectedApiPath(path),true)
    assert.equal(policy.capabilityForPath(path),null)
    assert.equal((await view.middleware(req(path))).status,403,path)
  }
  assert.equal(view.calls,0)
})

test('middleware enforces task/cycle capabilities and preserves expired owner account, billing and history paths', async () => {
  const view = middlewareHarness()
  for (const tier of ['free','tracker','ember','ignite','unknown']) {
    database(member(tier))
    assert.equal((await view.middleware(req('/api/phoenix/tasks'))).status,403,tier)
  }
  for (const tier of ['free','tracker','unknown']) {
    database(member(tier))
    assert.equal((await view.middleware(req('/api/cycle'))).status,403,tier)
  }
  database(member('phoenix')); assert.equal((await view.middleware(req('/api/phoenix/tasks'))).kind,'next')
  database(member('ember')); assert.equal((await view.middleware(req('/api/cycle'))).kind,'next')
  database(member('phoenix',{subscription_ends_at:'2020-01-01T00:00:00Z'}))
  for (const [path,method] of [['/api/account/profile','POST'],['/api/account/password','POST'],['/api/billing/portal','POST'],['/api/workout-log','GET'],['/api/nutrition-log','HEAD'],['/api/tracker/nutrition','GET']]) assert.equal((await view.middleware(req(path,method))).kind,'next',path)
  assert.equal((await view.middleware(req('/api/phoenix/tasks'))).status,403)
})

test('actual cycle handlers deny Free/Tracker/unknown/expired clients before writes and retain paid owner behavior', async () => {
  for (const tier of ['free','tracker','unknown']) {
    const db = database(member(tier))
    for (const route of cycleRoutes) assert.equal((await route.POST(req('/api/cycle','POST',{client_id:'OWN',clientId:'OWN',action:'period_started_today',program:'phoenix'}))).status,403,tier)
    assert.equal(db.writes.length,0)
  }
  const expired = database(member('ignite',{subscription_ends_at:'2020-01-01T00:00:00Z'}))
  assert.equal((await cycleRoutes[3].POST(req('/api/cycle/quick-symptoms','POST',{client_id:'OWN'}))).status,403)
  assert.equal(expired.writes.length,0)
  for (const tier of ['ember','ignite','phoenix']) {
    const db = database(member(tier))
    assert.equal((await cycleRoutes[3].POST(req('/api/cycle/quick-symptoms','POST',{client_id:'OWN',symptoms:{}}))).status,200,tier)
    assert.equal(db.writes[0].table,'cycle_logs')
  }
  database(member('phoenix')); assert.equal((await cycleRoutes[3].POST(req('/api/cycle/quick-symptoms','POST',{client_id:'FOREIGN'}))).status,404)
})

test('actual Phoenix task completion and undo require active Phoenix ownership regardless of body tier', async () => {
  const body={clientId:'OWN',taskId:'midday-movement',program:'phoenix'}
  for (const tier of ['free','tracker','ember','ignite','unknown']) {
    const db=database(member(tier)); assert.equal((await phoenix.POST(req('/api/phoenix/tasks','POST',body))).status,403,tier); assert.equal(db.writes.length,0)
  }
  const expired=database(member('phoenix',{subscription_ends_at:'2020-01-01T00:00:00Z'})); assert.equal((await phoenix.POST(req('/api/phoenix/tasks','POST',body))).status,403); assert.equal(expired.writes.length,0)
  const db=database(member('phoenix'))
  assert.equal((await phoenix.POST(req('/api/phoenix/tasks','POST',body))).status,200)
  assert.equal((await phoenix.POST(req('/api/phoenix/tasks','POST',{...body,completed:false}))).status,200)
  assert.equal(db.writes.length,2)
  assert.equal((await phoenix.POST(req('/api/phoenix/tasks','POST',{...body,clientId:'FOREIGN'}))).status,404)
})

test('known mobile bearer paths retain direct token authorization and unknown paths never inherit paid coaching', async () => {
  const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,previousKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://synthetic.test'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='synthetic-public-key'
  try {
    database(member('tracker')); const view=middlewareHarness()
    assert.equal((await view.middleware(req('/api/mobile/health/sync','POST',undefined,'valid-token'))).kind,'next')
    assert.equal(view.calls,0)
    assert.equal((await mobile.createMobileRequestContext(req('/api/mobile/health/sync','POST',undefined,'valid-token'))).client.program,'tracker')
    assert.equal((await mobile.createMobileRequestContext(req('/api/mobile/health/sync','POST',undefined,'invalid-token'))).status,401)
    assert.equal((await mobile.createMobileRequestContext(req('/api/mobile/actions/water','POST',undefined,'valid-token'))).status,403)
    database(member('free')); assert.equal((await mobile.createMobileRequestContext(req('/api/mobile/health/sync','POST',undefined,'valid-token'))).status,403)
    database(member('phoenix')); assert.equal((await mobile.createMobileRequestContext(req('/api/mobile/new-operation','POST',undefined,'valid-token'))).status,403)
  } finally {
    if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl
    if(previousKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=previousKey
  }
})

test('historical strength UI allows only authenticated known-tier owner GETs with a valid selection and never opens write gates', async () => {
  const view = middlewareHarness()
  const selections = ['?period=2026-10-01','?assessmentId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','?period=2026-10-01&assessmentId=legacy-strength-id']
  for (const tier of ['free','tracker','ember','ignite','phoenix']) {
    const db = database(member(tier,{access:false,active:false,subscription_ends_at:'2020-01-01T00:00:00Z'}))
    for (const selection of selections) {
      const request = req('/dashboard/assessment/start2'+selection,'GET')
      assert.equal(policy.capabilityForPath(request.nextUrl.pathname,'GET',request.nextUrl.searchParams),'accountData')
      assert.equal((await view.middleware(request)).kind,'next',tier+selection)
    }
    assert.ok(db.lookups.every(filters => filters.some(([key,value]) => key==='auth_user_id'&&value===owner)))
    for (const selection of ['', '?period=2026-13-01','?assessmentId=bad%20id','?period=bad&assessmentId=valid-id']) assert.equal((await view.middleware(req('/dashboard/assessment/start2'+selection,'GET'))).kind,'redirect')
    assert.equal((await view.middleware(req('/dashboard/assessment/start?period=2026-10-01','GET'))).kind,'redirect')
    assert.equal((await view.middleware(req('/dashboard/assessment/start2?period=2026-10-01','POST'))).kind,'redirect')
    for (const method of ['PUT','POST']) assert.equal((await view.middleware(req('/api/assessment-strength',method))).status,403)
  }
  database(member('unknown',{access:false,active:false}))
  assert.equal((await view.middleware(req('/dashboard/assessment/start2?period=2026-10-01','GET'))).kind,'redirect')
  database(member('ignite'),false)
  assert.equal((await view.middleware(req('/dashboard/assessment/start2?period=2026-10-01','GET'))).url.pathname,'/login')
})

test('membership experience history remains owner-authenticated after expiry while unknown experience paths deny',async()=>{
  const view=middlewareHarness()
  for(const tier of ['free','tracker','ember','ignite','phoenix']){
    const db=database(member(tier,{access:false,active:false,subscription_ends_at:'2020-01-01T00:00:00Z'}))
    assert.equal((await view.middleware(req('/dashboard/experience','GET'))).kind,'next')
    assert.equal((await view.middleware(req('/api/membership/experience','GET'))).kind,'next')
    assert.ok(db.lookups.every(filters=>filters.some(([key,value])=>key==='auth_user_id'&&value===owner)))
  }
  database(member('legacy-unknown'));assert.equal((await view.middleware(req('/dashboard/experience','GET'))).kind,'redirect')
  database(member('ignite'),false);assert.equal((await view.middleware(req('/dashboard/experience','GET'))).url.pathname,'/login')
  assert.equal((await view.middleware(req('/api/membership/experience/admin','POST'))).status,403)
})
