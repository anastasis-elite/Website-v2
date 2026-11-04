import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildNutritionProgress, loadNutritionProgress, assertNutritionProgressAccess } = await importTs('lib/dashboard/nutritionProgress.ts')
const now = new Date('2026-11-05T01:00:00Z')
const waterReceipt = '45a4e7ac-d7e0-4aab-b027-04073828df48'
const client = (program = 'ember') => ({ client_id: 'own-client', auth_user_id: 'own-user', program, access: true, active: true, timezone: 'America/Chicago' })
const log = (id = 'log-1', day = '2026-11-04', water = 0, extra = {}) => ({ id, log_date: day, water_consumed_oz: water, client_id: 'own-client', auth_user_id: 'own-user', ...extra })
const macro = (extra = {}) => ({ id: 'macro-1', nutrition_log_id: 'log-1', client_id: 'own-client', auth_user_id: 'own-user', calories: 100, protein_g: 20, carbs_g: 0, fat_g: 2, day_block: 'morning', ...extra })
const meal = (extra = {}) => ({ nutrition_log_id: 'log-1', day_block: 'morning', calories_eaten: 300, protein_eaten_g: 30, carbs_eaten_g: 40, fat_eaten_g: 5, ...extra })
const input = (extra = {}) => ({ range: '4w', today: '2026-11-04', timeZone: 'America/Chicago', logs: { data: [log()] }, meals: { data: [] }, macros: { data: [] }, ...extra })

test('confirmed meal totals and manual entries are combined once; targets and prepared logs do not become intake', () => {
  const data = buildNutritionProgress(input({ logs: { data: [log('log-1', '2026-11-04', 32, { calories: 2000, protein: 100, water_oz: 90 })] }, meals: { data: [meal(), meal()] }, macros: { data: [macro(), macro(), macro({ id: 'macro-2' })] } }))
  assert.deepEqual(data.series.hydration.points, [{ date: '2026-11-04', value: 32 }])
  assert.deepEqual(data.series.calories.points, [{ date: '2026-11-04', value: 500 }])
  assert.equal(data.series.protein.points[0].value, 70)
  assert.equal(data.series.carbs.points[0].value, 40)
  assert.equal(data.series.fats.points[0].value, 9)
  const prepared = buildNutritionProgress(input({ logs: { data: [log('log-1', '2026-11-04', 0, { calories: 2000, protein: 100, water_oz: 90 })] } }))
  assert.equal(prepared.series.calories.points.length, 0)
  assert.equal(prepared.series.hydration.points.length, 0)
})

test('missing, invalid and failed values remain separate from recorded zero and partial daily totals', () => {
  const data = buildNutritionProgress(input({ macros: { data: [macro({ calories: '', protein_g: 0, carbs_g: null, fat_g: -2 })] } }))
  assert.deepEqual(data.series.hydration.points, [])
  assert.deepEqual(data.series.protein.points, [{ date: '2026-11-04', value: 0 }])
  for (const key of ['calories', 'carbs', 'fats']) assert.deepEqual(data.series[key].points, [])
  const partial = buildNutritionProgress(input({ meals: { data: [meal({ protein_eaten_g: null })] }, macros: { data: [macro()] } }))
  assert.deepEqual(partial.series.protein.points, [])
  assert.equal(partial.series.calories.points[0].value, 400)
  const failed = buildNutritionProgress(input({ meals: { data: null, error: true }, macros: { data: [macro()] } }))
  assert.equal(failed.series.calories.unavailable, true)
  assert.deepEqual(failed.series.calories.points, [])
  assert.equal(failed.series.hydration.unavailable, false)
  const missing = buildNutritionProgress(input({ logs: { data: null } }))
  assert.equal(missing.series.hydration.unavailable, true)
  assert.equal(missing.series.protein.unavailable, true)
})

