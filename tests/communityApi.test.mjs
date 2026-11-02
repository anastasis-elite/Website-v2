import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const mocks = {
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.communityFixture.requestDb',
  '@/lib/supabase/admin': 'export const createAdminClient = () => { globalThis.communityFixture.adminCreations++; return globalThis.communityFixture.adminDb }',
}
const feed = await importTs('app/api/community/posts/route.ts', mocks)
const publish = await importTs('app/api/community/posts/[id]/publish/route.ts', mocks)
const deletion = await importTs('app/api/community/posts/[id]/route.ts', mocks)
const reporting = await importTs('app/api/community/posts/[id]/report/route.ts', mocks)
const media = await importTs('app/api/community/posts/[id]/media/route.ts', mocks)
const { validCommunityMediaBytes } = await importTs('lib/community/server.ts', mocks)
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const request = (body, method = 'POST', suffix = '') => new Request(`http://qa.test/api/community/posts${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' || method === 'DELETE' ? {} : { body: JSON.stringify(body) }) })
const context = (postId = id) => ({ params: Promise.resolve({ id: postId }) })
const input = (overrides = {}) => ({ id, body: 'A real saved update', category: 'Progress', ...overrides })
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9])
const mp4 = new Uint8Array([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0])

function fixture(overrides = {}) {
  const state = {
    signedIn: true, userId: a, active: true, clientError: false, failCleanup: false, failInsert: false, failReport: false, failScrub: false,
    racePublishDelete: false, adminCreations: 0, writes: [], rows: [], reports: [], files: new Map(), ...overrides,
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.fixture.test'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fixture-public-key'
  state.proxyReads = []
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).host, 'storage.fixture.test')
    assert.equal(options.headers.Authorization, 'Bearer fixture-user-token')
    assert.equal(options.headers.apikey, 'fixture-public-key')
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store')
    const path = new URL(url).pathname.split('/community-media/')[1]
    const blob = state.files.get(path)
    state.proxyReads.push(options.headers.Range || null)
    if (!blob) return new Response(null, { status: 404 })
    const range = options.headers.Range
    if (!range) return new Response(blob, { headers: { 'Content-Length': String(blob.size) } })
    const [, startText, endText] = /^bytes=(\d*)-(\d*)$/.exec(range)
    const start = startText ? Number(startText) : Math.max(0, blob.size - Number(endText))
    const end = startText && endText ? Math.min(Number(endText), blob.size - 1) : blob.size - 1
    if (start >= blob.size || end < start) return new Response(null, { status: 416 })
    return new Response(blob.slice(start, end + 1), { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${blob.size}`, 'Content-Length': String(end - start + 1) } })
  }
  const client = () => ({ client_id: 'QA-A', auth_user_id: state.userId, full_name: 'Member A', program: 'ember', access: state.active, active: true, verified_purchase: false, subscription_ends_at: null })
  const tableRows = table => table === 'clients' ? [client()] : table === 'community_posts' ? state.rows : state.reports
  const canRead = (table, row, admin) => admin || table === 'clients' || (table === 'community_posts' && (row.status === 'published' && state.active || row.author_id === state.userId && ['draft', 'deleting'].includes(row.status)))
  function database(admin) {
    return {
      auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: state.userId } : null }, error: null }), getSession: async () => ({ data: { session: { access_token: 'fixture-user-token' } }, error: null }) },
      from(table) {
        assert.ok(['clients', 'community_posts', 'community_reports'].includes(table))
        const filters = [], orders = []
        let operation = 'read', payload, maximum, upsertOptions, cursorFilter = () => true
        const query = {
          select() { return query }, eq(key, value) { filters.push([key, value]); return query },
          order(key, { ascending }) { orders.push([key, ascending]); return query }, limit(value) { maximum = value; return query },
          or(expression) {
            const match = /^published_at\.lt\.(.+),and\(published_at\.eq\.(.+),id\.lt\.(.+)\)$/.exec(expression)
            assert.ok(match); assert.equal(match[1], match[2])
            cursorFilter = row => Date.parse(row.published_at) < Date.parse(match[1]) || Date.parse(row.published_at) === Date.parse(match[1]) && row.id < match[3]
            return query
          },
          insert(value) { assert.ok(admin); operation = 'insert'; payload = value; return query },
          update(value) { assert.ok(admin); operation = 'update'; payload = value; return query },
          upsert(value, options) { assert.ok(admin); operation = 'upsert'; payload = value; upsertOptions = options; return query },
          maybeSingle: async () => result(true), single: async () => result(true), then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject) },
        }
        function result(single) {
          if (table === 'clients' && state.clientError) return { data: null, error: { message: 'PRIVATE lookup problem' } }
          if (operation === 'insert') {
            if (state.failInsert) return { data: null, error: { message: 'PRIVATE insert problem' } }
            if (state.rows.some(row => row.id === payload.id)) return { data: null, error: { code: '23505' } }
            const row = { created_at: '2026-10-28T12:00:00Z', ...structuredClone(payload) }
            state.rows.push(row); state.writes.push(['insert', row.id]); return { data: structuredClone(row), error: null }
          }
          if (operation === 'upsert') {
            if (state.failReport) return { data: null, error: { message: 'PRIVATE report problem' } }
            assert.equal(upsertOptions.ignoreDuplicates, true)
            assert.equal(upsertOptions.onConflict, 'post_id,reporter_id')
            if (!state.reports.some(row => row.post_id === payload.post_id && row.reporter_id === payload.reporter_id)) state.reports.push(structuredClone(payload))
            return { data: null, error: null }
          }
          if (operation === 'update' && payload.status === 'published' && state.racePublishDelete) {
            state.rows.find(row => row.id === id).status = 'deleting'; state.racePublishDelete = false
          }
          if (operation === 'update' && payload.status === 'deleting' && state.failScrub) return { data: null, error: { message: 'PRIVATE scrub error' } }
          let rows = tableRows(table).filter(row => canRead(table, row, admin) && cursorFilter(row) && filters.every(([key, value]) => row[key] === value))
          if (operation === 'update') for (const row of rows) { Object.assign(row, structuredClone(payload)); state.writes.push(['update', row.id, row.status]) }
          rows = rows.slice().sort((a, b) => { for (const [key, ascending] of orders) if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1); return 0 }).slice(0, maximum)
          return { data: structuredClone(single ? rows[0] || null : rows), error: null }
        }
        return query
      },
      storage: { from(bucket) {
        assert.equal(bucket, 'community-media')
        return {
          async download(path) {
            const row = state.rows.find(row => row.media_path === path)
            if (!admin && (!row || !state.active || !canRead('community_posts', row, false))) return { data: null, error: { message: 'not allowed' } }
            return { data: state.files.get(path) || null, error: state.files.has(path) ? null : { message: 'missing' } }
          },
          async remove(paths) { assert.ok(admin); if (state.failCleanup) return { error: { message: 'PRIVATE cleanup error' } }; for (const path of paths) state.files.delete(path); return { error: null } },
        }
      } },
    }
  }
  state.requestDb = database(false); state.adminDb = database(true)
  globalThis.communityFixture = state
  return state
}

