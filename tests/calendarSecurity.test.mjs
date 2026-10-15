import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'
const require=createRequire(import.meta.url)
function load(path,mocks={}) {
 const module={exports:{}}
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='server-only'?{}:mocks[id]??require(id),process,Buffer,Intl,Date,URL,Request,Response,Set,Map,AbortSignal,console})
 return module.exports
}
test('credentials are encrypted, tamper evident, and bound to account owner',()=>{
 process.env.CALENDAR_CREDENTIAL_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64')
 const {seal,unseal}=load('lib/calendar/crypto.ts')
 const credential={accessToken:'secret-token',refreshToken:'secret-refresh'}
 const encrypted=seal(credential,'user-a:calendar-a')
 assert.ok(!encrypted.includes('secret'))
 assert.equal(JSON.stringify(unseal(encrypted,'user-a:calendar-a')),JSON.stringify(credential))
 assert.throws(()=>unseal(encrypted,'user-b:calendar-a'))
 const parts=encrypted.split('.');parts[3]=Buffer.from('tampered').toString('base64')
 assert.throws(()=>unseal(parts.join('.'),'user-a:calendar-a'))
})
test('calendar context rejects cross-origin cookie writes and unverified sessions before privileged access',async()=>{
 let user={id:'owner-a'},adminCalls=0,mobileAllowed=false
 const member={client_id:'QA-ONLY',program:'ember',access:true,active:true}
 const db={auth:{getUser:async()=>({data:{user},error:null})},from(){const query={select(){return query},eq(key,value){assert.equal(key,'auth_user_id');assert.equal(value,user.id);return query},maybeSingle:async()=>({data:member,error:null})};return query}}
 const context=load('lib/calendar/server-context.ts',{
  'next/server':{NextResponse:{}},'@/lib/supabase/server':{createClient:async()=>db},
  '@/lib/supabase/admin':{createAdminClient:()=>{adminCalls++;return {}}},
  '@/lib/mobile/auth':{createMobileRequestContext:async()=>mobileAllowed?{supabase:db,user,client:member}:{error:'Unauthorized',status:401}},
  '@/lib/commerce/access':load('lib/commerce/access.ts'),
  './providers/types':{},
 })
 const request=(method,headers={})=>new Request('https://anastasis.test/api/calendars',{method,headers})
 await assert.rejects(context.calendarContext(request('POST')),error=>error.status===403)
 await assert.rejects(context.calendarContext(request('POST',{Origin:'https://evil.example'})),error=>error.status===403)
 assert.equal(adminCalls,0)
 user=null
 await assert.rejects(context.calendarContext(request('GET')),error=>error.status===401)
 await assert.rejects(context.calendarContext(request('POST',{Authorization:'Bearer invalid'})),error=>error.status===401)
 assert.equal(adminCalls,0)
 user={id:'owner-a'}
 const cookie=await context.calendarContext(request('POST',{Origin:'https://anastasis.test'}))
 assert.equal(cookie.user.id,'owner-a');assert.equal(adminCalls,1)
 mobileAllowed=true
 const mobile=await context.calendarContext(request('POST',{Authorization:'Bearer verified-test-token'}))
 assert.equal(mobile.user.id,'owner-a');assert.equal(adminCalls,2)
})
test('calendar migration executes and enforces ownership, secret isolation, leases and disconnect',async()=>{
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`)
 await db.exec(readFileSync('supabase/migrations/20261011210620_connected_calendars.sql','utf8'))
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',conn='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',cal='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 await db.query(`insert into calendar_connections(id,user_id,provider,provider_account_id,account_label) values($1,$2,'google','account','a@example.test')`,[conn,a])
 await db.query(`insert into connected_calendars(id,connection_id,user_id,provider_calendar_id,name) values($1,$2,$3,'primary','Work')`,[cal,conn,a])
 await db.query(`insert into calendar_credentials values($1,$2,'encrypted')`,[conn,a])
 await db.query(`insert into calendar_events(user_id,calendar_id,provider_event_id,provider_payload,etag) values($1,$2,'event','{}','v1')`,[a,cal])
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${b}'`)
 for(const table of ['calendar_connections','connected_calendars','calendar_events','calendar_preferences']) assert.equal((await db.query(`select * from ${table}`)).rows.length,0)
 await assert.rejects(db.query('select * from calendar_credentials'),/permission denied/)
 await assert.rejects(db.query('select * from calendar_oauth_states'),/permission denied/)
 await assert.rejects(db.query('select * from calendar_write_operations'),/permission denied/)
 await assert.rejects(db.query(`update calendar_connections set account_label='hijacked'`),/permission denied/)
 await assert.rejects(db.query(`select disconnect_calendar($1,$2)`,[conn,a]),/permission denied/)
 await db.exec(`set request.jwt.claim.sub='${a}'`)
 assert.equal((await db.query('select * from calendar_events')).rows.length,1)
 await db.exec('reset role;set role service_role')
 await assert.rejects(db.query(`insert into calendar_write_operations(user_id,idempotency_key,request_hash,connection_id,target_calendar_id) values($1,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','request',$2,$3)`,[b,conn,cal]),/foreign key/)
 await db.query(`insert into calendar_write_operations(user_id,idempotency_key,request_hash,connection_id,target_event_id,target_external,target_calendar_id,target_provider_event_id,target_provider_etag) values($1,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','request',$2,'ffffffff-ffff-4fff-8fff-ffffffffffff',true,$3,'event','v1')`,[a,conn,cal])
 assert.equal((await db.query('select claim_calendar_sync($1,$2,$3) as claimed',[conn,a,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'])).rows[0].claimed,true)
 assert.equal((await db.query('select claim_calendar_sync($1,$2,$3) as claimed',[conn,a,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'])).rows[0].claimed,false)
 assert.equal((await db.query('select disconnect_calendar($1,$2) as deleted',[conn,b])).rows[0].deleted,false)
 assert.equal((await db.query('select disconnect_calendar($1,$2) as deleted',[conn,a])).rows[0].deleted,true)
 for(const table of ['calendar_connections','connected_calendars','calendar_credentials','calendar_events','calendar_write_operations']) assert.equal((await db.query(`select * from ${table}`)).rows.length,0)
 await db.close()
})