test('conflicting daily logs and replay identities cannot inflate or provide incomplete totals', () => {
  const duplicateLog = buildNutritionProgress(input({ logs: { data: [log(), log(), log('second-log')] }, macros: { data: [macro()] } }))
  assert.equal(duplicateLog.ambiguousDays, 1)
  assert.deepEqual(duplicateLog.series.hydration.points, [])
  assert.deepEqual(duplicateLog.series.calories.points, [])
  const conflict = buildNutritionProgress(input({ macros: { data: [macro(), macro({ calories: 500 })] } }))
  assert.equal(conflict.ambiguousDays, 1)
  assert.deepEqual(conflict.series.calories.points, [])
  assert.deepEqual(conflict.series.hydration.points, [])
  const mealConflict = buildNutritionProgress(input({ meals: { data: [meal(), meal({ calories_eaten: 500 })] } }))
  assert.deepEqual(mealConflict.series.calories.points, [])
})

test('hydration distinguishes prepared zero from committed zero without exposing drink receipt IDs', () => {
  const hydration = logs => buildNutritionProgress(input({ logs: { data: logs } }))
  for (const receipts of [undefined, [], ['invalid-receipt'], [null], ['']]) {
    assert.deepEqual(hydration([log('log-1', '2026-11-04', 0, { water_submission_ids: receipts })]).series.hydration.points, [])
  }
  const recorded = hydration([log('log-1', '2026-11-04', 0, { water_submission_ids: [waterReceipt] })])
  assert.deepEqual(recorded.series.hydration.points, [{ date: '2026-11-04', value: 0 }])
  assert.ok(!JSON.stringify(recorded).includes(waterReceipt))
  assert.ok(!JSON.stringify(recorded).includes('water_submission_ids'))
  assert.deepEqual(hydration([log('log-1', '2026-11-04', 16)]).series.hydration.points, [{ date: '2026-11-04', value: 16 }])
  const conflicting = hydration([log(), log('log-1', '2026-11-04', 0, { water_submission_ids: [waterReceipt] })])
  assert.deepEqual(conflicting.series.hydration.points, [])
  assert.equal(conflicting.ambiguousDays, 1)
})

test('4 and 12 week windows include the first member-local day and ignore future and invalid dates', () => {
  const logs = [log('first', '2026-10-08', 1), log('before', '2026-10-07', 2), log('today', '2026-11-04', 3), log('future', '2026-11-05', 4), log('invalid', '2026-02-30', 5)]
  const data = buildNutritionProgress(input({ logs: { data: logs } }))
  assert.deepEqual(data.series.hydration.points.map(point => point.date), ['2026-10-08', '2026-11-04'])
  const twelve = buildNutritionProgress(input({ range: '12w', logs: { data: [log('first', '2026-08-13', 1), log('before', '2026-08-12', 2)] } }))
  assert.deepEqual(twelve.series.hydration.points, [{ date: '2026-08-13', value: 1 }])
  assert.equal(data.coverageStart, '2026-10-08')
  assert.equal(data.coverageEnd, '2026-11-04')
})

test('nutrition trend access preserves all three coaching tiers and rejects unauthorized owners, memberships and tracker trends', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) assert.doesNotThrow(() => assertNutritionProgressAccess({ id: 'own-user' }, client(tier), now))
  for (const record of [client('tracker'), client('free'), { ...client(), access: false }, { ...client(), active: false }, { ...client(), auth_user_id: 'other' }, { ...client(), membership_expires_at: '2026-11-04T00:00:00Z' }]) {
    assert.throws(() => assertNutritionProgressAccess({ id: 'own-user' }, record, now), /not available/)
  }
})

