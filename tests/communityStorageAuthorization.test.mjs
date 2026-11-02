import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const user = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
const postId = (n) => `a000000${n}-0000-4000-8000-00000000000${n}`
const pathFor = (owner, id, extension = 'jpg') => `${owner}/${id}/attachment.${extension}`

async function fixture() {
  const db = new PGlite()
  await db.exec(`
    create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table public.clients(client_id text primary key, auth_user_id uuid, program text,
      access boolean, active boolean, verified_purchase boolean, subscription_ends_at date);
    alter table clients enable row level security;
    create policy own_client on clients for select to authenticated using (auth_user_id=(select auth.uid()));
    grant select on clients to authenticated;
    create schema storage;
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,
      name text not null,metadata jsonb, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
    -- A deliberately broad legacy policy must not open the community bucket.
    create policy historical_broad_storage on storage.objects for all using(true) with check(true);
  `)
  for (let n = 1; n <= 9; n++) await db.query('insert into auth.users values ($1)', [user(n)])
  await db.query(`insert into clients values
    ('gifted',$1,'ember',true,true,false,null),
    ('paid',$2,'IGNITE',true,true,true,'2099-01-01'),
    ('expired',$3,'phoenix',true,true,true,'2000-01-01'),
    ('revoked',$4,'ember',false,true,false,null),
    ('free',$5,'free',true,true,false,null),
    ('inactive',$6,'ember',true,false,false,null),
    ('paid-without-end',$7,'ignite',true,true,true,null),
    ('null-active-gift',$8,'phoenix',true,null,false,null)`, Array.from({ length: 8 }, (_, n) => user(n + 1)))
  await db.exec(readFileSync('docs/sql/community-posts-storage-review.sql', 'utf8'))
  return db
}

async function as(db, owner, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner || ''])
  await db.exec(`set role ${role}`)
}

async function addPost(db, n, owner, status = 'published', extension = 'jpg') {
  await db.exec('reset role')
  const mime = extension === 'png' ? 'image/png' : 'image/jpeg'
  await db.query(`insert into community_posts(id,author_id,author_name,category,body,status,media_path,media_type,media_mime,media_size,published_at)
    values ($1,$2,case when $3='deleting' then 'Community member' else 'Member' end,'Progress',case when $3='deleting' then '' else 'Saved post' end,$3,$4,'image',$5,8,case when $3='published' then now() else null end)`,
  [postId(n), owner, status, pathFor(owner, postId(n), extension), mime])
}

test('community audience matches existing membership while owner cleanup stays available after expiry', async () => {
  const db = await fixture()
  try {
    await addPost(db, 1, user(1))
    await addPost(db, 2, user(1), 'draft')
    await addPost(db, 3, user(1), 'deleting')
    await addPost(db, 4, user(3), 'draft')
    await addPost(db, 5, user(3), 'published')
    for (const [n, expected] of [[1,true],[2,true],[3,false],[4,false],[5,false],[6,false],[7,false],[8,true],[9,false]]) {
      await as(db, user(n))
      assert.equal((await db.query('select community_private.has_member_access() as allowed')).rows[0].allowed, expected, `member ${n}`)
      const rows = (await db.query('select id,status from community_posts order by id')).rows
      assert.equal(rows.filter((row) => row.status === 'published').length, expected ? 2 : 0, `audience ${n}`)
      assert.equal(rows.filter((row) => row.status !== 'published').length, n === 1 ? 2 : n === 3 ? 1 : 0, `cleanup ${n}`)
    }
    await as(db, user(1))
    await assert.rejects(db.query('update community_posts set status=\'published\' where id=$1', [postId(2)]), /permission denied/)
    await assert.rejects(db.query('delete from community_posts where id=$1', [postId(1)]), /permission denied/)
    await assert.rejects(db.query('insert into community_posts(id,author_id,author_name,category,body) values($1,$2,\'Fake\',\'Wins\',\'Bypass\')', [postId(6),user(1)]), /permission denied/)
    await assert.rejects(db.query('select * from community_reports'), /permission denied/)
    await as(db, null, 'anon')
    await assert.rejects(db.query('select * from community_posts'), /permission denied/)

    // DATE expiry is UTC midnight even when the SQL session uses another zone.
    await db.exec('reset role')
    await db.exec("set timezone='America/Los_Angeles'")
    await db.query("update clients set subscription_ends_at=(now() at time zone 'UTC')::date where auth_user_id=$1", [user(1)])
    await as(db, user(1))
    assert.equal((await db.query('select community_private.has_member_access() as allowed')).rows[0].allowed, false)
  } finally { await db.close() }
})

