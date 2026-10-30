import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const mocks = {
  '@/lib/aos/getAOSAdminUser': 'export const getAOSAdminUser = async () => globalThis.communityOperationsFixture.operator',
  '@/lib/supabase/admin': 'export const createAdminClient = () => { globalThis.communityOperationsFixture.adminCreations++; return globalThis.communityOperationsFixture.db }',
  '@/lib/supabase/server': 'export const createClient = async () => { throw new Error("Member transport must not authorize operator actions") }',
  '@/lib/auth/rateLimit': 'export const enforceRateLimit = async () => true',
}
const operatorId = '99999999-9999-4999-8999-999999999999'
const authorId = '11111111-1111-4111-8111-111111111111'
const otherAuthor = '22222222-2222-4222-8222-222222222222'
const postId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const reporterId = '33333333-3333-4333-8333-333333333333'
const ago = hours => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
const pathFor = (owner = authorId, id = postId) => `${owner}/${id}/attachment.jpg`
const post = (overrides = {}) => ({
  id: postId, author_id: authorId, author_name: 'Member A', category: 'Progress', body: 'Saved member content',
  status: 'published', media_path: pathFor(), media_type: 'image', media_mime: 'image/jpeg', media_size: 8,
  created_at: ago(240), published_at: ago(239), cleanup_marked_at: null, media_cleaned_at: null, upload_active_until: null, ...overrides,
})
const report = (overrides = {}) => ({ post_id: postId, reporter_id: reporterId, reason: 'unsafe', created_at: ago(2), status: 'open', reviewed_at: null, reviewed_by: null, review_note: '', ...overrides })
function request(body, { method = 'POST', endpoint = 'cleanup', query = '', origin = 'http://qa.test' } = {}) {
  return new Request(`http://qa.test/api/admin/community/${endpoint}${query}`, {
    method, headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  })
}
const account = (action = 'preview', overrides = {}) => ({ operation: 'account', action, authorId, ...overrides })
const cleanAccount = (overrides = {}) => account('clean', { verifiedRequest: true, requestReference: 'request-verified-123', confirmation: `CLEAN COMMUNITY ${authorId}`, ...overrides })
const finalizeAccount = (overrides = {}) => account('finalize', { storageDrainVerified: true, confirmation: `FINALIZE COMMUNITY ${authorId}`, ...overrides })
const split = expression => {
  const result = []; let depth = 0, start = 0
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] === '(') depth++
    else if (expression[i] === ')') depth--
    else if (expression[i] === ',' && depth === 0) { result.push(expression.slice(start, i)); start = i + 1 }
  }
  result.push(expression.slice(start)); return result
}
function matches(expression, row) {
  if (expression.startsWith('and(') && expression.endsWith(')')) return split(expression.slice(4, -1)).every(value => matches(value, row))
  if (expression.startsWith('or(') && expression.endsWith(')')) return split(expression.slice(3, -1)).some(value => matches(value, row))
  const value = /^([a-z_]+)\.(eq|neq|lt|lte|gt|gte|is)\.(.*)$/.exec(expression)
  assert.ok(value, `Unexpected disposable PostgREST filter: ${expression}`)
  const [, key, operation, text] = value
  const expected = text === 'null' ? null : text
  const actual = row[key]
  return operation === 'eq' ? actual === expected : operation === 'neq' ? actual !== expected : operation === 'is' ? actual === expected : operation === 'lt' ? actual < expected : operation === 'lte' ? actual <= expected : operation === 'gt' ? actual > expected : actual >= expected
}
function fixture(overrides = {}) {
  const state = {
    operator: { id: operatorId }, adminCreations: 0, posts: [], reports: [], holds: [], writes: [], storageCalls: [],
    files: new Map(), failRemoval: false, failList: false, failScrub: false, ...overrides,
  }
  const tableRows = table => table === 'community_posts' ? state.posts : table === 'community_reports' ? state.reports : table === 'community_cleanup_holds' ? state.holds : null
  state.db = {
    auth: { admin: { deleteUser() { throw new Error('Community operators must not delete auth accounts') } } },
    from(table) {
      assert.ok(tableRows(table), `Operator touched unexpected table ${table}`)
      const filters = [], orders = []
      let operation = 'read', payload, maximum, minimum = 0, columns = '*', countRequested = false, head = false, options
      const query = {
        select(value = '*', settings = {}) { columns = value; countRequested = settings.count === 'exact'; head = settings.head; return query },
        eq(key, value) { filters.push(row => row[key] === value); return query },
        neq(key, value) { filters.push(row => row[key] !== value); return query },
        is(key, value) { filters.push(row => row[key] === value); return query },
        not(key, condition, value) { assert.equal(condition, 'is'); filters.push(row => row[key] !== value); return query },
        in(key, values) { filters.push(row => values.includes(row[key])); return query },
        lt(key, value) { filters.push(row => row[key] < value); return query },
        lte(key, value) { filters.push(row => row[key] <= value); return query },
        gt(key, value) { filters.push(row => row[key] > value); return query },
        gte(key, value) { filters.push(row => row[key] >= value); return query },
        or(expression) { filters.push(row => split(expression).some(part => matches(part, row))); return query },
        order(key, settings = {}) { orders.push([key, settings.ascending !== false]); return query },
        limit(value) { maximum = value; return query },
        range(start, end) { minimum = start; maximum = end - start + 1; return query },
        insert(value) { operation = 'insert'; payload = value; return query },
        upsert(value, settings) { operation = 'upsert'; payload = value; options = settings; return query },
        update(value) { operation = 'update'; payload = value; return query },
        delete() { operation = 'delete'; return query },
        maybeSingle: async () => result(true), single: async () => result(true),
        then(resolve, reject) { return Promise.resolve().then(() => result(false)).then(resolve, reject) },
      }
      function result(single) {
        const source = tableRows(table)
        if (operation === 'insert' || operation === 'upsert') {
          const values = Array.isArray(payload) ? payload : [payload]
          const saved = []
          for (const value of values) {
            const existing = source.find(row => table === 'community_cleanup_holds' ? row.author_id === value.author_id : table === 'community_posts' ? row.id === value.id : row.post_id === value.post_id && row.reporter_id === value.reporter_id)
            if (existing) {
              if (operation === 'insert') return { data: null, error: { code: '23505' } }
              if (!options?.ignoreDuplicates) Object.assign(existing, structuredClone(value))
              saved.push(existing)
            } else {
              const row = { started_at: new Date().toISOString(), created_at: new Date().toISOString(), ...structuredClone(value) }
              source.push(row); saved.push(row)
              state.writes.push({ table, operation, payload: structuredClone(value) })
            }
          }
          return { data: structuredClone(single ? saved[0] : saved), error: null }
        }
        if (operation === 'update' && table === 'community_posts' && payload.status === 'deleting' && state.publishBeforeScrub) {
          const target = source.find(row => row.id === state.publishBeforeScrub)
          if (target) { target.status = 'published'; target.published_at = new Date().toISOString() }
          state.publishBeforeScrub = null
        }
        if (operation === 'update' && table === 'community_posts' && payload.status === 'deleting' && state.renewBeforeScrub) {
          const target = source.find(row => row.id === state.renewBeforeScrub)
          if (target) target.upload_active_until = new Date(Date.now() + 15 * 60_000).toISOString()
          state.renewBeforeScrub = null
        }
        let rows = source.filter(row => filters.every(filter => filter(row)))
        rows.sort((a, b) => {
          for (const [key, ascending] of orders) if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1)
          return 0
        })
        const count = rows.length
        rows = rows.slice(minimum, maximum === undefined ? undefined : minimum + maximum)
        if (operation === 'update') {
          if (state.failScrub && table === 'community_posts' && payload.status === 'deleting') return { data: null, error: { message: 'PRIVATE storage scrub failure' } }
          for (const row of rows) {
            Object.assign(row, structuredClone(payload))
            if (table === 'community_posts' && row.status === 'deleting' && !row.cleanup_marked_at) row.cleanup_marked_at = new Date().toISOString()
            state.writes.push({ table, operation, id: row.id, payload: structuredClone(payload) })
          }
        } else if (operation === 'delete') {
          for (const row of rows) {
            source.splice(source.indexOf(row), 1)
            if (table === 'community_posts') state.reports = state.reports.filter(report => report.post_id !== row.id)
            state.writes.push({ table, operation, id: row.id, reporterId: row.reporter_id })
          }
        }
        if (columns.includes('community_posts')) rows = rows.map(row => ({ ...row, community_posts: state.posts.find(post => post.id === row.post_id) || null, post: state.posts.find(post => post.id === row.post_id) || null }))
        return { data: head ? null : structuredClone(single ? rows[0] || null : rows), error: null, ...(countRequested ? { count } : {}) }
      }
      return query
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'community-media', 'Only the private Community bucket may be touched')
      return {
        async remove(paths) {
          for (const path of paths) {
            const row = state.posts.find(post => post.media_path === path)
            assert.ok(row, 'Only a reserved Community path may be removed')
            assert.equal(row.status, 'deleting', 'Hide before physical removal')
            assert.equal(row.body, '', 'Scrub member text before physical removal')
            assert.equal(row.author_name, 'Community member')
          }
          state.storageCalls.push({ operation: 'remove', paths: paths.slice() })
          if (state.failRemoval) return { data: null, error: { message: 'PRIVATE removal problem' } }
          for (const path of paths) state.files.delete(path)
          return { data: paths.map(name => ({ name })), error: null }
        },
        async list(prefix, options = {}) {
          state.storageCalls.push({ operation: 'list', prefix, options })
          if (state.failList) return { data: null, error: { message: 'PRIVATE list problem' } }
          const entries = new Map()
          for (const path of state.files.keys()) {
            if (!path.startsWith(`${prefix}/`)) continue
            const rest = path.slice(prefix.length + 1)
            const name = rest.split('/')[0]
            if (options.search && !name.includes(options.search)) continue
            entries.set(name, { name, id: rest.includes('/') ? null : 'fixture-object', metadata: rest.includes('/') ? null : { size: 8 } })
          }
          const values = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
          return { data: values.slice(options.offset || 0, (options.offset || 0) + (options.limit || 100)), error: null }
        },
      }
    } },
  }
  globalThis.communityOperationsFixture = state
  return state
}

