import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const sql=readFileSync('docs/sql/apple-health-export-review.sql','utf8')
const record={metric:'heart_rate',value:72,unit:'count/min',startAt:'2026-11-01T05:30:00.000Z',endAt:'2026-11-01T05:30:00.000Z',creationAt:'2026-11-01T07:00:00.000Z',sourceName:'Synthetic Watch',sourceVersion:'1',sourceDevice:'Synthetic device'}

test('prepared review-only export schema enforces owner, entitlement, server identity and atomic retries in disposable PostgreSQL',async t=>{
  const db=new PGlite();t.after(()=>db.close())
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table public.clients(client_id text primary key,auth_user_id uuid references auth.users(id),program text,access boolean,active boolean,verified_purchase boolean,subscription_ends_at date);
    alter table public.clients enable row level security;
    create policy owned_client on public.clients for select to authenticated using(auth_user_id=auth.uid());
    grant select on public.clients to authenticated;
    insert into auth.users values('${owner}',now()),('${other}',now());
    insert into clients values('OWN','${owner}','ignite',true,true,true,null),('OTHER','${other}','tracker',true,true,true,null);
    create table public.health_samples(id integer primary key,metric_type text,value numeric);insert into public.health_samples values(1,'resting_heart_rate',61);
    create table public.daily_health_metrics(id integer primary key,metric_type text,value numeric);insert into public.daily_health_metrics values(1,'resting_heart_rate',61);
    create table public.health_integrations(id integer primary key,provider_sync_state jsonb);insert into public.health_integrations values(1,'{"cursor":"preserved"}');
  `)
  await db.exec(readFileSync('supabase/migrations/20261101145900_membership_exact_expiry.sql','utf8'))
  await db.exec("update clients set membership_expires_at='2099-01-01T00:00:00Z'")
  const capabilities=readFileSync('supabase/migrations/20261101160000_membership_capabilities.sql','utf8')
  // Install the actual existing canonical helper, not a permissive replacement.
  await db.exec(capabilities.slice(capabilities.indexOf('create or replace function membership_private.has_capability'),capabilities.indexOf('-- Existing nutrition')))
  await db.exec(sql)
  const identity=async(id=owner,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}
  const admin=()=>identity('','postgres')
  const configure=async({program='ignite',expiry='2099-01-01T00:00:00Z',access=true,active=true,confirmed=true}={})=>{
    await admin();await db.query('update clients set program=$1,membership_expires_at=$2,access=$3,active=$4 where client_id=$5',[program,expiry,access,active,'OWN']);await db.query('update auth.users set email_confirmed_at=case when $1 then now() else null end where id=$2',[confirmed,owner]);await identity()
  }
  const detailed=(records=[record],day='2026-11-01',zone='America/New_York',client='OWN')=>db.query('select public.import_health_export_review_batch($1,$2::date,$3,$4::jsonb) result',[client,day,zone,JSON.stringify(records)]).then(result=>result.rows[0].result)
  const call=(...args)=>detailed(...args).then(({imported,alreadyPresent})=>({imported,alreadyPresent}))
  const read=(day='2026-11-01',zone='America/New_York',offset=0,client='OWN')=>db.query('select public.get_health_export_review_day($1,$2::date,$3,$4) result',[client,day,zone,offset]).then(result=>result.rows[0].result)
  const count=()=>db.query('select count(*)::integer n from public.health_export_review_samples').then(result=>result.rows[0].n)

  await t.test('invoker grants, table ownership and append-only review partition are explicit',async()=>{
    const grants=(await db.query(`select has_table_privilege('authenticated','public.health_export_review_samples','select') as can_read,
      has_table_privilege('authenticated','public.health_export_review_samples','insert') as can_insert,
      has_table_privilege('authenticated','public.health_export_review_samples','update') as can_update,
      has_table_privilege('authenticated','public.health_export_review_samples','delete') as can_delete,
      has_table_privilege('anon','public.health_export_review_samples','select') as anon_read,
      has_function_privilege('anon','public.import_health_export_review_batch(text,date,text,jsonb)','execute') as anon_import`)).rows[0]
    assert.deepEqual(grants,{can_read:true,can_insert:true,can_update:false,can_delete:false,anon_read:false,anon_import:false})
    const functions=(await db.query("select proname,prosecdef from pg_proc where pronamespace='public'::regnamespace and proname in ('import_health_export_review_batch','get_health_export_review_day','guard_health_export_review_sample') order by proname")).rows
    assert.ok(functions.every(row=>row.prosecdef===false));assert.equal(functions.length,3)
    await identity();assert.deepEqual(await call(),{imported:1,alreadyPresent:0})
    const row=(await db.query('select provider,provenance,review_only,dedupe_key from public.health_export_review_samples')).rows[0]
    assert.deepEqual({provider:row.provider,provenance:row.provenance,review_only:row.review_only},{provider:'apple_health_export',provenance:'Apple Health export; user imported',review_only:true})
    assert.match(row.dedupe_key,/^[0-9a-f]{64}$/)
    await assert.rejects(db.exec('update public.health_export_review_samples set value=10'),/permission denied/)
    await assert.rejects(db.exec('delete from public.health_export_review_samples'),/permission denied/)
  })

  await t.test('same source fields reimport once across retries, formatting, database timezones and preview zones while distinct samples survive',async()=>{
    assert.deepEqual(await call(),{imported:0,alreadyPresent:1})
    await db.exec("set timezone='Asia/Tokyo'")
    assert.deepEqual(await call([record],'2026-11-01','UTC'),{imported:0,alreadyPresent:1})
    const variants=[{...record,startAt:'2026-11-01T06:30:00.000Z',endAt:'2026-11-01T06:30:00.000Z'},
      {...record,sourceName:'Second synthetic watch'},{...record,creationAt:'2026-11-01T08:00:00.000Z'},{...record,metric:'resting_heart_rate'}]
    assert.deepEqual(await call(variants),{imported:4,alreadyPresent:0});assert.equal(await count(),5)
    const next={...record,startAt:'2026-11-01T08:30:00.000Z',endAt:'2026-11-01T08:30:00.000Z'}
    assert.deepEqual(await call([next,next]),{imported:1,alreadyPresent:1})
    const replay=(await db.query(`insert into public.health_export_review_samples(user_id,client_id,metric_type,value,unit,start_at,end_at,creation_at,source_name,source_version,source_device,selected_date,selected_timezone)
      select user_id,client_id,metric_type,value*1.00,unit,start_at,end_at,creation_at,source_name,source_version,source_device,selected_date,'UTC'
      from public.health_export_review_samples on conflict(user_id,dedupe_key) do nothing returning id`)).rows
    assert.equal(replay.length,0);assert.equal(await count(),6)
  })

  await t.test('confirmed per-batch receipts survive reload and exact retry without replacing original counts or storing record JSON',async()=>{
    const first=(await read()).receipts.find(item=>item.inputCount===1&&item.imported===1)
    assert.ok(first);const before=(await db.query('select count(*)::integer n from health_export_private.review_batches')).rows[0].n
    const replay=await detailed();assert.equal(replay.imported,0);assert.equal(replay.alreadyPresent,1);assert.equal(replay.replayed,true)
    assert.equal(replay.receipt.id,first.id);assert.equal(replay.receipt.imported,1);assert.equal(replay.receipt.alreadyPresent,0)
    assert.equal((await db.query('select count(*)::integer n from health_export_private.review_batches')).rows[0].n,before)
    const after=(await read()).receipts.find(item=>item.id===first.id);assert.deepEqual(after,first)
    await assert.rejects(db.exec('update health_export_private.review_batches set imported_count=0'),/permission denied/)
    const columns=(await db.query("select column_name from information_schema.columns where table_schema='health_export_private' and table_name='review_batches'")).rows.map(item=>item.column_name)
    assert.ok(!columns.some(name=>/records|xml|payload|metadata/.test(name)))
    assert.doesNotMatch(sql,/create table public\.review_batches/)
    assert.match(sql,/schema must remain unexposed/i)
  })

  await t.test('direct Data API writes cannot spoof owner, client, native provenance, dedupe key or review-only state',async()=>{
    const insert=patch=>db.query(`insert into public.health_export_review_samples(user_id,client_id,metric_type,value,unit,start_at,end_at,creation_at,source_name,source_version,source_device,selected_date,selected_timezone,provider,provenance,review_only,dedupe_key)
      values($1,$2,'heart_rate',72,'count/min',$3,$3,null,'Synthetic direct source','','','2026-11-01','America/New_York',$4,$5,$6,$7)`,
      [patch.user||owner,patch.client||'OWN','2026-11-01T12:00:00Z',patch.provider||'apple_health_export',patch.provenance||'Apple Health export; user imported',patch.review??true,patch.key??null])
    const before=await count()
    for(const patch of [{user:other},{client:'OTHER'},{provider:'apple_health'},{provenance:'Verified wearable'},{review:false},{key:'a'.repeat(64)}]) await assert.rejects(insert(patch),/required|server-derived/)
    assert.equal(await count(),before)
    await identity(other);assert.equal(await count(),0)
    await assert.rejects(call([record],'2026-11-01','America/New_York','OWN'),/required/)
    assert.deepEqual(await call([record],'2026-11-01','America/New_York','OTHER'),{imported:1,alreadyPresent:0},'Existing Tracker healthRecords capability remains permitted.')
    await identity();assert.equal(await count(),before)
  })

  await t.test('canonical capability rejects Free, unknown, NULL, expired, disabled and unverified memberships for direct reads and writes',async()=>{
    for(const options of [{program:'free'},{program:'unknown'},{program:null},{expiry:'2020-01-01T00:00:00Z'},{access:false},{active:false},{confirmed:false}]){
      await configure(options);assert.equal(await count(),0);await assert.rejects(call(),/required/);await assert.rejects(read(),/required/)
    }
    await configure({program:'tracker'});assert.ok((await read()).total>0)
    await configure();await identity('','anon');await assert.rejects(call(),/permission denied/);await assert.rejects(db.exec('select * from public.health_export_review_samples'),/permission denied/);await identity()
  })

  await t.test('malformed batch shapes, arbitrary metadata, technical bounds and invalid day/zone/units fail atomically',async()=>{
    const before=await count(),fresh={...record,startAt:'2026-11-01T10:00:00.000Z',endAt:'2026-11-01T10:00:00.000Z'}
    for(const patch of [{metric:'steps'},{unit:'bpm'},{value:0},{value:-1},{value:9007199254740992},{sourceName:' '},{sourceDevice:'x'.repeat(1001)},
      {metadata:{verified:true}},{user_id:other},{startAt:'2026-11-02T05:00:00.000Z'},{endAt:'2026-11-01T01:00:00.000Z'},
      {startAt:'2026-11-01T05:30:00'},{creationAt:'not-a-date'}]) await assert.rejects(call([fresh,{...record,...patch}]))
    for(const value of [null,{},[],Array.from({length:101},()=>record)]) await assert.rejects(call(value),/Invalid export batch/)
    await assert.rejects(call([fresh],'2026-11-01','Unknown/Zone'),/Invalid export batch/)
    await assert.rejects(call([{...fresh,sourceDevice:'x'.repeat(132000)}]),/Invalid export batch/)
    assert.equal(await count(),before,'A late invalid sample rolls back the complete batch.')
  })

  await t.test('member-local fall-back DST day uses real timestamp bounds, reports actual gaps and paginates without invented intervals',async()=>{
    const before=await count()
    const samples=[{...record,sourceName:'DST boundary',startAt:'2026-11-01T04:00:00.000Z',endAt:'2026-11-01T04:00:00.000Z'},
      {...record,sourceName:'DST boundary',startAt:'2026-11-02T04:59:59.000Z',endAt:'2026-11-02T04:59:59.000Z'}]
    assert.deepEqual(await call(samples),{imported:2,alreadyPresent:0})
    await assert.rejects(call([{...record,startAt:'2026-11-02T05:00:00.000Z',endAt:'2026-11-02T05:00:00.000Z'}]),/selected local day/)
    let day=await read();assert.equal(day.total,before+2);assert.equal(day.range.startAt,'2026-11-01T13:00:00+09:00');assert.equal(day.range.endAt,'2026-11-02T13:59:59+09:00')
    const first=Date.parse(day.records[0].startAt),last=Date.parse(day.records.at(-1).startAt);assert.ok(last-first>24*60*60*1000)
    assert.ok(!('continuousMinutes' in day) && !('coveragePercent' in day) && !('verifiedWearable' in day))
    const many=Array.from({length:100},(_,index)=>({...record,sourceName:'Page boundary',startAt:new Date(Date.parse('2026-11-01T15:00:00Z')+index*1000).toISOString(),endAt:new Date(Date.parse('2026-11-01T15:00:00Z')+index*1000).toISOString()}))
    assert.equal((await call(many)).imported,100);day=await read();assert.equal(day.records.length,100);assert.equal(day.total,before+102)
    const second=await read('2026-11-01','America/New_York',100);assert.equal(second.records.length,day.total-100)
    await assert.rejects(read('2026-11-01','America/New_York',-1),/Invalid export review day/)
  })

  await t.test('existing native samples, aggregates and sync cursors remain unchanged; deleting an account cascades only its owned imported rows',async()=>{
    await admin()
    assert.deepEqual((await db.query('select * from public.health_samples')).rows,[{id:1,metric_type:'resting_heart_rate',value:'61'}])
    assert.deepEqual((await db.query('select * from public.daily_health_metrics')).rows,[{id:1,metric_type:'resting_heart_rate',value:'61'}])
    assert.deepEqual((await db.query('select provider_sync_state from public.health_integrations')).rows,[{provider_sync_state:{cursor:'preserved'}}])
    const otherCount=(await db.query('select count(*)::integer n from public.health_export_review_samples where user_id=$1',[other])).rows[0].n
    assert.equal(otherCount,1);await db.query('delete from public.clients where client_id=$1',['OTHER'])
    assert.equal((await db.query('select count(*)::integer n from public.health_export_review_samples where user_id=$1',[other])).rows[0].n,0)
    assert.ok((await db.query('select count(*)::integer n from public.health_export_review_samples where user_id=$1',[owner])).rows[0].n>0)
  })
})
