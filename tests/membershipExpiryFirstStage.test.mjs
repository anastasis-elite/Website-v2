import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const { hasActiveMembership } = await importTs('lib/membership/policy.ts')
const migration = readFileSync('supabase/migrations/20261101145900_membership_exact_expiry.sql', 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'

test('the first expiry migration alone prevents an owner from forging, extending or clearing the new entitlement deadline', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,service_role;
    grant execute on function auth.uid() to authenticated,service_role;
    create table clients(client_id text primary key,auth_user_id uuid,full_name text,program text,access boolean,active boolean,verified_purchase boolean,subscription_ends_at date);
    alter table clients enable row level security;
    create policy owned_profile on clients for all to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
    grant select,insert,update on clients to authenticated;
    grant select,insert,update on clients to service_role;
    insert into clients values('OWN','${owner}','Original','ember',true,true,true,'2000-01-01'),('OTHER','${other}','Other','ignite',true,true,true,'2000-01-01');
  `)
  // This fixture deliberately applies neither commerce nor the later 160000
  // entitlement trigger. Column introduction and its write guard are atomic.
  await db.exec(migration)
  assert.equal((await db.query("select to_regprocedure('public.member_has_capability(text,text)') fn")).rows[0].fn, null)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner])
  await db.exec('set role authenticated')
  const record = async () => (await db.query("select to_jsonb(c) record from clients c where client_id='OWN'")).rows[0].record
  assert.equal((await record()).membership_expires_at, null)
  assert.equal(hasActiveMembership(await record(), new Date('2035-07-12T10:00:00Z')), false)
  await assert.rejects(db.query("update clients set membership_expires_at='2099-01-01T12:00Z' where client_id='OWN'"), /entitlement expiry/)
  assert.equal((await record()).membership_expires_at, null)
  assert.equal(hasActiveMembership(await record(), new Date('2035-07-12T10:00:00Z')), false)
  await db.query("update clients set full_name='Profile change' where client_id='OWN'")
  assert.equal((await record()).full_name, 'Profile change')
  assert.equal((await db.query("update clients set membership_expires_at='2099-01-01T12:00Z' where client_id='OTHER' returning client_id")).rows.length, 0)
  await assert.rejects(db.query(`insert into clients(client_id,auth_user_id,program,access,active,verified_purchase,membership_expires_at) values('FORGED',$1,'ember',true,true,true,'2099-01-01T12:00Z')`, [owner]), /entitlement expiry/)
  await db.exec('reset role; set role service_role')
  await db.query("update clients set membership_expires_at='2035-07-12T17:43:21.123Z' where client_id='OWN'")
  await db.exec('reset role; set role authenticated')
  const saved = await record()
  assert.equal(hasActiveMembership(saved, new Date('2035-07-12T17:43:21.122Z')), true)
  assert.equal(hasActiveMembership(saved, new Date('2035-07-12T17:43:21.123Z')), false)
  await assert.rejects(db.query("update clients set membership_expires_at='2099-01-01T12:00Z' where client_id='OWN'"), /entitlement expiry/)
  await assert.rejects(db.query("update clients set membership_expires_at=null where client_id='OWN'"), /entitlement expiry/)
  assert.equal((await record()).membership_expires_at, saved.membership_expires_at)
  assert.equal((await record()).subscription_ends_at, '2000-01-01')
})