// These tests use local transport fixtures only; they do not contact Supabase or delete real data.
const reportsRoute = await importTs('app/api/admin/community/reports/route.ts', mocks)
const cleanupRoute = await importTs('app/api/admin/community/cleanup/route.ts', mocks)

test('operator authorization precedes privileged clients and denies member access to report identities', async () => {
  const state = fixture({ operator: null, reports: [report()] })
  for (const response of [
    await reportsRoute.GET(request(null, { endpoint: 'reports', method: 'GET' })),
    await reportsRoute.POST(request({ postId, reporterId, action: 'dismiss' }, { endpoint: 'reports' })),
    await cleanupRoute.POST(request(account())),
  ]) {
    assert.ok([401, 403].includes(response.status))
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.equal(JSON.stringify(await response.json()).includes(reporterId), false)
  }
  assert.equal(state.adminCreations, 0)
  assert.deepEqual(state.writes, [])
})

test('cross-origin operator requests cannot mutate reports or start cleanup', async () => {
  const state = fixture({ posts: [post()], reports: [report()] })
  for (const response of [
    await cleanupRoute.POST(request(cleanAccount(), { origin: 'https://outside.test' })),
    await reportsRoute.POST(request({ postId, reporterId, action: 'remove', confirmation: `REMOVE ${postId}` }, { endpoint: 'reports', origin: 'https://outside.test' })),
  ]) assert.equal(response.status, 403)
  assert.deepEqual(state.writes, [])
  assert.deepEqual(state.storageCalls, [])
})

