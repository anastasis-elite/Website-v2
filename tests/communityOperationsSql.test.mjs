import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const operator = '33333333-3333-4333-8333-333333333333'
const post = n => `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${n}`
const path = n => `${owner}/${post(n)}/attachment.jpg`

async function fixture({ legacyDeleting = false } = {}) {
  const db = new PGlite()
  await db.exec(`
    create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table public.clients(client_id text primary key,auth_user_id uuid,program text,
      access boolean,active boolean,verified_purchase boolean,subscription_ends_at date);
    alter table clients enable row level security;
    grant select on clients to authenticated;
    create policy own_client on clients for select to authenticated
      using(auth_user_id=(select auth.uid()));
    create schema storage;
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,
      name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
    create policy legacy_storage on storage.objects for all using(true) with check(true);
  `)
  for (const id of [owner,other,operator]) await db.query('insert into auth.users values($1)', [id])
  await db.query("insert into clients values('owner',$1,'ember',true,true,false,null),('other',$2,'ignite',true,true,false,null)", [owner,other])
  await db.exec(readFileSync('docs/sql/community-posts-storage-review.sql', 'utf8'))
  if (legacyDeleting) {
    await db.query(`insert into community_posts(id,author_id,author_name,category,body,status,created_at)
      values($1,$2,'Community member','Progress','','deleting',now()-interval '30 days')`, [post(1),owner])
  }
  await db.exec(readFileSync('docs/sql/community-operations-review.sql', 'utf8'))
  return db
}

async function as(db, role, id = null) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ''])
  await db.exec(`set role ${role}`)
}

async function addPost(db, n, author = owner) {
  await db.query(`insert into community_posts(id,author_id,author_name,category,body,status,
    media_path,media_type,media_mime,media_size)
    values($1,$2,'Member','Progress','Saved text','draft',$3,'image','image/jpeg',8)`,
  [post(n),author,`${author}/${post(n)}/attachment.jpg`])
}

async function hold(db) {
  await db.query('insert into community_cleanup_holds(author_id,requested_by,request_reference) values($1,$2,$3)', [owner,operator,'Verified support request 42'])
}

test('hold blocks new reservations and publication even through the privileged server role', async () => {
  const db = await fixture()
  try {
    await as(db, 'service_role')
    await addPost(db, 1)
    await hold(db)
    await assert.rejects(addPost(db, 2), /cleanup is in progress/)
    await assert.rejects(db.query("insert into community_posts(id,author_id,author_name,category,body,status) values($1,$2,'Community member','Progress','','deleting')", [post(2),owner]), /cleanup is in progress/)
    await assert.rejects(db.query("update community_posts set status='published',published_at=now() where id=$1", [post(1)]), /cleanup is in progress/)
    await addPost(db, 3, other)
    await assert.rejects(db.query('update community_posts set author_id=$1 where id=$2', [other,post(1)]), /owner cannot change/)
    const guards = (await db.query(`select p.provolatile,p.prosecdef,p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='community_private' and p.proname in ('guard_post_cleanup','guard_cleanup_hold')`)).rows
    assert.equal(guards.length, 2)
    for (const guard of guards) {
      assert.equal(guard.provolatile, 'v', 'separate queries after advisory lock use fresh READ COMMITTED snapshots')
      assert.equal(guard.prosecdef, true)
      assert.ok(guard.proconfig.includes('search_path=""'))
    }
  } finally { await db.close() }
})

test('holds deny exact reserved uploads without leaking hold records or expanding member permissions', async () => {
  const db = await fixture()
  try {
    await addPost(db, 1)
    await addPost(db, 2)
    await as(db, 'authenticated', owner)
    assert.equal((await db.query('select community_private.current_author_held() as held')).rows[0].held, false)
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('community-media',$1,$2)", [path(1),{mimetype:'image/jpeg',size:8}])
    await as(db, 'service_role')
    await hold(db)
    await as(db, 'authenticated', owner)
    assert.equal((await db.query('select community_private.current_author_held() as held')).rows[0].held, true)
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name,metadata) values('community-media',$1,$2)", [path(2),{mimetype:'image/jpeg',size:8}]), /row-level security/)
    await assert.rejects(db.query('select * from community_cleanup_holds'), /permission denied/)
    await assert.rejects(db.query('delete from community_cleanup_holds'), /permission denied/)
    await assert.rejects(db.query('select * from community_reports'), /permission denied/)
    await assert.rejects(db.query("update community_posts set status='deleting' where id=$1", [post(1)]), /permission denied/)
    await as(db, 'authenticated', other)
    assert.equal((await db.query('select community_private.current_author_held() as held')).rows[0].held, false)
    await as(db, 'anon')
    await assert.rejects(db.query('select community_private.current_author_held()'), /permission denied/)
    await assert.rejects(db.query('select * from community_cleanup_holds'), /permission denied/)
  } finally { await db.close() }
})

