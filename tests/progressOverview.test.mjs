import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const { buildProgressOverview, loadProgressOverview, progressRange } = await importTs('lib/dashboard/progressOverview.ts')
const empty = () => ({ range: '4w', today: '2026-10-28', timeZone: 'America/Chicago', workouts: { data: [] }, measurements: { data: [] }, recovery: { data: [] } })
const workout = (day, exercises = [], extra = {}) => ({ workout_date: day, completed: true, exercise_logs: exercises, ...extra })
const lift = (weight, unit = 'lb') => ({ exercise: 'Recorded press', load_type: 'per_hand', set_logs: [{ weight, reps: 8, weight_unit: unit }] })

test('successful empty history confirms zero sessions; failed or missing reads remain unavailable', () => {
  const data = buildProgressOverview(empty())
  assert.equal(data.completedSessions, 0)
  assert.equal(data.strength.unavailable, false)
  assert.equal(data.body.points.length, 0)
  assert.deepEqual(data.consistency.map(bin => bin.count), [0, 0, 0, 0])
  const failed = buildProgressOverview({ ...empty(), workouts: { data: null, error: true }, measurements: { data: null }, recovery: { data: [], error: true } })
  assert.equal(failed.completedSessions, null)
  assert.equal(failed.strength.unavailable, true)
  assert.equal(failed.body.unavailable, true)
  assert.equal(failed.energy.unavailable, true)
  assert.equal(failed.consistency.length, 0)
})

test('strength previews use confirmed loads, never prescriptions, and keep units/variants separate', () => {
  const data = buildProgressOverview({ ...empty(), workouts: { data: [
    workout('2026-10-05', [lift(7), lift(9), { exercise: 'Suggested only', recommended_weight: 200, reps: 10 }]),
    workout('2026-10-12', [lift(12), lift(25, 'kg'), { ...lift(90), selected_variant_id: 'other-variation' }]),
    workout('2026-10-19', [{ ...lift(null), exercise: 'Unknown load' }, { ...lift(''), exercise: 'Blank load' }, lift(30, 'unknown')]),
  ] } })
  assert.equal(data.strength.label, 'Recorded press')
  assert.equal(data.strength.unit, 'lb')
  assert.deepEqual(data.strength.points, [{ date: '2026-10-05', value: 9 }, { date: '2026-10-12', value: 12 }])
  const zero = buildProgressOverview({ ...empty(), workouts: { data: [workout('2026-10-05', [lift(0)])] } })
  assert.equal(zero.strength.points[0].value, 0)
})

test('body glimpses retain stored inches/pounds and energy excludes unanswered or invalid markers', () => {
  const data = buildProgressOverview({ ...empty(), measurements: { data: [
    { log_date: '2026-10-19', measurements: { waist: 35.9 } },
    { log_date: '2026-10-05', measurements: { waist: '36.4', weight: 140 } },
  ] }, recovery: { data: [
    { log_date: '2026-10-05', energy_level: 6 }, { log_date: '2026-10-07', energy_level: 8 },
    { log_date: '2026-10-08', energy_level: null }, { log_date: '2026-10-09', energy_level: '' },
    { log_date: '2026-10-10', energy_level: 0 }, { log_date: '2026-10-11', energy_level: 11 },
  ] } })
  assert.equal(data.body.label, 'Waist'); assert.equal(data.body.unit, 'in')
  assert.deepEqual(data.body.points.map(point => point.value), [36.4, 35.9])
  assert.deepEqual(data.energy.points.map(point => point.value), [6, 8])
  const weight = buildProgressOverview({ ...empty(), measurements: { data: [{ log_date: '2026-10-02', measurements: { weight: 140 } }, { log_date: '2026-10-09', measurements: { weight: 141, waist: 36 } }] } })
  assert.equal(weight.body.label, 'Weight'); assert.equal(weight.body.unit, 'lb')
})

test('periods and consistency buckets respect member-local dates and ignore future, partial or invalid rows', () => {
  const data = buildProgressOverview({ ...empty(), workouts: { data: [
    workout('2026-10-01T02:00:00Z'), workout('2026-10-01'), workout('2026-10-29T02:00:00Z'),
    workout('2026-10-30'), workout('2026-10-04', [], { completed: false }), workout('not-a-date'),
  ] } })
  assert.equal(data.completedSessions, 2)
  assert.equal(data.consistency.reduce((sum, bin) => sum + bin.count, 0), 2)
  assert.equal(data.consistency[0].start, '2026-10-01')
  assert.equal(data.consistency.at(-1).end, '2026-10-28')
  assert.equal(buildProgressOverview({ ...empty(), range: '12w' }).consistency.length, 12)
  assert.equal(buildProgressOverview({ ...empty(), range: 'all', workouts: { data: [workout('2025-01-01')] } }).completedSessions, 1)
  assert.equal(buildProgressOverview({ ...empty(), workouts: { data: Array.from({ length: 500 }, () => workout('2026-10-01')) } }).workoutsCapped, true)
  for (const value of [undefined, 'invalid', ['12w']]) assert.equal(progressRange(value), '4w')
  assert.equal(progressRange('12w'), '12w'); assert.equal(progressRange('all'), 'all')
})