test('account cleanup defaults to a bounded dry run and never touches another author', async () => {
  const state = fixture({ posts: [post(), post({ id: otherId, author_id: otherAuthor, media_path: pathFor(otherAuthor, otherId) })] })
  const response = await cleanupRoute.POST(request({ operation: 'account', authorId }))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const result = await response.json()
  assert.deepEqual(result.rows.map(row => row.id), [postId])
  assert.equal(result.rows[0].authorId, authorId)
  assert.deepEqual(state.writes, [])
  assert.deepEqual(state.storageCalls, [])
})

test('cleanup execution requires a verified deletion request, reference and exact scope confirmation', async () => {
  const state = fixture({ posts: [post()] })
  for (const payload of [
    cleanAccount({ verifiedRequest: false }), cleanAccount({ requestReference: '' }),
    cleanAccount({ confirmation: `CLEAN COMMUNITY ${otherAuthor}` }),
    account('clean'), account('remove-everything'), account('clean', { authorId: '../other' }),
  ]) {
    const response = await cleanupRoute.POST(request(payload))
    assert.ok(response.status >= 400 && response.status < 500, JSON.stringify(payload))
  }
  assert.deepEqual(state.writes, [])
  assert.equal(state.holds.length, 0)
  assert.equal(state.posts[0].status, 'published')
})