test('cleanup scrubs, stamps and removes only existing tombstones while retaining the author hold', async () => {
  const db = await fixture()
  try {
    await as(db, 'service_role')
    await addPost(db, 1)
    await hold(db)
    await db.query("update community_posts set status='deleting',body='',author_name='Community member',category='Progress',published_at=null where id=$1", [post(1)])
    const first = (await db.query('select * from community_posts where id=$1', [post(1)])).rows[0]
    assert.ok(first.cleanup_marked_at)
    assert.equal(first.media_cleaned_at, null)
    assert.equal(first.body, '')
    await db.query("update community_posts set cleanup_marked_at='2000-01-01',media_cleaned_at=now() where id=$1", [post(1)])
    const retry = (await db.query('select * from community_posts where id=$1', [post(1)])).rows[0]
    assert.equal(new Date(retry.cleanup_marked_at).toISOString(), new Date(first.cleanup_marked_at).toISOString(), 'caller cannot backdate drain start')
    assert.ok(retry.media_cleaned_at)
    await assert.rejects(db.query("update community_posts set status='published',body='Revive',published_at=now() where id=$1", [post(1)]), /cleanup is in progress/)
    await assert.rejects(db.query("update community_cleanup_holds set started_at='2000-01-01' where author_id=$1", [owner]), /immutable/)
    await db.exec('reset role')
    await assert.rejects(db.query('delete from auth.users where id=$1', [owner]), /foreign key/)
    await as(db, 'service_role')
    await db.query('delete from community_posts where id=$1 and author_id=$2', [post(1),owner])
    assert.equal((await db.query('select * from community_cleanup_holds where author_id=$1', [owner])).rows.length, 1)
    await assert.rejects(addPost(db, 2), /cleanup is in progress/)
    await db.exec('reset role')
    assert.equal((await db.query('select * from auth.users where id=$1', [owner])).rows.length, 1, 'community cleanup does not delete the auth account')
  } finally { await db.close() }
})

test('tombstones cannot be republished even when an author has no account cleanup hold', async () => {
  const db = await fixture()
  try {
    await as(db, 'service_role')
    await addPost(db, 1)
    await db.query("update community_posts set status='deleting',body='',author_name='Community member',category='Progress',published_at=null where id=$1", [post(1)])
    await assert.rejects(db.query("update community_posts set status='published',body='Revive',published_at=now() where id=$1", [post(1)]), /cannot be republished/)
  } finally { await db.close() }
})

test('installing operations backfills earlier tombstones with a fresh protected drain interval', async () => {
  const installedAfter = Date.now()
  const db = await fixture({legacyDeleting: true})
  try {
    await as(db, 'service_role')
    const row = (await db.query('select * from community_posts where id=$1', [post(1)])).rows[0]
    const markedAt = new Date(row.cleanup_marked_at).getTime()
    assert.ok(markedAt >= installedAfter && markedAt <= Date.now(), 'guard stamps installation time rather than old creation time')
    assert.equal(row.media_cleaned_at, null)
    assert.equal(row.upload_active_until, null)
    assert.equal((await db.query(`select id from community_posts where status='deleting'
      and cleanup_marked_at <= now()-interval '24 hours'`)).rows.length, 0, 'fresh backfill is protected by drain interval')
    await db.query("update community_posts set cleanup_marked_at='2000-01-01' where id=$1", [post(1)])
    const retry = (await db.query('select cleanup_marked_at from community_posts where id=$1', [post(1)])).rows[0]
    assert.equal(new Date(retry.cleanup_marked_at).getTime(), markedAt, 'trusted start cannot be backdated')
    const future = await db.query(`select id from community_posts where status='deleting'
      and cleanup_marked_at <= ($1::timestamptz + interval '25 hours')-interval '24 hours'`, [new Date(markedAt).toISOString()])
    assert.deepEqual(future.rows.map(candidate => candidate.id), [post(1)], 'tombstone becomes eligible after grace instead of remaining excluded forever')
  } finally { await db.close() }
})