test('authenticated text posts persist across requests, replays recover the same post and changed payload cannot overwrite', async () => {
  const state = fixture()
  let response = await feed.POST(request(input()))
  assert.equal(response.status, 200); const first = await response.json()
  assert.equal(first.post.body, 'A real saved update'); assert.equal(first.post.authorName, 'Member A'); assert.equal(first.post.media, null)
  response = await feed.POST(request(input()))
  assert.deepEqual(await response.json(), first); assert.equal(state.rows.length, 1)
  response = await feed.GET(request(null, 'GET'))
  assert.deepEqual((await response.json()).posts, [first.post])
  response = await feed.POST(request(input({ body: 'Changed after an unknown request' })))
  assert.equal(response.status, 409); assert.equal(state.rows[0].body, input().body)
})

for (const [mimeType, bytes, extension, kind] of [['image/jpeg', jpeg, 'jpg', 'image'], ['video/mp4', mp4, 'mp4', 'video']]) {
  test(`${kind} reservation, actual-byte validation, publication and media Range delivery persist without duplicate retries`, async () => {
    const state = fixture()
    const payload = input({ body: '', media: { mimeType, size: bytes.length } })
    const reserved = await (await feed.POST(request(payload))).json()
    assert.equal(state.rows[0].status, 'draft'); assert.equal((await (await feed.GET(request(null, 'GET'))).json()).posts.length, 0)
    assert.equal(reserved.draft.mediaPath, `${a}/${id}/attachment.${extension}`)
    assert.equal((await publish.POST(request({}), context())).status, 409, 'not uploaded yet')
    state.files.set(reserved.draft.mediaPath, new Blob([bytes], { type: mimeType }))
    const published = await (await publish.POST(request({}), context())).json()
    assert.equal(published.post.media.type, kind); assert.equal(published.post.media.url, `/api/community/posts/${id}/media`)
    assert.equal((await publish.POST(request({}), context())).status, 200)
    assert.deepEqual(await (await feed.POST(request(payload))).json(), published)
    assert.equal(state.rows.length, 1); assert.equal(state.writes.filter(([operation]) => operation === 'insert').length, 1)
    const ranged = await media.GET(new Request('http://qa.test/media', { headers: { range: 'bytes=1-3' } }), context())
    assert.equal(ranged.status, 206); assert.equal(ranged.headers.get('Content-Range'), `bytes 1-3/${bytes.length}`)
    assert.deepEqual(new Uint8Array(await ranged.arrayBuffer()), bytes.slice(1, 4))
    assert.deepEqual(state.proxyReads, ['bytes=1-3'], 'Range forwarded to Storage rather than full object download')
    assert.equal((await media.GET(new Request('http://qa.test/media', { headers: { range: 'bytes=999-' } }), context())).status, 416)
    state.active = false
    assert.equal((await media.GET(new Request('http://qa.test/media'), context())).status, 403)
  })
}