test('private storage restricts published reads and exact draft uploads despite a broad legacy policy', async () => {
  const db = await fixture()
  try {
    await addPost(db, 1, user(1))
    await addPost(db, 2, user(1), 'draft', 'png')
    await addPost(db, 3, user(1), 'deleting')
    await addPost(db, 4, user(2), 'draft')
    await addPost(db, 5, user(1), 'draft')
    await db.exec('reset role')
    for (const [owner,n,extension] of [[user(1),1,'jpg'],[user(1),3,'jpg'],[user(2),4,'jpg']]) {
      await db.query('insert into storage.objects(bucket_id,name,metadata) values(\'community-media\',$1,$2)', [pathFor(owner,postId(n),extension),{ mimetype:'image/jpeg',size:8 }])
    }
    await db.query('insert into storage.objects(bucket_id,name) values(\'community-media\',\'unreserved-object\'),(\'other-bucket\',\'existing-access\')')
    await as(db, user(2))
    assert.deepEqual((await db.query("select name from storage.objects where bucket_id='community-media' order by name")).rows.map((row) => row.name), [pathFor(user(1),postId(1)),pathFor(user(2),postId(4))])
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values(\'community-media\',$1)', [pathFor(user(1),postId(2),'png')]), /row-level security/)
    await as(db, user(1))
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values(\'community-media\',\'unreserved-path\')'), /row-level security/)
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name,metadata) values(\'community-media\',$1,$2)', [pathFor(user(1),postId(2),'png'),{ mimetype:'video/mp4',size:8 }]), /row-level security/)
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name,metadata) values(\'community-media\',$1,$2)', [pathFor(user(1),postId(2),'png'),{ mimetype:'image/png',size:99 }]), /row-level security/)
    await db.query('insert into storage.objects(bucket_id,name,metadata) values(\'community-media\',$1,$2)', [pathFor(user(1),postId(2),'png'),{ mimetype:'image/png',size:8 }])
    // Storage's preliminary insert probe can legitimately omit metadata.
    await db.query('insert into storage.objects(bucket_id,name) values(\'community-media\',$1)', [pathFor(user(1),postId(5))])
    assert.equal((await db.query("update storage.objects set metadata='{}' where bucket_id='community-media' returning name")).rows.length, 0)
    assert.equal((await db.query("delete from storage.objects where bucket_id='community-media' returning name")).rows.length, 0)
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values(\'community-media\',$1)', [pathFor(user(1),postId(3))]), /row-level security/)
    await db.exec('reset role')
    await db.query('update clients set access=false where auth_user_id=$1', [user(1)])
    await as(db, user(1))
    assert.equal((await db.query("select * from storage.objects where bucket_id='community-media'")).rows.length, 0)
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values(\'community-media\',$1)', [pathFor(user(1),postId(2),'png')]), /row-level security/)
    await as(db, null, 'anon')
    assert.equal((await db.query("select * from storage.objects where bucket_id='community-media'")).rows.length, 0)
    assert.equal((await db.query("select * from storage.objects where bucket_id='other-bucket'")).rows.length, 1, 'other buckets preserve historical behavior')
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values(\'community-media\',\'anonymous\')'), /row-level security/)
  } finally { await db.close() }
})