test('abandoned draft cleanup protects an old draft with an active upload lease and rechecks a racing renewal', async () => {
  const db = await fixture()
  try {
    await as(db, 'service_role')
    await addPost(db, 1)
    await addPost(db, 2)
    await db.query("update community_posts set created_at=now()-interval '8 days' where id in ($1,$2)", [post(1),post(2)])
    await db.query("update community_posts set upload_active_until=now()-interval '1 minute' where id=$1", [post(2)])
    const lease = (await db.query('select upload_active_until from community_posts where id=$1', [post(1)])).rows[0].upload_active_until
    assert.ok(new Date(lease).getTime() > Date.now(), 'new reservations have an active lease')
    const candidates = await db.query(`select id from community_posts where status='draft'
      and created_at < now()-interval '7 days'
      and (upload_active_until is null or upload_active_until <= now())`)
    assert.deepEqual(candidates.rows.map(row => row.id), [post(2)], 'old active upload is protected')
    // The cleaner read an eligible old draft. A resumed composer renews the
    // lease before the cleaner can perform its conditional scrubbing update.
    await db.query("update community_posts set upload_active_until=now()+interval '15 minutes' where id=$1 and status='draft'", [post(2)])
    const lostRace = await db.query(`update community_posts set status='deleting',body='',
      author_name='Community member',category='Progress',published_at=null
      where id=$1 and status='draft' and created_at < now()-interval '7 days'
      and (upload_active_until is null or upload_active_until <= now()) returning id`, [post(2)])
    assert.equal(lostRace.rows.length, 0, 'conditional scrub respects the latest lease')
    await as(db, 'authenticated', owner)
    assert.equal((await db.query('select community_private.can_upload_media($1,$2) as allowed', [path(2),{mimetype:'image/jpeg',size:8}])).rows[0].allowed, true)
    await as(db, 'service_role')
    await db.query("update community_posts set upload_active_until=now()-interval '1 minute' where id=$1", [post(2)])
    await as(db, 'authenticated', owner)
    assert.equal((await db.query('select community_private.can_upload_media($1,$2) as allowed', [path(2),{mimetype:'image/jpeg',size:8}])).rows[0].allowed, false, 'expired reservation cannot start another direct upload')
    await as(db, 'service_role')
    const expired = await db.query(`update community_posts set status='deleting',body='',
      author_name='Community member',category='Progress',published_at=null
      where id=$1 and status='draft' and created_at < now()-interval '7 days'
      and (upload_active_until is null or upload_active_until <= now()) returning upload_active_until`, [post(2)])
    assert.equal(expired.rows.length, 1)
    assert.equal(expired.rows[0].upload_active_until, null)
  } finally { await db.close() }
})

test('report review defaults private and requires complete bounded resolution metadata', async () => {
  const db = await fixture()
  try {
    await as(db, 'service_role')
    await addPost(db, 1)
    await db.query("insert into community_reports(post_id,reporter_id,reason) values($1,$2,'unsafe')", [post(1),other])
    const report = (await db.query('select * from community_reports')).rows[0]
    assert.equal(report.status, 'open')
    assert.equal(report.review_note, '')
    assert.equal(report.reviewed_at, null)
    await assert.rejects(db.query("update community_reports set status='dismissed'"), /community_report_review_metadata/)
    await assert.rejects(db.query("update community_reports set status='invalid'"), /check constraint/)
    await assert.rejects(db.query("update community_reports set status='dismissed',reviewed_at=now(),reviewed_by=$1,review_note=$2", [operator,'x'.repeat(501)]), /community_report_review_note/)
    await db.query("update community_reports set status='dismissed',reviewed_at=now(),reviewed_by=$1,review_note='Reviewed; no removal needed'", [operator])
    assert.equal((await db.query('select status from community_reports')).rows[0].status, 'dismissed')
    assert.equal((await db.query('select status from community_posts')).rows[0].status, 'draft', 'review alone never republishes or fabricates a post state')
    await as(db, 'authenticated', owner)
    await assert.rejects(db.query('select * from community_reports'), /permission denied/)
    await assert.rejects(db.query("update community_reports set status='removed'"), /permission denied/)
  } finally { await db.close() }
})

test('a reporter cleanup hold prevents new reports while operator review and scoped removal remain available', async () => {
  const db = await fixture()
  try {
    await as(db, 'service_role')
    await addPost(db, 1, other)
    await addPost(db, 2, other)
    await db.query("insert into community_reports(post_id,reporter_id,reason) values($1,$2,'unsafe')", [post(1),owner])
    await hold(db)
    await assert.rejects(db.query("insert into community_reports(post_id,reporter_id,reason) values($1,$2,'spam')", [post(2),owner]), /cleanup is in progress for this reporter/)
    await db.query("update community_reports set status='dismissed',reviewed_at=now(),reviewed_by=$1,review_note='Reviewed during cleanup' where reporter_id=$2", [operator,owner])
    assert.equal((await db.query('select status from community_reports where reporter_id=$1', [owner])).rows[0].status, 'dismissed')
    await db.query("insert into community_reports(post_id,reporter_id,reason) values($1,$2,'other')", [post(2),other])
    await db.query('delete from community_reports where reporter_id=$1', [owner])
    assert.deepEqual((await db.query('select reporter_id from community_reports')).rows.map(row => row.reporter_id), [other], 'cleanup removes only held reporter data')
    const guard = (await db.query(`select p.provolatile,p.prosecdef,p.proconfig from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='community_private' and p.proname='guard_report_cleanup'`)).rows[0]
    assert.equal(guard.provolatile, 'v')
    assert.equal(guard.prosecdef, true)
    assert.ok(guard.proconfig.includes('search_path=""'))
  } finally { await db.close() }
})