test('invalid/oversized/HEIC descriptors and disguised media are rejected before publication', async () => {
  const state = fixture()
  for (const descriptor of [{ mimeType: 'image/heic', size: 20 }, { mimeType: 'text/html', size: 20 }, { mimeType: 'image/png', size: 10 * 1024 * 1024 + 1 }, { mimeType: 'video/mp4', size: 50 * 1024 * 1024 + 1 }, { mimeType: 'image/jpeg', size: 0 }]) assert.equal((await feed.POST(request(input({ media: descriptor })))).status, 400)
  assert.equal(state.rows.length, 0)
  const reserved = await (await feed.POST(request(input({ media: { mimeType: 'image/jpeg', size: jpeg.length } })))).json()
  state.files.set(reserved.draft.mediaPath, new Blob([new Uint8Array(jpeg.length)], { type: 'image/jpeg' }))
  assert.equal((await publish.POST(request({}), context())).status, 422); assert.equal(state.rows[0].status, 'draft')
  state.files.set(reserved.draft.mediaPath, new Blob([jpeg, jpeg], { type: 'image/jpeg' }))
  assert.equal((await publish.POST(request({}), context())).status, 422)
  const heic = mp4.slice(); heic.set([104, 101, 105, 99], 8)
  assert.equal(validCommunityMediaBytes(heic, 'video/mp4'), false)
  assert.equal(validCommunityMediaBytes(mp4, 'video/quicktime'), false)
})

test('unauthenticated/inactive requests and cross-author deletion never create privileged clients or change rows', async () => {
  const state = fixture({ signedIn: false })
  assert.equal((await feed.POST(request(input()))).status, 401); assert.equal((await feed.GET(request(null, 'GET'))).status, 401)
  assert.equal(state.adminCreations, 0)
  state.signedIn = true; state.active = false
  assert.equal((await feed.POST(request(input()))).status, 403); assert.equal(state.adminCreations, 0)
  state.active = true
  await feed.POST(request(input()))
  state.userId = b; const before = state.adminCreations
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 404)
  assert.equal((await publish.POST(request({}), context())).status, 404)
  assert.equal(state.adminCreations, before + 1, 'cleanup lookup is constrained to verified author even if member RLS hides row'); assert.equal(state.rows[0].status, 'published')
  assert.equal(state.rows[0].body, input().body); assert.equal(state.rows[0].author_name, 'Member A')
  const foreign = new Request('http://qa.test/api/community/posts', { method: 'POST', headers: { Origin: 'http://evil.test', 'Content-Type': 'application/json' }, body: JSON.stringify(input()) })
  assert.equal((await feed.POST(foreign)).status, 403)
})