test('account cleanup holds one author before scrubbing; failed media removal retains retryable rows', async () => {
  const mine = post(), theirs = post({ id: otherId, author_id: otherAuthor, media_path: pathFor(otherAuthor, otherId) })
  const state = fixture({ posts: [mine, theirs], files: new Map([[mine.media_path, {}], [theirs.media_path, {}]]), failRemoval: true })
  let response = await cleanupRoute.POST(request(cleanAccount()))
  assert.ok(response.status >= 500 || (await response.clone().json()).cleanupPending, 'A failed physical removal must remain pending')
  assert.equal(state.writes[0].table, 'community_cleanup_holds')
  assert.equal(state.holds.length, 1)
  assert.equal(state.holds[0].author_id, authorId)
  assert.equal(state.holds[0].requested_by, operatorId)
  assert.equal(mine.status, 'deleting'); assert.equal(mine.body, ''); assert.equal(mine.author_name, 'Community member'); assert.equal(mine.published_at, null)
  assert.equal(mine.media_cleaned_at, null)
  assert.equal(theirs.status, 'published'); assert.equal(theirs.body, 'Saved member content')
  assert.equal(state.files.has(mine.media_path), true)
  assert.equal(state.posts.length, 2, 'No account rows are removed during cleanup')
  const startedAt = state.holds[0].started_at
  state.failRemoval = false
  response = await cleanupRoute.POST(request(cleanAccount()))
  assert.equal(response.status, 200)
  assert.equal(state.holds[0].started_at, startedAt, 'Retry must not restart the drain clock')
  assert.equal(state.files.has(mine.media_path), false)
  assert.equal(state.files.has(theirs.media_path), true)
  assert.ok(mine.media_cleaned_at)
  assert.equal(state.posts.length, 2)
  assert.ok(state.storageCalls.filter(call => call.operation === 'remove').every(call => call.paths.every(path => path.startsWith(`${authorId}/`))))
})

test('cleanup refuses an attachment path outside the exact author/post reservation', async () => {
  const mine = post({ media_path: pathFor(otherAuthor, otherId) })
  const state = fixture({ posts: [mine], files: new Map([[mine.media_path, {}]]) })
  const response = await cleanupRoute.POST(request(cleanAccount()))
  assert.ok(response.status >= 400 || (await response.clone().json()).cleanupPending?.includes(postId))
  assert.equal(state.storageCalls.filter(call => call.operation === 'remove').length, 0)
  assert.equal(state.files.has(mine.media_path), true)
  assert.equal(state.posts.length, 1)
})

