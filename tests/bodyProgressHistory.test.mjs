import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const history = await importTs('lib/dashboard/bodyProgressHistory.ts')
const now = new Date('2026-11-03T05:30:00Z')
const client = { client_id: 'fixture-client', auth_user_id: 'fixture-user', program: 'ember', access: true, active: true, timezone: 'America/Los_Angeles' }
const options = (supabase, extra = {}) => ({ supabase, client, userId: client.auth_user_id, range: '4w', now, ...extra })
const measurement = (extra = {}) => ({ client_id: client.client_id, auth_user_id: client.auth_user_id, log_date: '2026-11-02', updated_at: '2026-11-03T01:00:00Z', measurements: { waist: 30 }, ...extra })
const photo = (extra = {}) => ({ id: 'first', client_id: client.client_id, auth_user_id: client.auth_user_id, uploaded_at: '2026-01-01T12:00:00Z', assessment_type: 'progress', front_photo_url: 'fixture-client/front.jpg', ...extra })

function database(tables = {}, { failed = [], thrown = [], rawMeasurements = false } = {}) {
  const reads = [], signed = [], original = structuredClone(tables)
  return {
    reads, signed,
    from(table) {
      const filters = [], orders = [], read = { table, filters, orders, columns: '', limit: null }
      reads.push(read)
      const query = {
        select(columns) { read.columns = columns; return query },
        eq(key, value) { filters.push(['eq', key, value]); return query },
        neq(key, value) { filters.push(['neq', key, value]); return query },
        lte(key, value) { filters.push(['lte', key, value]); return query },
        gte(key, value) { filters.push(['gte', key, value]); return query },
        order(key, { ascending }) { orders.push([key, ascending]); return query },
        limit(value) { read.limit = value; return query },
        maybeSingle() { return Promise.resolve().then(() => result(true)) },
        then(resolve, reject) { return Promise.resolve().then(() => result(false)).then(resolve, reject) },
      }
      function result(single) {
        if (thrown.includes(table)) throw new Error('Synthetic unavailable read')
        if (failed.includes(table)) return { data: null, error: { message: 'Synthetic unavailable read' } }
        const rows = (tables[table] || []).filter(row => rawMeasurements && table === 'measurement_logs' || filters.every(([op, key, value]) => op === 'eq' ? row[key] === value : op === 'neq' ? row[key] !== value : row[key] != null && (op === 'lte' ? row[key] <= value : row[key] >= value)))
          .sort((a, b) => { for (const [key, ascending] of orders) if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1); return 0 })
          .slice(0, read.limit)
        return { data: single ? rows[0] || null : rows, error: null }
      }
      return query
    },
    storage: { from(bucket) { assert.equal(bucket, 'assessment_photos'); return { async createSignedUrl(path, expires) { signed.push([path, expires]); return { data: { signedUrl: `https://signed.invalid/${path}?temporary=true` }, error: null } } } } },
    verify() {
      assert.deepEqual(tables, original, 'Read-only readers preserve source fixtures')
      for (const read of reads) {
        assert.ok(read.filters.some(([op, key, value]) => op === 'eq' && key === 'client_id' && value === client.client_id))
        assert.ok(read.filters.some(([op, key, value]) => op === 'eq' && key === 'auth_user_id' && value === client.auth_user_id))
      }
    },
  }
}

test('canonical owner and all current paid-progress capabilities are required before any read', async () => {
  const denied = [
    { client: null }, { userId: '' }, { userId: 'foreign-user' }, { client: { ...client, auth_user_id: null } },
    ...['free', 'tracker', 'unknown'].map(program => ({ client: { ...client, program } })),
    { client: { ...client, access: false } }, { client: { ...client, active: false } },
    { client: { ...client, membership_expires_at: now.toISOString() } },
  ]
  for (const extra of denied) {
    const db = database()
    await assert.rejects(history.loadBodyProgressHistory(options(db, extra)), error => error.name === 'BodyProgressAccessError' && error.status === 403)
    assert.equal(db.reads.length, 0); assert.equal(db.signed.length, 0)
  }
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const db = database(); const result = await history.loadBodyProgressHistory(options(db, { client: { ...client, program } }))
    assert.equal(result.unavailable, false); db.verify()
  }
})