test('canceled/failed uploads retain recoverable drafts; delete hides first, reports cleanup failure, and retries keep tombstones', async () => {
  const state = fixture()
  const payload = input({ media: { mimeType: 'image/jpeg', size: jpeg.length } })
  const reserved = await (await feed.POST(request(payload))).json()
  state.rows[0].created_at = '2026-01-01T00:00:00Z'
  state.rows[0].upload_active_until = '2026-01-01T00:15:00Z'
  assert.deepEqual(await (await feed.POST(request(payload))).json(), reserved, 'failed upload retries same reserved path')
  assert.ok(Date.parse(state.rows[0].upload_active_until) > Date.now() + 14 * 60_000, 'resuming an old draft renews its upload lease before returning the reservation')
  state.files.set(reserved.draft.mediaPath, new Blob([jpeg])); state.failCleanup = true
  let response = await deletion.DELETE(request(null, 'DELETE'), context())
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'CLEANUP_PENDING'); assert.equal(state.rows[0].status, 'deleting')
  assert.equal(state.rows[0].body, ''); assert.equal(state.rows[0].author_name, 'Community member'); assert.equal(state.rows[0].published_at, null)
  assert.equal(state.rows[0].media_path, reserved.draft.mediaPath, 'cleanup pointer survives storage failure')
  assert.equal((await publish.POST(request({}), context())).status, 409)
  state.active = false; state.failCleanup = false
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200, 'former member can finish own cleanup')
  assert.equal(state.files.size, 0); assert.equal(state.rows[0].status, 'deleting')
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200)
  state.active = true
  assert.equal((await feed.POST(request(payload))).status, 409, 'canceled id cannot resurrect')
})

test('delete wins over an in-flight publish; report persists once and backend failure is honest', async () => {
  const state = fixture()
  const reserved = await (await feed.POST(request(input({ media: { mimeType: 'image/jpeg', size: jpeg.length } })))).json()
  state.files.set(reserved.draft.mediaPath, new Blob([jpeg])); state.racePublishDelete = true
  assert.equal((await publish.POST(request({}), context())).status, 409); assert.equal(state.rows[0].status, 'deleting')
  await feed.POST(request(input({ id: other })))
  state.userId = b
  assert.equal((await reporting.POST(request({ reason: 'harassment' }), context(other))).status, 200)
  assert.equal((await reporting.POST(request({ reason: 'spam' }), context(other))).status, 200)
  assert.equal(state.reports.length, 1); assert.equal(state.reports[0].reason, 'harassment'); assert.equal(state.reports[0].reporter_id, b)
  assert.equal((await reporting.POST(request({ reason: 'other' }), context())).status, 404)
  assert.equal((await reporting.POST(request({ reason: 'invented' }), context(other))).status, 400)
  state.failReport = true
  const response = await reporting.POST(request({ reason: 'other' }), context(other))
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE'))
})

test('expired author can remove their own published post without receiving community content access', async () => {
  const state = fixture()
  const reserved = await (await feed.POST(request(input({ media: { mimeType: 'image/jpeg', size: jpeg.length } })))).json()
  state.files.set(reserved.draft.mediaPath, new Blob([jpeg]))
  assert.equal((await publish.POST(request({}), context())).status, 200)
  state.active = false
  assert.equal((await feed.GET(request(null, 'GET'))).status, 403)
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200)
  assert.equal(state.files.size, 0); assert.equal(state.rows[0].status, 'deleting')
})