test('account cleanup batches use a continuation without crossing owners or resetting the hold', async () => {
  const posts = Array.from({ length: 27 }, (_, n) => post({ id: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`, media_path: null, media_type: null, media_mime: null, media_size: null }))
  const state = fixture({ posts })
  let response = await cleanupRoute.POST(request(cleanAccount()))
  assert.equal(response.status, 200)
  const first = await response.json()
  assert.ok(first.nextCursor)
  assert.equal(state.posts.filter(row => row.status === 'deleting').length, 25)
  response = await cleanupRoute.POST(request(cleanAccount({ cursor: first.nextCursor })))
  assert.equal(response.status, 200)
  assert.equal(state.posts.filter(row => row.status === 'deleting').length, 27)
  assert.equal(state.holds.length, 1)
})

const completedTombstone = () => post({ status: 'deleting', body: '', author_name: 'Community member', category: 'Progress', published_at: null, cleanup_marked_at: ago(48), media_cleaned_at: ago(47) })
const oldHold = () => ({ author_id: authorId, requested_by: operatorId, request_reference: 'request-verified-123', started_at: ago(49) })

test('row finalization requires the drain period and explicit operator verification', async () => {
  for (const [holds, payload] of [
    [[], finalizeAccount()],
    [[{ ...oldHold(), started_at: ago(1) }], finalizeAccount()],
    [[oldHold()], finalizeAccount({ storageDrainVerified: false })],
    [[oldHold()], finalizeAccount({ confirmation: `FINALIZE COMMUNITY ${otherAuthor}` })],
  ]) {
    const state = fixture({ holds, posts: [completedTombstone()] })
    const response = await cleanupRoute.POST(request(payload))
    assert.ok(response.status >= 400 && response.status < 500)
    assert.equal(state.posts.length, 1)
    assert.equal(state.writes.some(write => write.operation === 'delete'), false)
  }
})

test('late/unknown owner media or an unverifiable Storage listing prevents row removal', async () => {
  for (const failure of ['remaining-media', 'list-failure']) {
    const state = fixture({ holds: [oldHold()], posts: [completedTombstone()], files: new Map(failure === 'remaining-media' ? [[`${authorId}/unexpected/late-upload.jpg`, {}]] : []), failList: failure === 'list-failure' })
    const response = await cleanupRoute.POST(request(finalizeAccount()))
    assert.ok(response.status >= 400)
    assert.equal(state.posts.length, 1)
    assert.equal(state.writes.some(write => write.operation === 'delete'), false)
    const result = await response.json()
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false)
  }
})

test('finalization removes only cleaned owner Community rows and reports; its hold remains', async () => {
  const theirs = post({ id: otherId, author_id: otherAuthor, media_path: pathFor(otherAuthor, otherId) })
  const state = fixture({ holds: [oldHold()], posts: [completedTombstone(), theirs], reports: [report(), report({ post_id: otherId, reporter_id: authorId }), report({ post_id: otherId, reporter_id: reporterId })], files: new Map([[theirs.media_path, {}]]) })
  const response = await cleanupRoute.POST(request(finalizeAccount()))
  assert.equal(response.status, 200)
  assert.deepEqual(state.posts.map(row => row.id), [otherId])
  assert.deepEqual(state.reports.map(row => [row.post_id, row.reporter_id]), [[otherId, reporterId]])
  assert.equal(state.holds.length, 1, 'Holding Community writes continues until the separate account process finishes')
  assert.equal(state.files.has(theirs.media_path), true)
})

test('abandoned cleanup age checks protect published posts and recent drafts; tombstones remain', async () => {
  const oldDraft = post({ status: 'draft', published_at: null })
  const oldDeleting = post({ id: otherId, status: 'deleting', body: '', author_name: 'Community member', published_at: null, cleanup_marked_at: ago(48), media_path: pathFor(authorId, otherId) })
  const recentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', publishedId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const recent = post({ id: recentId, status: 'draft', created_at: ago(1), published_at: null, media_path: pathFor(authorId, recentId) })
  const published = post({ id: publishedId, media_path: pathFor(authorId, publishedId) })
  const state = fixture({ posts: [oldDraft, oldDeleting, recent, published], files: new Map([oldDraft, oldDeleting, recent, published].map(row => [row.media_path, {}])) })
  let response = await cleanupRoute.POST(request({ operation: 'abandoned' }))
  assert.equal(response.status, 200)
  assert.deepEqual(new Set((await response.json()).rows.map(row => row.id)), new Set([postId, otherId]))
  assert.deepEqual(state.writes, [])
  response = await cleanupRoute.POST(request({ operation: 'abandoned', action: 'clean', confirmation: 'CLEAN ABANDONED COMMUNITY' }))
  assert.equal(response.status, 200)
  assert.equal(oldDraft.status, 'deleting'); assert.equal(oldDraft.body, '')
  assert.equal(state.files.has(oldDraft.media_path), false); assert.equal(state.files.has(oldDeleting.media_path), false)
  assert.equal(recent.status, 'draft'); assert.equal(state.files.has(recent.media_path), true)
  assert.equal(published.status, 'published'); assert.equal(state.files.has(published.media_path), true)
  assert.equal(state.posts.length, 4)
})

test('report review lists only the requested status and dismissal preserves the post', async () => {
  const state = fixture({ posts: [post()], reports: [report(), report({ post_id: otherId, status: 'dismissed', reviewed_at: ago(1), reviewed_by: operatorId })] })
  let response = await reportsRoute.GET(request(null, { method: 'GET', endpoint: 'reports', query: '?status=open' }))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const result = await response.json()
  assert.equal(result.reports.length, 1); assert.equal(result.reports[0].reporterId, reporterId)
  assert.equal(result.reports[0].post.body, 'Saved member content')
  response = await reportsRoute.POST(request({ postId, reporterId, action: 'dismiss', note: 'Reviewed against community rules.' }, { endpoint: 'reports' }))
  assert.equal(response.status, 200)
  assert.equal(state.reports[0].status, 'dismissed')
  assert.equal(state.reports[0].reviewed_by, operatorId)
  assert.equal(state.posts[0].status, 'published'); assert.equal(state.posts[0].body, 'Saved member content')
  assert.deepEqual(state.storageCalls, [])
})

test('report removal needs exact confirmation, scrubs before media cleanup and remains retryable', async () => {
  const mine = post()
  const state = fixture({ posts: [mine], reports: [report()], files: new Map([[mine.media_path, {}]]) })
  let response = await reportsRoute.POST(request({ postId, reporterId, action: 'remove' }, { endpoint: 'reports' }))
  assert.ok(response.status >= 400 && response.status < 500)
  assert.equal(mine.status, 'published')
  state.failRemoval = true
  response = await reportsRoute.POST(request({ postId, reporterId, action: 'remove', confirmation: `REMOVE ${postId}` }, { endpoint: 'reports' }))
  assert.ok(response.status >= 500 || (await response.clone().json()).cleanupPending)
  assert.equal(mine.status, 'deleting'); assert.equal(mine.body, ''); assert.equal(mine.author_name, 'Community member')
  assert.equal(state.files.has(mine.media_path), true)
  assert.equal(state.reports[0].status, 'open', 'Pending removal stays in the actionable review queue')
  assert.equal(state.reports[0].reviewed_at, null)
  assert.equal(state.reports[0].reviewed_by, null)
  const pendingQueue = await (await reportsRoute.GET(request(null, { method: 'GET', endpoint: 'reports', query: '?status=open' }))).json()
  assert.equal(pendingQueue.reports.length, 1)
  assert.equal(pendingQueue.reports[0].post.status, 'deleting')
  state.failRemoval = false
  response = await reportsRoute.POST(request({ postId, reporterId, action: 'remove', confirmation: `REMOVE ${postId}`, note: 'Removed after review.' }, { endpoint: 'reports' }))
  assert.equal(response.status, 200)
  assert.equal(state.reports[0].status, 'removed')
  assert.equal(state.files.has(mine.media_path), false)
  assert.equal(state.posts.length, 1, 'Moderation retains the protective tombstone')
})

test('a draft published after abandoned selection is protected by the conditional scrub', async () => {
  const mine = post({ status: 'draft', published_at: null })
  const state = fixture({ posts: [mine], files: new Map([[mine.media_path, {}]]), publishBeforeScrub: postId })
  const response = await cleanupRoute.POST(request({ operation: 'abandoned', action: 'clean', confirmation: 'CLEAN ABANDONED COMMUNITY' }))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).cleanupPending, [postId])
  assert.equal(mine.status, 'published'); assert.equal(mine.body, 'Saved member content')
  assert.equal(state.files.has(mine.media_path), true)
  assert.equal(state.storageCalls.some(call => call.operation === 'remove'), false)
})

test('scrub failure prevents physical removal and successful retry resets an old cleanup marker', async () => {
  const mine = completedTombstone()
  const state = fixture({ posts: [mine], files: new Map([[mine.media_path, {}]]), failScrub: true })
  let response = await cleanupRoute.POST(request(cleanAccount()))
  assert.equal(response.status, 503)
  assert.equal(state.storageCalls.some(call => call.operation === 'remove'), false)
  state.failScrub = false; state.failRemoval = true
  response = await cleanupRoute.POST(request(cleanAccount()))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).cleanupPending, [postId])
  assert.equal(mine.media_cleaned_at, null, 'A failed retry cannot retain an earlier clean marker')
})

test('report pagination remains bounded across equal timestamps and rejects malformed cursors/notes', async () => {
  const created = ago(3)
  const reports = Array.from({ length: 27 }, (_, n) => report({ post_id: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`, created_at: created }))
  const state = fixture({ reports })
  let response = await reportsRoute.GET(request(null, { endpoint: 'reports', method: 'GET' }))
  assert.equal(response.status, 200)
  const first = await response.json()
  assert.equal(first.reports.length, 25)
  assert.ok(first.nextCursor)
  response = await reportsRoute.GET(request(null, { endpoint: 'reports', method: 'GET', query: `?cursor=${encodeURIComponent(first.nextCursor)}` }))
  assert.equal(response.status, 200)
  const next = await response.json()
  assert.equal(next.reports.length, 2)
  assert.equal(next.nextCursor, null)
  assert.equal(new Set([...first.reports, ...next.reports].map(row => row.postId)).size, 27)
  for (const query of ['?status=all', '?cursor=invalid', `?cursor=${encodeURIComponent(btoa(JSON.stringify({ at: `${created},status.eq.open`, postId, reporterId })))}`]) {
    response = await reportsRoute.GET(request(null, { endpoint: 'reports', method: 'GET', query }))
    assert.equal(response.status, 400)
  }
  response = await reportsRoute.POST(request({ postId: reports[0].post_id, reporterId, action: 'dismiss', note: 'x'.repeat(501) }, { endpoint: 'reports' }))
  assert.equal(response.status, 400)
  assert.deepEqual(state.writes, [])
})