test('trusted lifecycle is constrained to one valid attachment, persistent reports and account cleanup', async () => {
  const db = await fixture()
  try {
    const valid = [postId(1),user(1),'Member','Questions','', 'draft',pathFor(user(1),postId(1),'png'),'image','image/png',8]
    const insert = 'insert into community_posts(id,author_id,author_name,category,body,status,media_path,media_type,media_mime,media_size) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)'
    await db.query(insert, valid)
    const invalid = [
      { 0:postId(2), 6:pathFor(user(2),postId(2),'png') },
      { 0:postId(2), 6:pathFor(user(1),postId(2),'png'), 9:10485761 },
      { 0:postId(2), 6:pathFor(user(1),postId(2),'heic'), 8:'image/heic' },
      { 0:postId(2), 6:pathFor(user(1),postId(2),'png'), 5:'published' },
      { 0:postId(2), 6:pathFor(user(1),postId(2),'png'), 4:'x'.repeat(3001) },
    ]
    for (const overrides of invalid) {
      const values = [...valid]
      Object.entries(overrides).forEach(([index,value]) => { values[Number(index)] = value })
      await assert.rejects(db.query(insert, values), /check constraint/)
    }
    await db.query('insert into community_reports(post_id,reporter_id,reason) values($1,$2,\'unsafe\')', [postId(1),user(2)])
    await assert.rejects(db.query('insert into community_reports(post_id,reporter_id,reason) values($1,$2,\'spam\')', [postId(1),user(2)]), /duplicate key/)
    await assert.rejects(db.query('delete from auth.users where id=$1', [user(1)]), /foreign key/)
    await db.query('delete from auth.users where id=$1', [user(2)])
    assert.equal((await db.query('select * from community_reports')).rows.length, 0)
  } finally { await db.close() }
})

test('deleted content is empty, media is inaccessible and account restriction prevents orphaning private cleanup paths', async () => {
  const db = await fixture()
  try {
    await addPost(db, 1, user(1))
    await db.query('insert into storage.objects(bucket_id,name,metadata) values(\'community-media\',$1,$2)', [pathFor(user(1),postId(1)),{ mimetype:'image/jpeg',size:8 }])
    await assert.rejects(db.query("update community_posts set status='deleting' where id=$1", [postId(1)]), /community_post_deleted_content/)
    await db.query("update community_posts set status='deleting',body='',author_name='Community member',category='Progress',published_at=null where id=$1", [postId(1)])
    const tombstone = (await db.query('select * from community_posts where id=$1', [postId(1)])).rows[0]
    assert.equal(tombstone.body, ''); assert.equal(tombstone.author_name, 'Community member'); assert.equal(tombstone.published_at, null)
    assert.equal(tombstone.media_path, pathFor(user(1),postId(1)))
    for (const change of ["body='Retained text'", "author_name='Retained name'", "category='Struggle'", 'published_at=now()']) {
      await assert.rejects(db.query(`update community_posts set ${change} where id=$1`, [postId(1)]), /community_post_deleted_content/)
    }
    await db.query("insert into community_posts(id,author_id,author_name,category,body,status) values($1,$2,'Community member','Progress','','deleting')", [postId(2),user(1)])
    await as(db, user(1))
    assert.equal((await db.query('select body from community_posts where id=$1', [postId(1)])).rows[0].body, '')
    assert.equal((await db.query("select * from storage.objects where bucket_id='community-media'")).rows.length, 0, 'owner cannot recover failed-cleanup media')
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('community-media',$1)", [pathFor(user(1),postId(1))]), /row-level security/)
    await as(db, user(2))
    assert.equal((await db.query('select * from community_posts where id=$1', [postId(1)])).rows.length, 0)
    assert.equal((await db.query("select * from storage.objects where bucket_id='community-media'")).rows.length, 0)
    await db.exec('reset role')
    await assert.rejects(db.query('delete from auth.users where id=$1', [user(1)]), /foreign key/)
    assert.equal((await db.query("select * from storage.objects where bucket_id='community-media'")).rows.length, 1, 'restriction leaves private cleanup metadata intact')
  } finally { await db.close() }
})