test('discard after failed reservation creates private tombstone and blocks the late reservation retry', async () => {
  const state = fixture({ failInsert: true })
  assert.equal((await feed.POST(request(input()))).status, 503)
  assert.equal(state.rows.length, 0)
  state.failInsert = false
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200)
  assert.equal(state.rows.length, 1); assert.equal(state.rows[0].status, 'deleting')
  assert.equal(state.rows[0].body, ''); assert.equal(state.rows[0].author_name, 'Community member')
  assert.equal((await feed.POST(request(input()))).status, 409)
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200)
  assert.equal((await (await feed.GET(request(null, 'GET'))).json()).posts.length, 0)
})

test('author deletion clears published text and display details while retaining only a private retry tombstone', async () => {
  const state = fixture()
  const payload = input({ body: 'Personal text to remove', category: 'Struggle' })
  assert.equal((await feed.POST(request(payload))).status, 200)
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200)
  assert.equal(state.rows.length, 1, 'the submission id stays reserved against late retries')
  assert.deepEqual({ body: state.rows[0].body, name: state.rows[0].author_name, category: state.rows[0].category, time: state.rows[0].published_at, status: state.rows[0].status }, {
    body: '', name: 'Community member', category: 'Progress', time: null, status: 'deleting',
  })
  assert.equal(state.rows[0].author_id, a)
  assert.equal((await (await feed.GET(request(null, 'GET'))).json()).posts.length, 0)
  assert.equal((await feed.POST(request(payload))).status, 409, 'cleared text cannot be restored by replay')
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200)
  assert.equal(state.rows[0].body, '')
})

test('deletion retry scrubs old tombstone content and never reports success when content erasure fails', async () => {
  const state = fixture()
  const reserved = await (await feed.POST(request(input({ media: { mimeType: 'image/jpeg', size: jpeg.length } })))).json()
  state.files.set(reserved.draft.mediaPath, new Blob([jpeg]))
  state.rows[0].status = 'deleting'
  state.rows[0].author_name = 'Old retained name'
  state.rows[0].category = 'Struggle'
  state.rows[0].published_at = '2026-10-28T12:00:00Z'
  state.failScrub = true
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 503)
  assert.equal(state.rows[0].body, input().body)
  assert.equal(state.files.size, 1, 'storage cleanup does not conceal a failed content erasure')
  state.failScrub = false
  state.failCleanup = true
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 503)
  assert.equal(state.rows[0].body, ''); assert.equal(state.rows[0].author_name, 'Community member'); assert.equal(state.rows[0].published_at, null)
  assert.equal(state.files.size, 1)
  state.failCleanup = false
  assert.equal((await deletion.DELETE(request(null, 'DELETE'), context())).status, 200)
  assert.equal(state.files.size, 0); assert.equal(state.rows[0].body, '')
})

test('invalid body/id/cursor and unavailable backend produce errors without fabricated posts', async () => {
  const state = fixture()
  for (const payload of [input({ id: '../../foreign' }), input({ body: 'x'.repeat(3001) }), input({ body: ' ' }), input({ category: 'Fake' })]) assert.equal((await feed.POST(request(payload))).status, 400)
  assert.equal((await feed.GET(new Request('http://qa.test/api/community/posts?cursor=bad'))).status, 400)
  state.failInsert = true
  const response = await feed.POST(request(input()))
  assert.equal(response.status, 503); assert.equal(state.rows.length, 0); assert.ok(!(await response.text()).includes('PRIVATE'))
})

test('feed pagination accepts PostgREST timestamp offsets and preserves ordering without repeating a post', async () => {
  const state = fixture()
  for (let index = 0; index < 21; index++) state.rows.push({ id: `${(index + 1).toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, author_id: a, author_name: 'Member', category: 'Wins', body: 'Saved', status: 'published', media_path: null, published_at: '2026-10-28T12:00:00+00:00' })
  const first = await (await feed.GET(request(null, 'GET'))).json()
  assert.equal(first.posts.length, 20); assert.ok(first.nextCursor)
  const response = await feed.GET(new Request(`http://qa.test/api/community/posts?cursor=${encodeURIComponent(first.nextCursor)}`))
  assert.equal(response.status, 200)
  const second = await response.json()
  assert.equal(second.posts.length, 1); assert.equal(second.nextCursor, null)
  assert.ok(!first.posts.some(post => post.id === second.posts[0].id))
})