test('abandoned preview and execution protect active uploads and the lease-expiry grace period', async () => {
  const recentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', expiredId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const idle = post({ status: 'draft', published_at: null })
  const active = post({ id: otherId, status: 'draft', published_at: null, media_path: pathFor(authorId, otherId), upload_active_until: new Date(Date.now() + 30 * 60_000).toISOString() })
  const justExpired = post({ id: recentId, status: 'draft', published_at: null, media_path: pathFor(authorId, recentId), upload_active_until: ago(0.1) })
  const expired = post({ id: expiredId, status: 'draft', published_at: null, media_path: pathFor(authorId, expiredId), upload_active_until: ago(0.5) })
  const state = fixture({ posts: [idle, active, justExpired, expired], files: new Map([idle, active, justExpired, expired].map(row => [row.media_path, {}])) })
  let response = await cleanupRoute.POST(request({ operation: 'abandoned' }))
  assert.equal(response.status, 200)
  assert.deepEqual(new Set((await response.json()).rows.map(row => row.id)), new Set([postId, expiredId]))
  assert.deepEqual(state.writes, [])
  response = await cleanupRoute.POST(request({ operation: 'abandoned', action: 'clean', confirmation: 'CLEAN ABANDONED COMMUNITY' }))
  assert.equal(response.status, 200)
  assert.equal(idle.status, 'deleting'); assert.equal(expired.status, 'deleting')
  assert.equal(active.status, 'draft'); assert.equal(justExpired.status, 'draft')
  assert.equal(state.files.has(active.media_path), true); assert.equal(state.files.has(justExpired.media_path), true)
  assert.equal(state.files.has(idle.media_path), false); assert.equal(state.files.has(expired.media_path), false)
})

test('renewing an upload lease after selection prevents an abandoned conditional scrub', async () => {
  const mine = post({ status: 'draft', published_at: null, upload_active_until: ago(1) })
  const state = fixture({ posts: [mine], files: new Map([[mine.media_path, {}]]), renewBeforeScrub: postId })
  const response = await cleanupRoute.POST(request({ operation: 'abandoned', action: 'clean', confirmation: 'CLEAN ABANDONED COMMUNITY' }))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).cleanupPending, [postId])
  assert.equal(mine.status, 'draft'); assert.equal(mine.body, 'Saved member content')
  assert.ok(Date.parse(mine.upload_active_until) > Date.now())
  assert.equal(state.files.has(mine.media_path), true)
  assert.equal(state.storageCalls.some(call => call.operation === 'remove'), false)
})
