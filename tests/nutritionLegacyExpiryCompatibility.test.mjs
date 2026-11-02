import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { createProductionFixture, setFixtureIdentity } from '../scripts/lib/p0-production-fixture.mjs'

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const client='NUTRITION-EXACT',logId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',catalogFoodId='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const future='2099-06-01T17:45:30Z'
const sql=path=>readFileSync(path,'utf8')

test('captured legacy nutrition guards retain tier boundaries while using canonical exact expiry',async t=>{
  const {db}=await createProductionFixture();t.after(()=>db.close())
  for(const name of readdirSync('supabase/migrations').filter(name=>/_p0_.*\.sql$/.test(name)).sort()) await db.exec(sql('supabase/migrations/'+name))
  assert.equal((await db.query("select data_type from information_schema.columns where table_schema='public' and table_name='clients' and column_name='subscription_ends_at'")).rows[0].data_type,'date')
  // Reconstruct the existing guard BEFORE the candidate. Its helper and the
  // Ember macro / Ignite-Phoenix meal / source-specific food predicates match
  // the supplied current pg_catalog receipt. No baseline file is changed.
  await db.exec(sql('docs/sql/pr10-nutrition-entitlement-guard.sql'))
  await db.exec(sql('supabase/migrations/20261101145900_membership_exact_expiry.sql'))
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'nutrition@synthetic.invalid',now()),($2,'other@synthetic.invalid',now())",[owner,other])
  await db.query(`insert into clients(client_id,auth_user_id,email,program,access,active,verified_purchase,membership_expires_at,subscription_ends_at,timezone)
    values($1,$2,'nutrition@synthetic.invalid','ember',true,true,true,$3,null,'America/New_York')`,[client,owner,future])
  await db.query('insert into nutrition_logs(id,client_id,auth_user_id,log_date) values($1,$2,$3,current_date)',[logId,client,owner])
  await db.query("insert into foods(id,name,source) values($1,'Synthetic catalog food','catalog')",[catalogFoodId])
  const permits=async tiers=>(await db.query('select public.member_has_nutrition_access($1,$2::text[]) allowed',[client,tiers])).rows[0].allowed
  const macro=()=>db.query('insert into macro_entries(nutrition_log_id,client_id,auth_user_id,protein_g) values($1,$2,$3,20)',[logId,client,owner])
  const meal=source=>db.query('insert into meal_entries(nutrition_log_id,food_id,meal_name,entry_source,serving_amount,grams) values($1,$2,$3,$4,1,100)',[logId,catalogFoodId,'Synthetic meal',source])
  const food=source=>db.query('insert into foods(name,client_id,auth_user_id,source) values($1,$2,$3,$4)', ['Synthetic food',client,owner,source])
  const policies=async()=>(await db.query("select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and policyname like 'pr10 nutrition authorization %' order by tablename,policyname")).rows
  const capturedPolicies=await policies()
  assert.equal(capturedPolicies.length,24)
  assert.equal(new Set(capturedPolicies.map(row=>row.tablename)).size,8)
  await setFixtureIdentity(db,'authenticated',owner)
  assert.equal(await permits(['ember']),false,'The captured DATE guard rejects a verified exact-expiry purchase with no legacy DATE.')
  await assert.rejects(macro(),/row-level security/)
  await setFixtureIdentity(db,'postgres')
  await db.query("update clients set subscription_ends_at='2020-01-01' where client_id=$1",[client])
  await setFixtureIdentity(db,'authenticated',owner)
  assert.equal(await permits(['ember']),false,'The same captured guard also rejects a stale legacy DATE despite future exact expiry.')
  await setFixtureIdentity(db,'postgres')
  await db.exec(`create schema storage;
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated,anon;`)
  for(const name of ['20261029010729_community_posts_storage.sql','20261029010738_community_operations.sql','20261101160000_membership_capabilities.sql']) await db.exec(sql('supabase/migrations/'+name))

  async function configure(program='ember',exact=future,legacy=null,access=true,active=true){
    await setFixtureIdentity(db,'postgres')
    await db.query('update clients set program=$2,membership_expires_at=$3,subscription_ends_at=$4,access=$5,active=$6,verified_purchase=true where client_id=$1',[client,program,exact,legacy,access,active])
    await setFixtureIdentity(db,'authenticated',owner)
  }

  await t.test('future non-midnight exact expiry repairs real macro/meal/food RLS without rewriting any captured tier policy',async()=>{
    assert.deepEqual(await policies(),capturedPolicies)
    const contract=(await db.query(`select p.prosecdef,p.provolatile,p.proargnames,p.proconfig,
      has_function_privilege('authenticated',p.oid,'execute') member,
      has_function_privilege('anon',p.oid,'execute') anon,
      has_function_privilege('service_role',p.oid,'execute') service,
      has_function_privilege('postgres',p.oid,'execute') owner
      from pg_proc p where p.oid='public.member_has_nutrition_access(text,text[])'::regprocedure`)).rows[0]
    assert.deepEqual(contract,{prosecdef:false,provolatile:'s',proargnames:['p_client_id','p_tiers'],proconfig:['search_path=public, pg_temp'],member:true,anon:false,service:false,owner:true})
    for(const legacy of [null,'2020-01-01']){
      await configure('ember',future,legacy)
      assert.equal(await permits(['ember']),true)
      await macro()
      assert.equal((await db.query('select subscription_ends_at::text legacy from clients where client_id=$1',[client])).rows[0].legacy,legacy,'The migration/helper must not fill or extend legacy DATE data.')
    }
    await assert.rejects(meal('manual'),/row-level security/)
    await assert.rejects(food('custom'),/row-level security/)
    await configure('ignite',future,'2020-01-01')
    assert.equal(await permits(['ignite','phoenix']),true);assert.equal(await permits(['ember']),false)
    await meal('manual');await food('custom')
    await assert.rejects(macro(),/row-level security/)
    await assert.rejects(meal('photo_estimate'),/row-level security/)
    await assert.rejects(food('photo_estimate'),/row-level security/)
    await configure('phoenix',future,null)
    await meal('manual');await food('custom')
    assert.equal(await permits(['phoenix']),true)
    // Preserve the captured source-specific policy permission; this is not a
    // photo-estimation provider implementation or product availability claim.
    await meal('photo_estimate');await food('photo_estimate')
    assert.deepEqual(await policies(),capturedPolicies)
  })

  await t.test('exact boundary, legacy UTC fallback, arrays and canonical owner/tier state all fail closed',async()=>{
    await configure()
    for(const tiers of [null,[],['ignite'],['EMBER'],[null,'ignite']]) assert.equal(await permits(tiers),false)
    for(const [program,access,active,tiers] of [[null,true,true,['ember']],["unknown",true,true,['unknown']],['free',true,true,['free']],['ember',false,true,['ember']],['ember',true,false,['ember']]]){
      await configure(program,future,null,access,active);assert.equal(await permits(tiers),false)
    }
    await configure()
    await setFixtureIdentity(db,'authenticated',other)
    assert.equal(await permits(['ember','ignite','phoenix','tracker']),false)
    await assert.rejects(macro(),/row-level security/)
    await setFixtureIdentity(db,'authenticated','')
    assert.equal(await permits(['ember']),false)
    await setFixtureIdentity(db,'anon')
    await assert.rejects(permits(['ember']),/permission denied/)

    // One transaction freezes now() to test the actual helper at the exact
    // provider boundary, independently of member/database timezone.
    await setFixtureIdentity(db,'postgres');await db.exec("set timezone='America/Los_Angeles'")
    for(const [offset,allowed] of [['1 microsecond',true],['0 microseconds',false],['-1 microsecond',false]]){
      await db.exec('begin')
      await db.query("update clients set program='ember',access=true,active=true,membership_expires_at=now()+$2::interval,subscription_ends_at='2099-12-31' where client_id=$1",[client,offset])
      await setFixtureIdentity(db,'authenticated',owner)
      assert.equal(await permits(['ember']),allowed)
      await db.exec('rollback');await setFixtureIdentity(db,'postgres')
    }
    await configure('ember',null,null)
    assert.equal(await permits(['ember']),false,'Verified paid access cannot infer an unrecorded expiry.')
    await setFixtureIdentity(db,'postgres')
    await db.query("update clients set subscription_ends_at=((now() at time zone 'UTC')::date)+1 where client_id=$1",[client])
    await setFixtureIdentity(db,'authenticated',owner);assert.equal(await permits(['ember']),true)
    await setFixtureIdentity(db,'postgres')
    await db.query("update clients set subscription_ends_at=(now() at time zone 'UTC')::date where client_id=$1",[client])
    await setFixtureIdentity(db,'authenticated',owner);assert.equal(await permits(['ember']),false)
  })

  await t.test('Tracker still uses the owned manual RPC while raw Ember macros and higher-tier meal/food writes remain prohibited',async()=>{
    await configure('tracker',future,'2020-01-01')
    assert.equal(await permits(['ember']),false);assert.equal(await permits(['ignite','phoenix']),false)
    await assert.rejects(macro(),/row-level security/)
    await assert.rejects(meal('manual'),/row-level security/)
    await assert.rejects(food('custom'),/row-level security/)
    const requestId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const record=()=>db.query('select public.record_tracker_nutrition($1,$2,(select log_date from nutrition_logs where id=$3),$4) result',[client,requestId,logId,{protein:20,waterOz:8}]).then(result=>result.rows[0].result)
    const saved=await record(),retry=await record()
    assert.equal(saved.id,retry.id);assert.equal(saved.tracking_only,false,'An existing paid day is retained rather than rewritten as a new tracking day.')
    assert.equal(Number(saved.water_consumed_oz),8);assert.equal(Number(retry.water_consumed_oz),8)
    assert.equal((await db.query('select count(*)::int n from macro_entries where id=$1',[requestId])).rows[0].n,1)
    assert.equal((await db.query("select p.prosecdef from pg_proc p where p.oid='public.record_tracker_nutrition(text,uuid,date,jsonb)'::regprocedure")).rows[0].prosecdef,true)
    await setFixtureIdentity(db,'authenticated',other)
    await assert.rejects(record(),/Active owned membership required/)
    await configure('tracker','2020-01-01T17:45:30Z','2099-12-31')
    await assert.rejects(record(),/Active owned membership required/)
    assert.deepEqual(await policies(),capturedPolicies)
  })
})
