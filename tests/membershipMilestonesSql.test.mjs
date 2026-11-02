import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const started = '2020-01-31T16:15:00Z'
const iso = value => new Date(value).toISOString()
async function fixture() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table clients(client_id text primary key,email text,full_name text,program text,auth_user_id uuid,login_email text,
      onboarding_completed boolean default false,verified_purchase boolean default false,access boolean default false,active boolean default false,
      subscription_status text,subscription_started_at date,subscription_ends_at date,timezone text,state text,onboarding_data jsonb default '{}',updated_at timestamptz default now());
    create table client_billing(id uuid primary key default gen_random_uuid(),client_id text references clients(client_id),stripe_customer_id text,stripe_subscription_id text,
      billing_type text,billing_status text,current_period_start timestamptz,current_period_end timestamptz,last_payment_date timestamptz,next_payment_date timestamptz,
      access_active boolean default false,cancel_at_period_end boolean default false,updated_at timestamptz default now());
    grant select,insert,update,delete on clients to service_role;
    grant select on clients to authenticated;alter table clients enable row level security;
    create policy owned_profile_read on clients for select to authenticated using(auth_user_id=auth.uid());
    insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@synthetic.invalid',now()),('${other}','other@synthetic.invalid',now());
    insert into clients(client_id,auth_user_id,email,login_email,program,timezone,access,active) values
      ('MILESTONE-OWNER','${owner}','owner@synthetic.invalid','owner@synthetic.invalid','free','America/Chicago',true,true),
      ('MILESTONE-OTHER','${other}','other@synthetic.invalid','other@synthetic.invalid','free','America/Chicago',true,true);`)
  for (const file of ['20261101145900_membership_exact_expiry.sql','20261101150000_launch_commerce_foundation.sql','20261101170500_subscription_reconciliation.sql','20261101180000_membership_milestones.sql']) {
    await db.exec(readFileSync('supabase/migrations/' + file,'utf8'))
  }
  return db
}
async function as(db, role, id = '') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
  await db.exec('set role '+role)
}
const rpc = (db,name,values=[]) => db.query(`select ${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) result`,values).then(result=>result.rows[0].result)
const purchase = patch => ({ session_id:'cs_milestone_synthetic',program:'ember',price_id:'price_milestoneEmber',email:'owner@synthetic.invalid',
  bound_client_id:'MILESTONE-OWNER',bound_user_id:owner,customer_id:'cus_milestone',subscription_id:'sub_milestone',billing_type:'subscription',billing_status:'active',access_active:true,
  period_start:'2026-01-01T00:00:00Z',period_end:'2035-01-01T15:45:30Z',purchased_at:new Date().toISOString(),livemode:false,
  membership_started_at:started,membership_paid:true,...patch })
const billingSnapshot = db => db.query('select to_jsonb(c) client,to_jsonb(b) billing from clients c left join client_billing b using(client_id) order by c.client_id').then(result=>result.rows)

test('guest milestone claim locks its pending client before the target and anchor, and a failed claim retries atomically',async t=>{
  const db=await fixture();t.after(()=>db.close())
  const definition=async signature=>(await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition.replace(/--[^\n]*/g,'').replace(/\s+/g,' ')
  const wrapper=await definition('public.claim_checkout_purchase_v4(text,uuid,text)')
  const order=[
    'hashtextextended(p_session_id,0)',
    'hashtextextended(p_user_id::text,0)',
    'select client_id into pending_id from public.checkout_purchases where session_id=p_session_id for update;',
    'perform 1 from public.clients where client_id=pending_id for update;',
    'select client_id into target_id from public.clients where auth_user_id=p_user_id limit 1 for update;',
    'select id into anchor_id from public.membership_milestone_anchors where client_id=pending_id for update;',
    'result=public.claim_checkout_purchase(p_session_id,p_user_id,p_verified_email);',
  ].map(statement=>wrapper.indexOf(statement))
  assert.ok(order.every((position,index)=>position>=0&&(index===0||position>order[index-1])), 'Installed wrapper must take advisory, purchase, pending-client, target-client, then anchor locks.')
  const base=await definition('public.claim_checkout_purchase(text,uuid,text)')
  assert.ok(base.indexOf('select * into v_purchase from public.checkout_purchases')<base.indexOf('select * into v_pending from public.clients'))
  assert.ok(base.indexOf('select * into v_pending from public.clients')<base.indexOf('select * into v_target from public.clients'))
  const sync=await definition('public.sync_member_subscription_v3(text,jsonb)')
  assert.ok(sync.indexOf('select * into v_client from public.clients')<sync.indexOf('select * into v_billing from public.client_billing'))
  const trigger=(await db.query("select pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.client_billing'::regclass and tgname='milestone_billing_changed'")).rows[0].definition
  assert.match(trigger,/DEFERRABLE INITIALLY DEFERRED/)
  assert.match(await definition('membership_private.refresh_milestone_anchor(uuid)'),/select \* into a from public\.membership_milestone_anchors where id=p_anchor_id for update/)

  // This local fixture has one connection: the checks above establish SQL lock
  // order statically. A synthetic serialization failure below proves rollback
  // and safe retry, not a hosted concurrent-transaction acceptance result.
  await db.exec("update membership_milestone_settings set armed_at='2019-01-01T00:00Z' where singleton")
  await as(db,'service_role')
  const paid=purchase({session_id:'cs_lock_order_guest',subscription_id:'sub_lock_order_guest',bound_client_id:null,bound_user_id:null})
  const pending=await rpc(db,'fulfill_checkout_purchase_v4',[paid])
  const snapshot=async()=>({
    anchors:(await db.query('select id,client_id,owner_user_id,started_at from membership_milestone_anchors order by id')).rows,
    purchases:(await db.query('select session_id,client_id from checkout_purchases order by session_id')).rows,
    billing:await billingSnapshot(db),
  })
  const before=await snapshot()
  await assert.rejects(rpc(db,'claim_checkout_purchase_v4',[paid.session_id,other,'other@synthetic.invalid']),/email|match|owner/i)
  assert.deepEqual(await snapshot(),before)
  await db.exec(`reset role;
    create function public.qa_claim_serialization_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic claim retry' using errcode='40001';end$$;
    create trigger qa_claim_serialization_failure before update on public.clients for each row when(new.client_id='MILESTONE-OWNER' and new.verified_purchase is true) execute function public.qa_claim_serialization_failure();`)
  await as(db,'service_role')
  await assert.rejects(rpc(db,'claim_checkout_purchase_v4',[paid.session_id,owner,'owner@synthetic.invalid']),error=>error.code==='40001'&&/synthetic claim retry/.test(error.message))
  assert.deepEqual(await snapshot(),before,'Failed base claim must roll back preliminary anchor transfer and all purchase/billing changes.')
  await db.exec('reset role;drop trigger qa_claim_serialization_failure on public.clients;drop function public.qa_claim_serialization_failure();')
  await as(db,'service_role')
  const first=await rpc(db,'claim_checkout_purchase_v4',[paid.session_id,owner,'owner@synthetic.invalid'])
  const confirmed=await snapshot()
  const retry=await rpc(db,'claim_checkout_purchase_v4',[paid.session_id,owner,'owner@synthetic.invalid'])
  assert.equal(first.client_id,'MILESTONE-OWNER');assert.equal(retry.client_id,first.client_id)
  assert.deepEqual(await snapshot(),confirmed,'A confirmed claim replay must not duplicate or rewrite the anchor or billing grant.')
  assert.equal(confirmed.anchors.length,1)
  assert.equal(confirmed.anchors[0].id,before.anchors[0].id)
  assert.equal(confirmed.anchors[0].client_id,first.client_id)
  assert.equal(confirmed.anchors[0].owner_user_id,owner)
  assert.notEqual(first.client_id,pending.client_id)
})

test('milestone dates use calendar months, leap-day clamping and three member-local days across DST',async t=>{
  const db=await fixture();t.after(()=>db.close())
  const times=async(started,months,zone)=>(await db.query('select * from membership_private.milestone_times($1::timestamptz,$2::integer,$3::text)',[started,months,zone])).rows[0]
  const six=await times('2023-01-31T16:15:00Z',6,'America/Chicago')
  assert.equal(iso(six.due_at),'2023-07-31T15:15:00.000Z')
  assert.equal(iso((await times('2024-02-29T16:00:00Z',12,'America/Chicago')).due_at),'2025-02-28T16:00:00.000Z')
  assert.equal(iso((await times('2024-02-29T16:00:00Z',60,'America/Chicago')).due_at),'2029-02-28T16:00:00.000Z')
  const spring=await times('2024-09-08T16:00:00Z',6,'America/Los_Angeles')
  assert.equal(iso(spring.due_at),'2025-03-08T17:00:00.000Z')
  assert.equal(iso(spring.reminder_due_at),'2025-03-11T16:00:00.000Z')
  assert.equal((new Date(spring.reminder_due_at)-new Date(spring.due_at))/3600000,71)
  const fall=await times('2025-05-01T16:00:00Z',6,'America/Los_Angeles')
  assert.equal(iso(fall.due_at),'2025-11-01T16:00:00.000Z')
  assert.equal(iso(fall.reminder_due_at),'2025-11-04T17:00:00.000Z')
  assert.equal((new Date(fall.reminder_due_at)-new Date(fall.due_at))/3600000,73)
  const zone=async values=>(await db.query('select membership_private.milestone_zone($1) zone',[values])).rows[0].zone
  assert.equal(await zone({state:'ID'}),'America/Boise')
  assert.equal(await zone({state:'MI'}),'America/Detroit')
  assert.equal(await zone({timezone:'america/new_york'}),'America/New_York')
  await assert.rejects(times(started,null,'America/Chicago'),/Invalid milestone calendar/)
})

test('only newly armed paid recurring membership creates four immutable milestones and guest claim moves the anchor to the verified canonical owner',async t=>{
  const db=await fixture();t.after(()=>db.close())
  await as(db,'service_role')
  assert.equal(await rpc(db,'commerce_configuration_ready',[4]),true)
  assert.equal(await rpc(db,'commerce_configuration_ready',[3]),true)
  const anchors=async()=>Number((await db.query('select count(*)::int n from membership_milestone_anchors')).rows[0].n)
  const guest=patch=>purchase({bound_client_id:null,bound_user_id:null,...patch})
  await rpc(db,'fulfill_checkout_purchase_v4',[guest({session_id:'cs_legacy_start',subscription_id:'sub_legacy_start'})])
  assert.equal(await anchors(),0,'Installing the feature must not backfill earlier membership starts.')
  await as(db,'postgres')
  await db.query("update membership_milestone_settings set armed_at='2019-01-01T00:00Z' where singleton")
  await as(db,'service_role')
  for(const [index,patch] of [
    {membership_paid:false},
    {membership_started_at:null},
    {billing_type:'payment',billing_status:'paid_in_full',subscription_id:null},
    {access_active:false,billing_status:'past_due'},
  ].entries()){
    await rpc(db,'fulfill_checkout_purchase_v4',[guest({session_id:`cs_ineligible_${index}`,subscription_id:`sub_ineligible_${index}`,...patch})])
    assert.equal(await anchors(),0)
  }
  const first=purchase({session_id:'cs_guest_milestone',subscription_id:'sub_guest_milestone',bound_client_id:null,bound_user_id:null})
  const pending=await rpc(db,'fulfill_checkout_purchase_v4',[first])
  assert.equal(await anchors(),1)
  const before=(await db.query('select * from membership_milestone_anchors')).rows[0]
  assert.equal(iso(before.started_at),iso(started));assert.equal(before.client_id,pending.client_id)
  await rpc(db,'fulfill_checkout_purchase_v4',[{...first,membership_started_at:'2021-02-01T12:00:00Z'}])
  assert.equal(iso((await db.query('select started_at from membership_milestone_anchors')).rows[0].started_at),iso(started))
  await assert.rejects(rpc(db,'claim_checkout_purchase_v4',[first.session_id,other,'other@synthetic.invalid']),/email|match|owner/i)
  const claimed=await rpc(db,'claim_checkout_purchase_v4',[first.session_id,owner,'owner@synthetic.invalid'])
  assert.equal(claimed.client_id,'MILESTONE-OWNER')
  const after=(await db.query('select * from membership_milestone_anchors')).rows[0]
  assert.equal(after.id,before.id);assert.equal(after.client_id,'MILESTONE-OWNER');assert.equal(after.owner_user_id,owner)
  assert.equal(iso(after.started_at),iso(started))
  assert.deepEqual((await db.query('select months from membership_milestones order by months')).rows.map(row=>row.months),[6,12,24,60])
  await as(db,'authenticated',owner)
  const state=await rpc(db,'get_membership_milestones')
  assert.equal(state.eligible,true);assert.equal(state.milestones.length,4)
  await as(db,'authenticated',other)
  assert.deepEqual((await rpc(db,'get_membership_milestones')).milestones,[])
  await assert.rejects(rpc(db,'fulfill_checkout_purchase_v4',[first]),/permission denied/)
})

test('owner feedback is immutable/idempotent without billing effects and completion/cancellation suppress leased reminders with verified current recipients',async t=>{
  const db=await fixture();t.after(()=>db.close())
  await db.query("update membership_milestone_settings set armed_at='2019-01-01T00:00Z' where singleton")
  await db.query("update auth.users set email='current-owner@synthetic.invalid',email_confirmed_at=now() where id=$1",[owner])
  await as(db,'service_role')
  await rpc(db,'fulfill_checkout_purchase_v4',[purchase({})])
  await rpc(db,'refresh_membership_milestones',[50])
  await rpc(db,'refresh_membership_milestones',[50])
  assert.equal((await db.query('select count(*)::int n from membership_milestone_reminders')).rows[0].n,4)
  const [six,twelve,twentyFour,sixty]=(await db.query('select id,months,status from membership_milestones order by months')).rows
  const job=await rpc(db,'claim_membership_milestone_reminder',[six.id])
  assert.equal(job.milestone_id,six.id);assert.equal(job.user_id,owner);assert.equal(job.email,'current-owner@synthetic.invalid')
  assert.equal(await rpc(db,'claim_membership_milestone_reminder',[six.id]),null)
  const current=await rpc(db,'recheck_membership_milestone_reminder',[six.id,job.lease_token])
  assert.equal(current.email,'current-owner@synthetic.invalid')
  const before=await billingSnapshot(db)
  await as(db,'authenticated',other)
  await assert.rejects(rpc(db,'submit_membership_milestone_feedback',[six.id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',{rating:4,continuation:'continue'}]),/own|not found|eligible|membership/i)
  await as(db,'authenticated',owner)
  const response={rating:3,continuation:'do_not_continue',comment:'Synthetic private feedback.'}
  const args=[six.id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',response]
  const saved=await rpc(db,'submit_membership_milestone_feedback',args)
  assert.equal(saved.status,'completed');assert.deepEqual(saved.feedback.response,response)
  assert.deepEqual((await rpc(db,'submit_membership_milestone_feedback',args)).feedback,saved.feedback)
  await assert.rejects(rpc(db,'submit_membership_milestone_feedback',[six.id,args[1],{rating:5,continuation:'continue'}]),/immutable|already|different|conflict|identifier/i)
  await assert.rejects(rpc(db,'submit_membership_milestone_feedback',[twelve.id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{rating:6,continuation:'unsure'}]),/invalid|response|rating/i)
  await as(db,'service_role')
  assert.deepEqual(await billingSnapshot(db),before,'Feedback about continuation must not cancel or alter billing/access.')
  assert.equal((await db.query('select count(*)::int n from membership_milestone_feedback')).rows[0].n,1)
  assert.equal(await rpc(db,'recheck_membership_milestone_reminder',[six.id,job.lease_token]),null)
  assert.equal(await rpc(db,'finish_membership_milestone_reminder',[six.id,job.lease_token,true]),false)
  const changedRecipient=await rpc(db,'claim_membership_milestone_reminder',[twelve.id])
  assert.ok(changedRecipient)
  await as(db,'postgres')
  await db.query("update auth.users set email='newest-owner@synthetic.invalid',email_confirmed_at=now() where id=$1",[owner])
  await as(db,'service_role')
  assert.equal(await rpc(db,'recheck_membership_milestone_reminder',[twelve.id,changedRecipient.lease_token]),null,'A changed recipient retires the frozen provider payload instead of emailing a stale address.')
  assert.equal((await db.query('select status from membership_milestone_reminders where milestone_id=$1',[twelve.id])).rows[0].status,'manual_recovery')
  const uncertain=await rpc(db,'claim_membership_milestone_reminder',[sixty.id])
  assert.ok(uncertain)
  await as(db,'postgres')
  await db.query("update membership_milestone_reminders set first_attempt_at=now()-interval '24 hours',lease_expires_at=now()-interval '1 minute',next_attempt_at=now()-interval '1 minute' where milestone_id=$1",[sixty.id])
  await as(db,'service_role')
  assert.equal(await rpc(db,'claim_membership_milestone_reminder',[sixty.id]),null)
  assert.equal((await db.query('select status from membership_milestone_reminders where milestone_id=$1',[sixty.id])).rows[0].status,'manual_recovery')
  const cancelledJob=await rpc(db,'claim_membership_milestone_reminder',[twentyFour.id])
  assert.ok(cancelledJob)
  await rpc(db,'sync_member_subscription_v3',['sub_milestone',{status:'canceled',access:false,program:'ember',price_id:'price_milestoneEmber',start:'2026-01-01T00:00:00Z',end:'2035-01-01T15:45:30Z',event_created:100,cancelAtPeriodEnd:false}])
  assert.equal(await rpc(db,'recheck_membership_milestone_reminder',[twentyFour.id,cancelledJob.lease_token]),null)
  await rpc(db,'refresh_membership_milestones',[50])
  assert.equal((await db.query('select status from membership_milestones where id=$1',[six.id])).rows[0].status,'completed')
  assert.equal((await db.query('select count(*)::int n from membership_milestones where status=\'suppressed\'')).rows[0].n,3)
  assert.equal((await db.query('select count(*)::int n from membership_milestone_reminders where status in (\'pending\',\'leased\')')).rows[0].n,0)
  await as(db,'authenticated',owner)
  const history=await rpc(db,'get_membership_milestones')
  assert.equal(history.eligible,false);assert.equal(history.milestones.find(row=>row.id===six.id).status,'completed')
  assert.deepEqual(history.milestones.find(row=>row.id===six.id).feedback.response,response)
  await assert.rejects(rpc(db,'submit_membership_milestone_feedback',[twentyFour.id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',{rating:4,continuation:'continue'}]),/eligible|membership|available|suppressed/i)
})

test('temporary subscription reconciliation retires a stale reminder but preserves the original anchor and future milestones after verified recovery',async t=>{
  const db=await fixture();t.after(()=>db.close())
  await db.query("update membership_milestone_settings set armed_at='2019-01-01T00:00Z' where singleton")
  const recent=(await db.query("select ((clock_timestamp() at time zone 'America/Chicago')-interval '6 months 4 days') at time zone 'America/Chicago' started_at")).rows[0].started_at
  const periodStart=new Date(Date.now()-86400000).toISOString()
  await as(db,'service_role')
  await rpc(db,'fulfill_checkout_purchase_v4',[purchase({membership_started_at:iso(recent),period_start:periodStart})])
  await rpc(db,'refresh_membership_milestones',[50])
  const original=(await db.query('select id,started_at,suppressed_at from membership_milestone_anchors')).rows[0]
  const six=(await db.query('select id from membership_milestones where months=6')).rows[0]
  assert.equal((await db.query("select count(*)::int n from membership_milestones where status='scheduled'")).rows[0].n,3)
  const job=await rpc(db,'claim_membership_milestone_reminder',[six.id])
  assert.ok(job)
  const current={status:'active',access:true,program:'ember',price_id:'price_milestoneEmber',start:periodStart,end:'2035-01-01T15:45:30Z',event_created:100,cancelAtPeriodEnd:false}
  await rpc(db,'sync_member_subscription_v3',['sub_milestone',current])
  const conflicted=await rpc(db,'sync_member_subscription_v3',['sub_milestone',{...current,status:'past_due',access:false}])
  assert.equal(conflicted.conflict,true)
  assert.equal((await db.query('select suppressed_at from membership_milestone_anchors')).rows[0].suppressed_at,null)
  assert.equal((await db.query("select count(*)::int n from membership_milestones where status='scheduled'")).rows[0].n,3)
  assert.equal((await db.query('select status from membership_milestone_reminders where milestone_id=$1',[six.id])).rows[0].status,'suppressed')
  assert.equal(await rpc(db,'recheck_membership_milestone_reminder',[six.id,job.lease_token]),null)
  const lease=await rpc(db,'claim_subscription_reconciliation',['sub_milestone'])
  assert.ok(lease.lease_token)
  assert.equal((await rpc(db,'reconcile_member_subscription',['sub_milestone',lease.lease_token,lease.revision,current])).reconciled,true)
  const recovered=(await db.query('select id,started_at,suppressed_at from membership_milestone_anchors')).rows[0]
  assert.equal(recovered.id,original.id);assert.equal(iso(recovered.started_at),iso(original.started_at));assert.equal(recovered.suppressed_at,null)
  assert.equal((await db.query("select count(*)::int n from membership_milestones where status='scheduled'")).rows[0].n,3)
  assert.equal((await db.query('select status from membership_milestone_reminders where milestone_id=$1',[six.id])).rows[0].status,'suppressed','A verified recovery must not resend an older suppressed job.')
  await as(db,'authenticated',owner)
  const result=await rpc(db,'get_membership_milestones')
  assert.equal(result.eligible,true);assert.equal(result.milestones.find(row=>row.months===6).can_respond,true)
})