test('history metadata matches every existing measurement key, exact label and saved unit', () => {
  const source = ts.createSourceFile('MeasurementAssessment.tsx', readFileSync('components/MeasurementAssessment.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let fields
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'measurementFields') fields = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(source)
  const expected = fields.elements.map(element => {
    const values = Object.fromEntries(element.properties.filter(ts.isPropertyAssignment).map(property => [property.name.getText(source), property.initializer.text]))
    return { key: values.key, label: values.label, unit: values.unit || 'in' }
  })
  assert.deepEqual(history.bodyMeasurementFields, expected)
  assert.equal(history.bodyMeasurementFields.length, 43)
  assert.ok(!history.bodyMeasurementFields.some(field => /body.?fat|percent/i.test(field.key)))
})

test('recorded zero, missing and invalid measurements remain distinct without arbitrary stored metadata', async () => {
  const db = database({ measurement_logs: [measurement({ notes: 'DO NOT EXPOSE', measurements: { weight: 0, waist: ' 0 ', lower_waist: 31.5, left_upper_arm: '12.25', right_upper_arm: -3, left_forearm: '', right_forearm: null, left_calf: false, right_calf: 'Infinity', height: '0x10', body_fat_percentage: 22, note: 'DO NOT EXPOSE' } })] })
  const result = await history.loadBodyProgressHistory(options(db))
  const values = result.rows[0].values
  assert.deepEqual(values.weight, { status: 'recorded', value: 0 }); assert.deepEqual(values.waist, values.weight)
  assert.deepEqual(values.lower_waist, { status: 'recorded', value: 31.5 }); assert.equal(values.left_upper_arm.value, 12.25)
  for (const key of ['right_upper_arm', 'left_calf', 'right_calf', 'height']) assert.deepEqual(values[key], { status: 'invalid', value: null })
  for (const key of ['left_forearm', 'right_forearm', 'underbust']) assert.deepEqual(values[key], { status: 'missing', value: null })
  assert.equal(result.invalidCount, 4)
  assert.equal(Object.hasOwn(values, 'body_fat_percentage'), false)
  assert.ok(!JSON.stringify(result).includes('DO NOT EXPOSE')); assert.ok(!JSON.stringify(result).includes(client.auth_user_id))
  const read = db.reads.find(item => item.table === 'measurement_logs')
  assert.equal(read.columns, 'client_id,auth_user_id,log_date,measurements,updated_at'); assert.equal(read.limit, 501)
  assert.deepEqual(read.orders, [['log_date', false], ['updated_at', false]])
  db.verify()
})

test('member-local range boundaries preserve civil DATE values and reload with the same row keys', async () => {
  const rows = ['2026-08-10', '2026-08-11', '2026-10-05', '2026-10-06', '2026-11-02', '2026-11-03'].map(log_date => measurement({ log_date }))
  const db = database({ measurement_logs: rows })
  const recent = await history.loadBodyProgressHistory(options(db))
  assert.equal(recent.today, '2026-11-02'); assert.equal(recent.timeZone, 'America/Los_Angeles')
  assert.deepEqual(recent.rows.map(row => row.date), ['2026-11-02', '2026-10-06'])
  const twelve = await history.loadBodyProgressHistory(options(db, { range: '12w' }))
  assert.deepEqual(twelve.rows.map(row => row.date), ['2026-11-02', '2026-10-06', '2026-10-05', '2026-08-11'])
  const all = await history.loadBodyProgressHistory(options(db, { range: 'all' }))
  assert.equal(all.rows.length, 5); assert.equal(all.periodLabel, 'All-time range')
  const replay = await history.loadBodyProgressHistory(options(db))
  assert.deepEqual(replay.rows, recent.rows)
  db.verify()
})

test('bounded history retains conflicting same-date records separately with deterministic tie keys', async () => {
  const tieA = measurement({ measurements: { waist: 29 } }), tieB = measurement({ measurements: { waist: 31 } })
  const tied = await history.loadBodyProgressHistory(options(database({ measurement_logs: [tieA, tieB, tieA] })))
  const reversed = await history.loadBodyProgressHistory(options(database({ measurement_logs: [tieA, tieB, tieA].reverse() })))
  assert.equal(tied.rows.length, 3); assert.equal(tied.ambiguousDateCount, 1); assert.deepEqual(tied.ambiguousDates, ['2026-11-02'])
  assert.equal(new Set(tied.rows.map(row => row.key)).size, 3); assert.deepEqual(tied.rows, reversed.rows)
  const many = database({ measurement_logs: Array.from({ length: 502 }, (_, i) => measurement({ measurements: { waist: i } })) })
  const bounded = await history.loadBodyProgressHistory(options(many))
  assert.equal(bounded.rows.length, 500); assert.equal(bounded.capped, true)
  const exact = await history.loadBodyProgressHistory(options(database({ measurement_logs: Array.from({ length: 500 }, () => measurement()) })))
  assert.equal(exact.capped, false); assert.equal(exact.rows.length, 500)
  const newerDates = Array.from({ length: 499 }, (_, index) => measurement({ log_date: new Date(Date.parse('2026-11-02T00:00:00Z') - index * 86400000).toISOString().slice(0, 10) }))
  const boundary = await history.loadBodyProgressHistory(options(database({ measurement_logs: [...newerDates, measurement({ log_date: '2024-01-01', measurements: { waist: 28 } }), measurement({ log_date: '2024-01-01', measurements: { waist: 32 } })] }), { range: 'all' }))
  assert.equal(boundary.capped, true); assert.equal(boundary.rows.length, 500)
  assert.equal(boundary.rows.filter(row => row.date === '2024-01-01').length, 1)
  assert.deepEqual(boundary.ambiguousDates, ['2024-01-01']); assert.equal(boundary.ambiguousDateCount, 1)
  many.verify()
})

test('malformed, future and foreign source responses never turn into recorded measurement history', async () => {
  const invalid = database({ measurement_logs: [measurement({ log_date: '2026-02-30' }), measurement({ log_date: '2026-11-03' }), measurement({ log_date: '2026-11-02T00:00:00Z' }), measurement()] }, { rawMeasurements: true })
  const result = await history.loadBodyProgressHistory(options(invalid))
  assert.equal(result.rows.length, 1); assert.equal(result.invalidCount, 3)
  const foreign = database({ measurement_logs: [measurement(), measurement({ auth_user_id: 'foreign-user' })] }, { rawMeasurements: true })
  const denied = await history.loadBodyProgressHistory(options(foreign))
  assert.equal(denied.unavailable, true); assert.deepEqual(denied.rows, []); assert.equal(denied.invalidCount, 1)
  const badMap = await history.loadBodyProgressHistory(options(database({ measurement_logs: [measurement({ measurements: [] })] })))
  assert.equal(badMap.invalidCount, 43); assert.equal(badMap.rows[0].values.waist.status, 'invalid')
})

test('measurement failures and private photo failures remain independent, with signed all-time helper reuse', async () => {
  const db = database({ measurement_logs: [measurement()], assessment_photos: [photo(), photo({ id: 'latest', uploaded_at: '2026-11-01T12:00:00Z', front_photo_url: 'foreign-client/front.jpg', left_photo_url: 'fixture-client/latest-left.jpg' }), photo({ id: 'foreign', client_id: 'foreign-client', uploaded_at: '2026-11-02T12:00:00Z' }), photo({ id: 'posture', assessment_type: 'posture', uploaded_at: '2026-11-02T12:00:00Z' })] })
  const result = await history.loadBodyProgressHistory(options(db))
  assert.equal(result.comparison.first.id, 'first'); assert.equal(result.comparison.latest.id, 'latest')
  assert.equal(result.comparison.latest.views.front, undefined); assert.ok(result.comparison.first.views.front.startsWith('https://signed.invalid/'))
  assert.deepEqual(db.signed, [['fixture-client/front.jpg', 1800], ['fixture-client/latest-left.jpg', 1800]])
  const photoReads = db.reads.filter(item => item.table === 'assessment_photos')
  assert.equal(photoReads.length, 2); assert.ok(photoReads.every(read => !read.filters.some(([op]) => op === 'gte')))
  const measurementFailure = await history.loadBodyProgressHistory(options(database({ assessment_photos: [photo()] }, { thrown: ['measurement_logs'] })))
  assert.equal(measurementFailure.unavailable, true); assert.equal(measurementFailure.comparison.first.id, 'first')
  const photoFailure = await history.loadBodyProgressHistory(options(database({ measurement_logs: [measurement()] }, { failed: ['assessment_photos'] })))
  assert.equal(photoFailure.unavailable, false); assert.equal(photoFailure.rows.length, 1); assert.equal(photoFailure.comparison.unavailable, true)
  db.verify()
})

test('photo capability is checked separately and prevents photo queries or signing when absent', async () => {
  const guarded = await importTs('lib/dashboard/bodyProgressHistory.ts', { '@/lib/membership/policy': 'export const membershipCan = (_client, capability) => capability !== "assessmentPhotoUpload"' })
  const db = database({ measurement_logs: [measurement()], assessment_photos: [photo()] })
  const result = await guarded.loadBodyProgressHistory(options(db))
  assert.equal(result.photosAllowed, false); assert.equal(result.comparison, null)
  assert.deepEqual(db.reads.map(read => read.table), ['measurement_logs']); assert.deepEqual(db.signed, [])
})
