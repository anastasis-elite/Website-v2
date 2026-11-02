import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'
import { createProductionFixture, setFixtureIdentity } from '../scripts/lib/p0-production-fixture.mjs'
import { PGlite } from '@electric-sql/pglite'

const policy = await importTs('lib/membership/policy.ts')
const entitlements = await importTs('lib/entitlements.ts')
const now = new Date('2026-11-01T12:00:00Z')
const member = program => ({ client_id: 'OWN', program, access: true, active: true, verified_purchase: true, subscription_ends_at: '2099-01-01' })

async function membershipSqlFixture(community = 'all') {
  const fixture = await createProductionFixture()
  const { db } = fixture
  const migrations = readdirSync('supabase/migrations')
  for (const name of migrations.filter(name => /_p0_.*\.sql$/.test(name)).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'))
  for (const name of ['20261101145900_membership_exact_expiry.sql','20261101150000_launch_commerce_foundation.sql']) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'))
  if (community !== 'none') {
    await db.exec(`create schema storage;
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,metadata jsonb,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon;
      grant select,insert,update,delete on storage.objects to authenticated,anon;`)
    await db.exec(readFileSync('supabase/migrations/20261029010729_community_posts_storage.sql','utf8'))
    if (community === 'all') await db.exec(readFileSync('supabase/migrations/20261029010738_community_operations.sql','utf8'))
  }
  return fixture
}

test('central membership denies unknown grants and separates Community, tracking, paid coaching and unavailable features', () => {
  for (const program of [null, '', 'admin', 'unknown']) {
    assert.equal(policy.parseMembershipTier(program), null)
    assert.equal(policy.membershipCan(member(program), 'workoutLogging', now), false)
    assert.equal(entitlements.getTierCapabilities(program).workoutDisplay, false)
  }
  assert.throws(() => entitlements.normalizeProgramTier('admin'))
  assert.equal(policy.membershipCan(member('free'), 'community', now), true)
  assert.equal(policy.membershipCan(member('free'), 'workoutLogging', now), false)
  for (const capability of ['workoutLogging','nutritionTracking','nutritionMacroEntry','recoveryBasic','healthRecords']) assert.equal(policy.membershipCan(member('tracker'), capability, now), true)
  for (const capability of ['generatedCoaching','calendar','nutritionMicronutrients','nutritionRecommendedMeal','postureAssessment']) assert.equal(policy.membershipCan(member('tracker'), capability, now), false)
  for (const tier of ['ember','ignite','phoenix']) {
    for (const capability of ['calendar','generatedCoaching','workoutLogging','recoveryBasic','assessmentsView']) assert.equal(policy.membershipCan(member(tier), capability, now), true)
    assert.equal(policy.membershipCan(member(tier), 'nutritionPhotoMacroEstimation', now), false)
  }
  assert.equal(policy.membershipCan(member('ember'), 'nutritionMacroEntry', now), true)
  assert.equal(policy.membershipCan(member('ember'), 'nutritionMealLogging', now), false)
  assert.equal(policy.membershipCan(member('ignite'), 'nutritionMealLogging', now), true)
  assert.equal(policy.membershipCan(member('ignite'), 'nutritionRecommendedMeal', now), false)
  assert.equal(policy.membershipCan(member('phoenix'), 'nutritionRecommendedMeal', now), true)
  const expired = { ...member('phoenix'), subscription_ends_at: '2025-01-01' }
  assert.equal(policy.membershipCan(expired, 'workoutLogging', now), false)
  assert.equal(policy.membershipCan(expired, 'accountData', now), true)
  assert.equal(policy.capabilityForPath('/api/mobile/health/sync', 'POST'), 'healthRecords')
  assert.equal(policy.capabilityForPath('/api/program/workout', 'POST'), 'generatedCoaching')
})

const mocks = {
  'next/server': 'export const NextResponse={json:(data,options)=>Response.json(data,options)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.membershipDb',
}
const checkAccess = await importTs('app/api/check-access/route.ts', mocks)
const enroll = await importTs('app/api/membership/enroll/route.ts', mocks)
const request = (body, path='/api/check-access') => new Request(`https://member.test${path}`, { method: 'POST', body: JSON.stringify(body) })

test('legacy access route uses verified session owner and canonical expiry instead of caller email or stale flags', async () => {
  let user = null, client = member('ember')
  const filters = []
  globalThis.membershipDb = { auth: { getUser: async () => ({ data: { user } }) }, from() { return { select() { return this }, eq(key,value) { filters.push([key,value]); return this }, maybeSingle: async () => ({ data: client }) } } }
  assert.equal((await checkAccess.POST(request({ email: 'target@example.test' }))).status, 401)
  user = { id: 'owner', email: 'owner@example.test', email_confirmed_at: '2026-01-01' }
  assert.equal((await checkAccess.POST(request({ email: 'target@example.test' }))).status, 403)
  assert.equal((await checkAccess.POST(request({ client_id: 'FOREIGN' }))).status, 403)
  client = { ...client, access: true, verified_purchase: true, subscription_ends_at: '2025-01-01' }
  const response = await (await checkAccess.POST(request({ client_id: 'OWN', program: 'phoenix' }))).json()
  assert.equal(response.access, false)
  assert.equal(response.program, 'ember')
  assert.equal(response.email, undefined)
  assert.ok(filters.every(([key,value]) => key === 'auth_user_id' && value === 'owner'))
})

test('free enrollment requires verified session and accepts profile name without caller entitlements', async () => {
  let confirmed = false, calls = 0
  globalThis.membershipDb = { auth: { getUser: async () => ({ data: { user: { id: 'owner', email_confirmed_at: confirmed ? '2026-01-01' : null } } }) }, rpc: async (name,args) => { calls++; assert.equal(name,'enroll_free_community'); assert.deepEqual(args,{p_full_name:'Owner'}); return {data:{client_id:'COMM-owner'}} } }
  assert.equal((await enroll.POST(request({ fullName: 'Owner' }, '/api/membership/enroll'))).status, 403)
  confirmed = true
  assert.equal((await enroll.POST(request({ fullName: 'Owner', program: 'phoenix', access: true }, '/api/membership/enroll'))).status, 400)
  assert.equal((await enroll.POST(request({ fullName: 'Owner' }, '/api/membership/enroll'))).status, 200)
  assert.equal(calls, 1)
})

test('route policy preserves owner history while distinguishing neutral Tracker entries from generated targets', () => {
  assert.equal(policy.capabilityForPath('/api/nutrition-log','GET'),'accountData')
  assert.equal(policy.capabilityForPath('/api/nutrition-log','POST'),'generatedCoaching')
  assert.equal(policy.capabilityForPath('/api/nutrition','GET'),'generatedCoaching')
  assert.equal(policy.capabilityForPath('/api/tracker/nutrition','POST'),'nutritionTracking')
  assert.equal(policy.capabilityForPath('/api/mobile/dashboard','GET'),'generatedCoaching')
})

test('prepared SQL enforces direct owner capabilities, Free enrollment and atomic Tracker actual-intake retries on captured schema', async t => {
  const { db } = await membershipSqlFixture(); t.after(() => db.close())
  await db.exec(readFileSync('supabase/migrations/20261101160000_membership_capabilities.sql','utf8'))
  const owners = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444']
  await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'free@example.test',now()),($2,'tracker@example.test',now()),($3,'pending@example.test',null),($4,'paid@example.test',now())`, owners)
  await db.query(`insert into clients(client_id,auth_user_id,email,program,access,active,verified_purchase,subscription_ends_at) values('TRACKER',$1,'tracker@example.test','tracker',true,true,true,'2099-01-01'),('PAID',$2,'paid@example.test','ignite',true,true,true,'2099-01-01')`,[owners[1],owners[3]])
  await setFixtureIdentity(db,'authenticated',owners[0])
  const first = (await db.query("select public.enroll_free_community('Owner') result")).rows[0].result
  assert.equal((await db.query("select public.enroll_free_community('Retry') result")).rows[0].result.client_id,first.client_id)
  assert.equal((await db.query('select public.member_has_capability($1,\'community\') allowed',[first.client_id])).rows[0].allowed,true)
  assert.equal((await db.query('select public.member_has_capability($1,\'generatedCoaching\') allowed',[first.client_id])).rows[0].allowed,false)
  await assert.rejects(db.query("update clients set program='phoenix' where client_id=$1",[first.client_id]),/entitlement/)
  await assert.rejects(db.query("insert into nutrition_logs(client_id,auth_user_id,log_date) values($1,$2,current_date)",[first.client_id,owners[0]]),/row-level security/)
  await setFixtureIdentity(db,'authenticated',owners[2])
  await assert.rejects(db.query("select public.enroll_free_community('Unverified')"),/Verified/)
  await setFixtureIdentity(db,'authenticated',owners[1])
  const key='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const record = values => db.query('select public.record_tracker_nutrition($1,$2,current_date,$3) result',['TRACKER',key,values])
  const saved=(await record({protein:20,waterOz:8})).rows[0].result
  assert.equal(saved.tracking_only,true); assert.equal(Number(saved.water_oz),0); assert.equal(Number(saved.water_consumed_oz),8)
  const retried=(await record({protein:20,waterOz:8})).rows[0].result
  assert.equal(retried.id,saved.id); assert.equal(Number(retried.water_consumed_oz),8)
  assert.equal((await db.query('select count(*)::int n from macro_entries where nutrition_log_id=$1',[saved.id])).rows[0].n,1)
  await assert.rejects(record({protein:21,waterOz:8}),/identifier/)
  await assert.rejects(db.query('select public.record_tracker_nutrition($1,$2,current_date,$3)',['PAID',key,{protein:20}]),/membership/)
  await assert.rejects(db.query("insert into program_outputs(client_id,auth_user_id,program,program_json) values('TRACKER',$1,'tracker','{}')",[owners[1]]),/row-level security/)
  await assert.rejects(db.query("insert into workout_logs(client_id,auth_user_id,program,workout_source) values('TRACKER',$1,'tracker','recommended')",[owners[1]]),/row-level security/)
  await setFixtureIdentity(db,'postgres')
  await db.query("update clients set subscription_ends_at='2025-01-01' where client_id='TRACKER'")
  await setFixtureIdentity(db,'authenticated',owners[1])
  assert.equal((await db.query("select public.member_has_capability('TRACKER','nutritionTracking') allowed")).rows[0].allowed,false)
  assert.equal((await db.query('select count(*)::int n from nutrition_logs where id=$1',[saved.id])).rows[0].n,1,'Expired owners retain saved history')
  await assert.rejects(record({protein:20,waterOz:8}),/membership/)
})

test('NULL-tier and unknown-tier profiles fail closed, with cycle and Phoenix task writes confined to eligible memberships', async t => {
  const { db } = await membershipSqlFixture(); t.after(() => db.close())
  await db.exec(readFileSync('supabase/migrations/20261101160000_membership_capabilities.sql','utf8'))
  const profiles = [
    ['LEGACY-NULL','10000000-0000-4000-8000-000000000001',null],
    ['LEGACY-UNKNOWN','10000000-0000-4000-8000-000000000002','legacy-unknown'],
    ['VALID-FREE','10000000-0000-4000-8000-000000000003','free'],
    ['VALID-TRACKER','10000000-0000-4000-8000-000000000004','tracker'],
    ['VALID-PAID','10000000-0000-4000-8000-000000000005','ignite'],
    ['VALID-EMBER','10000000-0000-4000-8000-000000000006','ember'],
    ['VALID-PHOENIX','10000000-0000-4000-8000-000000000007','phoenix'],
    ['EXPIRED-PHOENIX','10000000-0000-4000-8000-000000000008','phoenix'],
  ]
  for (const [clientId,owner,tier] of profiles) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[owner,`${clientId.toLowerCase()}@example.test`])
    await db.query(`insert into clients(client_id,auth_user_id,email,program,access,active,verified_purchase,subscription_ends_at)
      values($1,$2,$3,$4,true,true,true,$5)`,[clientId,owner,`${clientId.toLowerCase()}@example.test`,tier,clientId === 'EXPIRED-PHOENIX' ? '2025-01-01' : '2099-01-01'])
  }
  const capabilities = ['accountData','community','workoutLogging','workoutDisplay','generatedCoaching','healthRecords','nutritionTracking','nutritionMacroEntry','nutritionMealLogging','nutritionRecommendedMeal','calendar','recoveryBasic','assessmentsView','phoenixTasks',null,'unknown-capability']
  for (const [clientId,owner] of profiles.slice(0,2)) {
    await setFixtureIdentity(db,'authenticated',owner)
    const checks = await db.query('select capability,public.member_has_capability($1,capability) allowed from unnest($2::text[]) capability',[clientId,capabilities])
    assert.equal(checks.rows.length,capabilities.length)
    assert.ok(checks.rows.every(row => row.allowed === false),'Legacy NULL/unknown tiers must return false, never NULL or a grant')
    await assert.rejects(db.query('select public.enroll_free_community($1)',['Preserve legacy profile']),/membership tier requires review/)
    await assert.rejects(db.query('select public.record_tracker_nutrition($1,$2,current_date,$3)',[clientId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',{protein:20,waterOz:8}]),/Active owned membership required/)
  }
  for (const [clientId,owner,tier] of profiles.slice(2,-1)) {
    await setFixtureIdentity(db,'authenticated',owner)
    assert.equal((await db.query('select public.member_has_capability($1,$2) allowed',[clientId,tier === 'free' ? 'community' : tier === 'tracker' ? 'nutritionTracking' : 'generatedCoaching'])).rows[0].allowed,true)
    assert.equal((await db.query('select public.member_has_capability($1,null) allowed',[clientId])).rows[0].allowed,false)
    assert.equal((await db.query('select public.member_has_capability(null,$1) allowed',['community'])).rows[0].allowed,false)
    assert.equal((await db.query('select public.enroll_free_community($1) result',['Existing verified profile'])).rows[0].result.client_id,clientId)
  }
  for (const [clientId,owner,tier] of profiles) {
    await setFixtureIdentity(db,'authenticated',owner)
    const eligibleCycle = ['ember','ignite','phoenix'].includes(tier) && clientId !== 'EXPIRED-PHOENIX'
    const eligibleTasks = tier === 'phoenix' && clientId !== 'EXPIRED-PHOENIX'
    assert.equal((await db.query('select public.member_has_capability($1,\'phoenixTasks\') allowed',[clientId])).rows[0].allowed,eligibleTasks)
    const cycle = () => db.query('insert into cycle_logs(client_id,auth_user_id,log_date) values($1,$2,current_date)',[clientId,owner])
    const tasks = () => db.query('insert into phoenix_daily_task_completions(client_id,user_id,log_date,task_id) values($1,$2,current_date,\'check-in\')',[clientId,owner])
    if (eligibleCycle) await cycle(); else await assert.rejects(cycle(),/row-level security/)
    if (eligibleTasks) await tasks(); else await assert.rejects(tasks(),/row-level security/)
  }
  await setFixtureIdentity(db,'postgres')
  assert.equal((await db.query('select count(*)::int n from nutrition_logs')).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int n from macro_entries')).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int n from membership_private.tracker_submission_receipts')).rows[0].n,0)
  assert.deepEqual((await db.query("select program from clients where client_id in ('LEGACY-NULL','LEGACY-UNKNOWN') order by client_id")).rows.map(row => row.program),[null,'legacy-unknown'])
  assert.equal((await db.query('select count(*)::int n from clients')).rows[0].n,profiles.length,'Enrollment must not create or relabel legacy profiles')
})

test('membership migration fails explicitly before changes when Community foundation or operations are missing', async t => {
  const migration = readFileSync('supabase/migrations/20261101160000_membership_capabilities.sql','utf8')
  const missingFoundation = new PGlite(); t.after(() => missingFoundation.close())
  await assert.rejects(missingFoundation.exec(migration),/Community foundation and operations must be installed/)
  await missingFoundation.exec('rollback')
  assert.equal((await missingFoundation.query("select to_regnamespace('membership_private') present")).rows[0].present,null)
  const { db } = await membershipSqlFixture('foundation'); t.after(() => db.close())
  const installedObjects = () => db.query("select to_regprocedure('public.member_has_capability(text,text)') capability, to_regprocedure('public.enroll_free_community(text)') enrollment, to_regclass('membership_private.tracker_submission_receipts') receipts")
  const before = (await installedObjects()).rows
  await assert.rejects(db.exec(migration),/Community foundation and operations must be installed/)
  await db.exec('rollback')
  assert.deepEqual((await installedObjects()).rows,before,'Missing operations must leave existing expiry helpers intact and install no membership grants')
})
