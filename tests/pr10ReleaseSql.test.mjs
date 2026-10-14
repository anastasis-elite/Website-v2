import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createProductionFixture, setFixtureIdentity } from '../scripts/lib/p0-production-fixture.mjs'

// Exact captured production schema + already-applied P0 files, with synthetic
// records only. No network, credentials, remote DDL or customer data.
test('PR10 proposed repairs execute on the captured production schema and enforce real SQL authorization', async t => {
  const { db } = await createProductionFixture()
  t.after(() => db.close())
  const ember = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const ignite = '11111111-1111-4111-8111-111111111111'
  const phoenix = '22222222-2222-4222-8222-222222222222'
  const food = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  const logs = ['eeeeeeee-1111-4111-8111-eeeeeeeeeeee','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444']
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
    ('${ember}','ember@local.invalid',now()),('${ignite}','ignite@local.invalid',now()),('${phoenix}','phoenix@local.invalid',now());
    insert into clients(client_id,auth_user_id,email,program,access,active) values
    ('EMBER-SQL','${ember}','ember@local.invalid','ember',true,true),
    ('IGNITE-SQL','${ignite}','ignite@local.invalid','ignite',true,true),
    ('PHOENIX-SQL','${phoenix}','phoenix@local.invalid','phoenix',true,true);
    insert into nutrition_logs(id,client_id,auth_user_id,log_date,meals,calories,water_consumed_oz) values
    ('${logs[0]}','EMBER-SQL','${ember}','2026-10-14','["Historical intake"]',2100,36),
    ('${logs[1]}','IGNITE-SQL','${ignite}','2026-10-14','[]',2100,36),
    ('${logs[2]}','PHOENIX-SQL','${phoenix}','2026-10-14','[]',2100,36);
    insert into foods(id,name,source) values('${food}','Synthetic catalog food','catalog');
    insert into food_nutrients(food_id,calories,protein_g,carbs_g,fat_g) values('${food}',100,5,10,2);
    insert into client_billing(client_id,stripe_customer_id,billing_status,access_active)
      values('IGNITE-SQL','cus_retained','canceled',false);`)
  for (const name of readdirSync('supabase/migrations').filter(n => /_p0_.*\.sql$/.test(n)).sort()) {
    await db.exec(readFileSync('supabase/migrations/'+name,'utf8'))
  }
  // Deliberately reproduce July's broader legacy-item grant/policy in this
  // disposable fixture to prove the new restrictive guard survives it.
  await db.exec(`grant select,insert on food_log_items to authenticated;
    grant truncate,references,trigger on food_log_items to public,anon,authenticated;
    create policy "synthetic legacy food item insert" on food_log_items for insert to authenticated
    with check(exists(select 1 from clients c where c.id=food_log_items.client_id and c.auth_user_id=(select auth.uid())));`)
  const clientSnapshot = () => db.query('select client_id,auth_user_id,program,access,active,verified_purchase,subscription_ends_at from clients order by client_id')
  const billingSnapshot = () => db.query('select client_id,stripe_customer_id,billing_status,access_active from client_billing order by client_id')
  const beforeClients = (await clientSnapshot()).rows, beforeBilling = (await billingSnapshot()).rows
  const proposals = ['docs/sql/pr10-nutrition-entitlement-guard.sql','docs/sql/pr10-commerce-dependency-repair.sql']
  for (let replay = 0; replay < 2; replay++) for (const path of proposals) await db.exec(readFileSync(path,'utf8'))
  await t.test('both proposals replay without customer backfills, duplicate policies or entitlement/billing changes', async () => {
    assert.deepEqual((await clientSnapshot()).rows,beforeClients)
    assert.deepEqual((await billingSnapshot()).rows,beforeBilling)
    assert.equal((await db.query('select meals from nutrition_logs where id=$1',[logs[0]])).rows[0].meals[0],'Historical intake')
    assert.equal((await db.query("select has_table_privilege('service_role','auth.users','SELECT') allowed")).rows[0].allowed,false)
    const functions = (await db.query("select proname,prosecdef from pg_proc where proname in ('member_has_nutrition_access','protect_legacy_nutrition_meals','fulfill_checkout_purchase','sync_member_subscription','claim_checkout_purchase')")).rows
    assert.ok(functions.length === 5 && functions.every(fn => fn.prosecdef === false))
  })
  const addMeal = (index, source='manual') => db.query("insert into meal_entries(nutrition_log_id,food_id,serving_amount,grams,entry_source,entry_state) values($1,$2,1,100,$3,'confirmed') returning id",[logs[index],food,source])
  await t.test('EMBER cannot log through canonical, legacy JSON, recurring preferences, custom foods or legacy food-item tables', async () => {
    await setFixtureIdentity(db,'authenticated',ember)
    await assert.rejects(addMeal(0),/row-level security/)
    await assert.rejects(db.query("update nutrition_logs set meals='[\"New food\"]' where id=$1",[logs[0]]),/Food and meal logging require/)
    await assert.rejects(db.query("update nutrition_logs set meals='[]' where id=$1",[logs[0]]),/Food and meal logging require/)
    await db.query('update nutrition_logs set calories=2200,water_consumed_oz=44 where id=$1',[logs[0]])
    assert.deepEqual((await db.query('select meals from nutrition_logs where id=$1',[logs[0]])).rows[0].meals,['Historical intake'])
    await assert.rejects(db.query("insert into recurring_food_patterns(client_id,auth_user_id,food_id,meal_period) values('EMBER-SQL',$1,$2,'Lunch')",[ember,food]),/row-level security/)
    await assert.rejects(db.query("insert into foods(name,source,client_id,auth_user_id) values('Denied','custom','EMBER-SQL',$1)",[ember]),/row-level security/)
    const memberId=(await db.query("select id from clients where client_id='EMBER-SQL'")).rows[0].id
    await assert.rejects(db.query('insert into food_log_items(client_id,nutrition_log_id,food_id,quantity) values($1,$2,$3,1)',[memberId,logs[0],food]),/row-level security/)
    await db.query("insert into macro_entries(nutrition_log_id,client_id,auth_user_id,calories,protein_g,carbs_g,fat_g) values($1,'EMBER-SQL',$2,100,5,10,2)",[logs[0],ember])
  })
  await t.test('active IGNITE supports manual/barcode, denies photo and macro-only input, and preserves foreign-owner isolation', async () => {
    await setFixtureIdentity(db,'authenticated',ignite)
    await addMeal(1,'manual'); await addMeal(1,'barcode')
    await assert.rejects(addMeal(1,'photo_estimate'),/row-level security/)
    await assert.rejects(addMeal(2),/row-level security/)
    await assert.rejects(db.query("insert into macro_entries(nutrition_log_id,client_id,auth_user_id,calories,protein_g,carbs_g,fat_g) values($1,'IGNITE-SQL',$2,100,5,10,2)",[logs[1],ignite]),/row-level security/)
    await db.query("update nutrition_logs set meals='[\"Authorized meal\"]' where id=$1",[logs[1]])
    await db.query("insert into recurring_food_patterns(client_id,auth_user_id,food_id,meal_period) values('IGNITE-SQL',$1,$2,'Lunch')",[ignite,food])
    await db.query("insert into foods(name,source,client_id,auth_user_id) values('Authorized custom food','custom','IGNITE-SQL',$1)",[ignite])
    const memberId=(await db.query("select id from clients where client_id='IGNITE-SQL'")).rows[0].id
    await db.query('insert into food_log_items(client_id,nutrition_log_id,food_id,quantity) values($1,$2,$3,1)',[memberId,logs[1],food])
    await assert.rejects(db.query('insert into food_log_items(client_id,nutrition_log_id,food_id,quantity) values($1,$2,$3,1)',[memberId,logs[2],food]),/row-level security/)
    await assert.rejects(db.query("update clients set program='phoenix' where client_id='IGNITE-SQL'"),/entitlement/)
  })
  await t.test('PHOENIX permits canonical reviewed photo candidates without granting IGNITE image logging', async () => {
    await setFixtureIdentity(db,'authenticated',phoenix)
    await addMeal(2,'manual'); await addMeal(2,'barcode'); await addMeal(2,'photo_estimate')
    await db.query("insert into foods(name,source,client_id,auth_user_id) values('Reviewed photo food','photo_estimate','PHOENIX-SQL',$1)",[phoenix])
  })
  await t.test('anonymous and authenticated roles cannot truncate legacy food history despite historical broad grants', async () => {
    await setFixtureIdentity(db,'postgres')
    const before=(await db.query('select count(*)::int n from food_log_items')).rows[0].n
    assert.ok(before>0)
    for (const role of ['anon','authenticated']) {
      await setFixtureIdentity(db,role,role==='authenticated' ? ignite : '')
      for (const privilege of ['TRUNCATE','REFERENCES','TRIGGER']) {
        assert.equal((await db.query("select has_table_privilege(current_user,'public.food_log_items',$1) allowed",[privilege])).rows[0].allowed,false)
      }
      await assert.rejects(db.query('truncate table public.food_log_items'),/permission denied/)
    }
    await setFixtureIdentity(db,'postgres')
    assert.equal((await db.query('select count(*)::int n from food_log_items')).rows[0].n,before)
  })
  await t.test('inactive, revoked and expired memberships fail direct database logging while existing history stays readable', async () => {
    for (const change of ["active=false","access=false","verified_purchase=true,subscription_ends_at='2020-01-01'","verified_purchase=true,subscription_ends_at=null"]) {
      await setFixtureIdentity(db,'postgres')
      await db.exec("update clients set access=true,active=true,verified_purchase=false,subscription_ends_at=null where client_id='IGNITE-SQL'")
      await db.exec("update clients set "+change+" where client_id='IGNITE-SQL'")
      await setFixtureIdentity(db,'authenticated',ignite)
      await assert.rejects(addMeal(1),/row-level security/)
      await assert.rejects(db.query("update nutrition_logs set meals='[\"Denied\"]' where id=$1",[logs[1]]),/Food and meal logging require/)
      assert.ok((await db.query('select id from meal_entries where nutrition_log_id=$1',[logs[1]])).rows.length >= 2)
    }
    await setFixtureIdentity(db,'postgres')
    await db.exec("update clients set access=true,active=true,verified_purchase=false,subscription_ends_at=null where client_id='IGNITE-SQL'")
  })
  await t.test('commerce ledgers/RPCs are server-only; billing reads are owned and browser entitlement writes denied', async () => {
    await setFixtureIdentity(db,'authenticated',phoenix)
    assert.equal((await db.query('select * from client_billing')).rows.length,0)
    await setFixtureIdentity(db,'authenticated',ignite)
    assert.equal((await db.query('select * from client_billing')).rows.length,1)
    await assert.rejects(db.query("update client_billing set stripe_customer_id='attacker'"),/permission denied/)
    for(const table of ['client_invitations','api_request_events','stripe_webhook_events','checkout_purchases']) await assert.rejects(db.query('select * from '+table),/permission denied/)
    await assert.rejects(db.query('select commerce_configuration_ready(2)'),/permission denied/)
    await assert.rejects(db.query('select fulfill_checkout_purchase($1)',['{}']),/permission denied/)
    await assert.rejects(db.query('select claim_checkout_purchase($1,$2,$3)',['cs_test_synthetic',ignite,'ignite@local.invalid']),/permission denied/)
    await setFixtureIdentity(db,'anon')
    await assert.rejects(addMeal(0),/permission denied/)
    await assert.rejects(db.query('select commerce_configuration_ready(2)'),/permission denied/)
  })
  const purchase = { session_id:'cs_test_synthetic',program:'phoenix',email:'ignite@local.invalid',period_start:'2026-10-01T00:00:00Z',period_end:'2030-10-01T00:00:00Z',purchased_at:'2026-10-10T00:00:00Z',access_active:true,billing_status:'active',billing_type:'subscription',customer_id:'cus_synthetic',subscription_id:'sub_synthetic',livemode:false }
  await t.test('server fulfillment is atomic/idempotent and claim verifies server-confirmed email without auth.users access', async () => {
    await setFixtureIdentity(db,'service_role')
    assert.equal((await db.query('select commerce_configuration_ready(2) ready')).rows[0].ready,true)
    assert.equal((await db.query('select commerce_configuration_ready() ready')).rows[0].ready,false)
    assert.equal((await db.query('select commerce_configuration_ready(1) ready')).rows[0].ready,false)
    await assert.rejects(db.query('select fulfill_checkout_purchase($1)',[JSON.stringify({...purchase,period_end:null})]),/Invalid purchase/)
    const first=(await db.query('select fulfill_checkout_purchase($1) saved',[JSON.stringify(purchase)])).rows[0].saved
    assert.equal(first.replayed,false)
    assert.equal((await db.query('select fulfill_checkout_purchase($1) saved',[JSON.stringify(purchase)])).rows[0].saved.replayed,true)
    assert.equal((await db.query('select count(*)::int n from checkout_purchases')).rows[0].n,1)
    await assert.rejects(db.query('select claim_checkout_purchase($1,$2,$3)',[purchase.session_id,phoenix,'phoenix@local.invalid']),/does not match verified login/)
    await assert.rejects(db.query('select claim_checkout_purchase($1,$2,$3)',[purchase.session_id,ignite,null]),/Verified login is required/)
    const claimed=(await db.query('select claim_checkout_purchase($1,$2,$3) saved',[purchase.session_id,ignite,'IGNITE@LOCAL.INVALID'])).rows[0].saved
    assert.equal(claimed.client_id,'IGNITE-SQL'); assert.equal(claimed.auth_user_id,ignite)
    await db.query('select claim_checkout_purchase($1,$2,$3)',[purchase.session_id,ignite,'ignite@local.invalid'])
    assert.equal((await db.query('select count(*)::int n from checkout_purchases')).rows[0].n,1)
    await db.query("insert into api_request_events(scope,key_hash) values('synthetic','synthetic')")
    await db.query("insert into stripe_webhook_events(event_id,event_type) values('evt_synthetic','test')")
    await assert.rejects(db.query("insert into stripe_webhook_events(event_id,event_type) values('evt_synthetic','test')"),/duplicate key/)
  })
  await t.test('older/equal subscription events cannot resurrect a canceled synthetic membership', async () => {
    const state={status:'canceled',access:false,start:'2026-10-01T00:00:00Z',end:'2030-10-01T00:00:00Z',event_created:101}
    await db.query('select sync_member_subscription($1,$2)',['sub_synthetic',JSON.stringify(state)])
    for(const event_created of [100,101,102]) await db.query('select sync_member_subscription($1,$2)',['sub_synthetic',JSON.stringify({...state,status:'active',access:true,event_created})])
    const saved=(await db.query("select access,active,subscription_status from clients where client_id='IGNITE-SQL'")).rows[0]
    assert.deepEqual(saved,{access:false,active:false,subscription_status:'canceled'})
  })
  await t.test('readiness fails closed when required server privileges are absent', async () => {
    await setFixtureIdentity(db,'postgres')
    await db.exec('revoke insert on api_request_events from service_role')
    await setFixtureIdentity(db,'service_role')
    assert.equal((await db.query('select commerce_configuration_ready(2) ready')).rows[0].ready,false)
  })
})