test('Progress reads reuse owned existing sources, apply date bounds, and fail independently', async () => {
  const reads = []
  const supabase = { from(table) {
    assert.ok(['workout_logs', 'measurement_logs', 'recovery_logs'].includes(table))
    const record = { table, filters: [] }; reads.push(record)
    const query = { select() { return query }, eq(key, value) { record.filters.push(['eq', key, value]); return query }, lte(key, value) { record.filters.push(['lte', key, value]); return query }, gte(key, value) { record.filters.push(['gte', key, value]); return query }, lt(key, value) { record.filters.push(['lt', key, value]); return query }, order() { return query }, limit(value) { record.limit = value; return query }, then(done) { return Promise.resolve({ data: table === 'recovery_logs' ? null : [], error: table === 'recovery_logs' ? { message: 'Synthetic read failure' } : null }).then(done) } }
    return query
  } }
  const data = await loadProgressOverview({ supabase, client: { client_id: 'owner-client', timezone: 'America/Chicago' }, userId: 'owner-user', range: '4w' })
  assert.equal(data.completedSessions, 0); assert.equal(data.energy.unavailable, true)
  assert.equal(reads.length, 4)
  for (const read of reads) assert.ok(read.filters.some(filter => filter[1] === 'client_id' && filter[2] === 'owner-client'))
  for (const read of reads.filter(read => read.table === 'workout_logs')) assert.ok(read.filters.some(filter => filter[1] === 'auth_user_id' && filter[2] === 'owner-user'))
  assert.ok(reads.every(read => read.filters.some(filter => filter[0] === 'gte')))
  reads.length = 0
  await loadProgressOverview({ supabase, client: { client_id: 'owner-client', timezone: 'America/Chicago' }, userId: 'owner-user', range: 'all' })
  assert.equal(reads.length, 4)
  assert.ok(reads.every(read => !read.filters.some(filter => filter[0] === 'gte')))
})

const require = createRequire(import.meta.url)
const module = { exports: {} }
const source = ts.transpileModule(readFileSync('components/program-dashboard/ProgressOverview.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
runInNewContext(source, { module, exports: module.exports, Date, require: name => name === 'next/link' ? ({ href, children, prefetch, ...props }) => React.createElement('a', { href, ...props }, children) : name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) } : require(name) })
const Overview = module.exports.default, Sparkline = module.exports.ProgressSparkline
test('four whole-card links retain full-detail routes in every tier and missing data never creates a chart', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const html = renderToStaticMarkup(React.createElement(Overview, { data: buildProgressOverview(empty()), program }))
    assert.equal((html.match(/class="phone-app-card card"/g) || []).length, 4)
    for (const href of [`/dashboard/program/${program}/workout#workout-information-panel`, '/dashboard/assessment/measurements', '/dashboard/recovery', '#progress-details']) assert.ok(html.includes(`href="${href}"`))
    assert.match(html, /href="\/dashboard\/progress\?range=12w"/)
    assert.match(html, /No completed workout sessions in this period/)
    assert.doesNotMatch(html, /class="spark"|class="bars"/)
    let depth = 0
    for (const tag of html.match(/<\/?a(?:\s[^>]*|)>/g) || []) { depth += tag.startsWith('</') ? -1 : 1; assert.ok(depth <= 1) }
    assert.equal(depth, 0)
  }
})

test('card glimpses show actual values and break energy lines across missing check-in days', () => {
  const data = buildProgressOverview({ ...empty(), workouts: { data: [workout('2026-10-05', [lift(7)]), workout('2026-10-12', [lift(12)])] } })
  const html = renderToStaticMarkup(React.createElement(Overview, { data, program: 'ember' }))
  assert.match(html, /Recorded press · 7 → 12 lb/)
  assert.match(html, /class="spark"/); assert.match(html, /class="bars"/)
  const gap = renderToStaticMarkup(React.createElement(Sparkline, { points: [{ date: '2026-10-01', value: 6 }, { date: '2026-10-03', value: 8 }], label: 'Energy', gaps: true }))
  assert.doesNotMatch(gap, /<polyline/)
  assert.equal((gap.match(/<circle/g) || []).length, 2)
})