function database(tables = {}, fail = '') {
  const reads = []
  return { reads, from(table) {
    const read = { table, filters: [] }; reads.push(read)
    const query = {
      select(columns) { read.columns = columns; return query },
      eq(key, value) { read.filters.push(['eq', key, value]); return query },
      gte(key, value) { read.filters.push(['gte', key, value]); return query },
      lte(key, value) { read.filters.push(['lte', key, value]); return query },
      in(key, value) { read.filters.push(['in', key, value]); return query },
      order() { return query }, limit(value) { read.limit = value; return query },
      then(done) {
        let rows = tables[table] || []
        for (const [op, key, value] of read.filters) rows = rows.filter(row => op === 'eq' ? row[key] === value : op === 'gte' ? row[key] >= value : op === 'lte' ? row[key] <= value : value.includes(row[key]))
        return Promise.resolve(table === fail ? { data: null, error: true } : { data: rows.slice(0, read.limit) }).then(done)
      },
    }
    return query
  } }
}

test('loader scopes every raw source to the owner and uses confirmed actual columns with member-local boundaries', async () => {
  const db = database({ nutrition_logs: [log()], nutrition_log_totals_by_block: [meal()], macro_entries: [macro()] })
  const result = await loadNutritionProgress({ supabase: db, user: { id: 'own-user' }, client: client(), range: '4w', now })
  assert.equal(result.today, '2026-11-04')
  assert.equal(result.series.calories.points[0].value, 400)
  assert.equal(db.reads.length, 3)
  const logs = db.reads.find(read => read.table === 'nutrition_logs')
  assert.ok(logs.filters.some(filter => filter[0] === 'gte' && filter[2] === '2026-10-08'))
  for (const read of db.reads.filter(read => read.table !== 'nutrition_log_totals_by_block')) {
    assert.ok(read.filters.some(filter => filter[1] === 'client_id' && filter[2] === 'own-client'))
    assert.ok(read.filters.some(filter => filter[1] === 'auth_user_id' && filter[2] === 'own-user'))
  }
  assert.doesNotMatch(logs.columns, /water_oz|(?<!_)calories|protein|carbs|fats/)
  assert.ok(logs.columns.includes('water_submission_ids'))
  assert.ok(db.reads.filter(read => read.table !== 'nutrition_logs').every(read => read.filters.some(filter => filter[0] === 'in' && filter[1] === 'nutrition_log_id')))
  const failedDb = database({ nutrition_logs: [log()], macro_entries: [macro()] }, 'nutrition_log_totals_by_block')
  const failed = await loadNutritionProgress({ supabase: failedDb, user: { id: 'own-user' }, client: client(), range: '4w', now })
  assert.equal(failed.series.hydration.unavailable, false)
  assert.equal(failed.series.calories.unavailable, true)
})

test('All Time has a bounded daily window and source caps suppress partial totals', async () => {
  const logs = Array.from({ length: 501 }, (_, index) => log(`log-${index}`, new Date(Date.parse('2026-11-04T00:00:00Z') - index * 86400000).toISOString().slice(0, 10), 1))
  const db = database({ nutrition_logs: logs })
  const result = await loadNutritionProgress({ supabase: db, user: { id: 'own-user' }, client: client(), range: 'all', now })
  assert.equal(result.capped, true)
  assert.equal(result.series.hydration.points.length, 500)
  assert.equal(result.coverageEnd, '2026-11-04')
  assert.equal(db.reads.length, 21)
  assert.ok(db.reads.every(read => read.limit === 501))
  assert.ok(db.reads.every(read => !read.filters.some(filter => filter[0] === 'gte')))
  const sourceDb = database({ nutrition_logs: [log('log-1', '2026-11-04', 16)], macro_entries: Array.from({ length: 501 }, (_, index) => macro({ id: `macro-${index}` })) })
  const sourceCap = await loadNutritionProgress({ supabase: sourceDb, user: { id: 'own-user' }, client: client(), range: 'all', now })
  assert.equal(sourceCap.capped, true)
  assert.equal(sourceCap.series.calories.capped, true)
  assert.deepEqual(sourceCap.series.calories.points, [])
  assert.equal(sourceCap.series.hydration.points.length, 1)
  assert.equal(sourceCap.ambiguousDays, 1)
})
