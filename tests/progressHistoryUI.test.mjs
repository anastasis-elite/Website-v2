import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
const link = { __esModule: true, default: ({ href, children, prefetch, ...props }) => React.createElement('a', { href, ...props }, children) }
const notFound = () => { throw new Error('SYNTHETIC_NOT_FOUND') }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = () => new Promise(setImmediate)

// Only production modules are evaluated. Every authenticated read below is a
// synthetic stub; this harness cannot make a database or network request.
function loadModule(entry, mocks = {}) {
  const cache = new Map()
  function load(file) {
    file = resolve(file)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date, Intl, Map, Set, URLSearchParams,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name === 'server-only') return {}
        if (name === 'next/link') return link
        if (name === 'next/navigation') return { notFound }
        if (name === 'next/image') return { __esModule: true, default: props => React.createElement('img', props) }
        if (name.endsWith('.css')) return css
        const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null
        if (!target) return require(name)
        if (extname(target)) return load(target)
        return load(['.ts', '.tsx', '.js'].map(extension => target + extension).find(existsSync) || target)
      },
    }, { filename: file })
    return module.exports
  }
  return load(entry)
}

const owner = { id: 'synthetic-owner' }
const member = overrides => ({ client_id: 'synthetic-client', auth_user_id: owner.id, program: 'ignite', access: true,
  active: true, membership_expires_at: '2099-01-01T00:00:00Z', timezone: 'America/Chicago', ...overrides })
const routes = {
  strength: 'app/dashboard/progress/strength/page.tsx',
  body: 'app/dashboard/progress/body/page.tsx',
}
const base = () => ({ range: '4w', periodLabel: 'Past 4 weeks', today: '2026-11-03', timeZone: 'America/Chicago',
  unavailable: false, capped: false, detailCapped: false, invalidCount: 0, ambiguousDateCount: 0 })
const strengthData = overrides => ({ ...base(), series: [{ id: 'press-lb', label: 'Dumbbell press', unit: 'lb',
  variant: 'seated', equipment: 'Dumbbells', loadType: 'per_hand', sourceKind: 'sets',
  points: [{ date: '2026-10-28', value: 20 }, { date: '2026-11-02', value: 25 }] },
  { id: 'press-kg', label: 'Dumbbell press', unit: 'kg', variant: 'standing', equipment: 'Dumbbells', loadType: 'total_load', sourceKind: 'sets',
    points: [{ date: '2026-10-30', value: 10 }] }], sessions: [{ id: 'session-one', date: '2026-11-02', title: 'Recorded strength session',
  completed: true, entries: [{ id: 'set-one', label: 'Dumbbell press', detail: '25 lb per hand · 8 reps' }] },
  { id: 'session-two', date: '2026-10-28', title: 'Recorded partial session', completed: false,
    entries: [{ id: 'set-two', label: 'Dumbbell press', detail: '20 lb per hand · 6 reps' }] }], ...overrides })
const bodyData = overrides => ({ ...base(), fields: [{ key: 'waist', label: 'Natural Waist', unit: 'in' },
  { key: 'weight', label: 'Body Weight', unit: 'lb' }, { key: 'tricep_skinfold', label: 'Tricep Skinfold', unit: 'mm' }],
  rows: [{ key: 'measurement-one', date: '2026-10-28', values: { waist: { status: 'recorded', value: 0 },
    weight: { status: 'recorded', value: 140 }, tricep_skinfold: { status: 'missing', value: null } } },
  { key: 'measurement-two', date: '2026-11-02', values: { waist: { status: 'invalid', value: null },
    weight: { status: 'recorded', value: 141 }, tricep_skinfold: { status: 'recorded', value: 12 } } },
  { key: 'measurement-three', date: '2026-11-03', values: { waist: { status: 'missing', value: null },
    weight: { status: 'missing', value: null }, tricep_skinfold: { status: 'invalid', value: null } } }],
  photosAllowed: true, comparison: { first: null, latest: null, side: 'left', unavailable: false }, ...overrides })

function pageFixture(kind, { context, auth } = {}) {
  const reads = [], rendered = []
  const verified = context || { supabase: { synthetic: true }, user: owner, client: member() }
  const data = kind === 'strength' ? strengthData() : bodyData()
  const render = props => { rendered.push(props); return React.createElement('div', null, 'Synthetic history view') }
  const exports = loadModule(routes[kind], {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: () => auth || Promise.resolve(verified) },
    '@/lib/dashboard/strengthProgressHistory': { loadStrengthProgressHistory: async args => { reads.push(args); return data } },
    '@/lib/dashboard/bodyProgressHistory': { loadBodyProgressHistory: async args => { reads.push(args); return data } },
    '@/lib/dashboard/progressOverview': { progressRange: value => ['4w', '12w', 'all'].includes(value) ? value : '4w' },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: ({ children, backHref, backLabel }) => React.createElement('div', null,
      React.createElement('a', { href: backHref }, backLabel), children) },
    '@/components/program-dashboard/ProgressHistory': { StrengthProgressHistory: render, BodyProgressHistory: render },
  })
  return { page: exports.default, reads, rendered, verified, data }
}

function historyUI(mocks = {}) { return loadModule('components/program-dashboard/ProgressHistory.tsx', mocks) }
function render(kind, data, selection, mocks = {}) {
  const component = historyUI(mocks)[kind === 'strength' ? 'StrengthProgressHistory' : 'BodyProgressHistory']
  return renderToStaticMarkup(React.createElement(component, { data, selection }))
}
const decoded = html => html.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&#39;', "'")

test('both history routes wait for verified authentication and do not read on authentication failure', async () => {
  for (const kind of Object.keys(routes)) {
    const auth = deferred(), fixture = pageFixture(kind, { auth: auth.promise })
    const pending = fixture.page({ searchParams: Promise.resolve({ range: '4w' }) })
    await flush(); assert.equal(fixture.reads.length, 0)
    auth.resolve(fixture.verified); renderToStaticMarkup(await pending)
    assert.equal(fixture.reads.length, 1)
    const failure = pageFixture(kind, { auth: Promise.reject(new Error('SYNTHETIC_AUTH_FAILURE')) })
    await assert.rejects(failure.page({ searchParams: Promise.resolve({}) }), /SYNTHETIC_AUTH_FAILURE/)
    assert.equal(failure.reads.length, 0)
  }
})

test('owner mismatch, unsupported tiers, expired and inactive memberships cannot reach history loaders', async () => {
  for (const kind of Object.keys(routes)) for (const override of [
    { auth_user_id: 'another-owner' }, { auth_user_id: null }, { program: 'free' }, { program: 'tracker' }, { program: 'unknown' },
    { membership_expires_at: '2000-01-01T00:00:00Z' }, { active: false }, { access: false },
  ]) {
    const fixture = pageFixture(kind, { context: { supabase: {}, user: owner, client: member(override) } })
    await assert.rejects(fixture.page({ searchParams: Promise.resolve({}) }), /SYNTHETIC_NOT_FOUND/)
    assert.equal(fixture.reads.length, 0)
  }
})

test('all guided tiers pass only canonical request ownership and validated range to each read-only loader', async () => {
  for (const kind of Object.keys(routes)) for (const program of ['ember', 'ignite', 'phoenix']) {
    const fixture = pageFixture(kind, { context: { supabase: {}, user: owner, client: member({ program }) } })
    const html = renderToStaticMarkup(await fixture.page({ searchParams: Promise.resolve({ range: '12w', exercise: 'press-lb', measurement: 'waist',
      clientId: 'attacker-client', userId: 'attacker-user', owner: 'attacker-owner' }) }))
    assert.match(html, /href="\/dashboard\/progress\?range=12w"/)
    const [args] = fixture.reads
    assert.equal(args.supabase, fixture.verified.supabase); assert.equal(args.client, fixture.verified.client)
    if (kind === 'strength') assert.equal(args.user, owner); else assert.equal(args.userId, owner.id)
    assert.equal(args.range, '12w'); assert.ok(!Object.hasOwn(args, 'owner')); assert.ok(!Object.hasOwn(args, 'clientId'))
    assert.equal(fixture.rendered[0].data, fixture.data)
    assert.equal(fixture.rendered[0].selection, kind === 'strength' ? 'press-lb' : 'waist')
    const invalid = pageFixture(kind)
    renderToStaticMarkup(await invalid.page({ searchParams: Promise.resolve({ range: ['all', '4w'], exercise: ['press-lb'], measurement: ['waist'] }) }))
    assert.equal(invalid.reads[0].range, '4w'); assert.equal(invalid.rendered[0].selection, undefined)
  }
})

test('strength history uses native range and selection navigation and an accessible value table', () => {
  const html = decoded(render('strength', strengthData(), 'press-lb'))
  assert.match(html, /<form[^>]*action="\/dashboard\/progress\/strength"/)
  assert.match(html, /method="get"/i); assert.match(html, /name="exercise"/); assert.match(html, /name="range"[^>]*value="4w"/)
  assert.match(html, /href="\/dashboard\/progress\/strength\?range=12w&exercise=press-lb"/)
  assert.match(html, /aria-current="page"/); assert.match(html, /<label[^>]*for=/)
  assert.match(html, /<table/); assert.match(html, /<caption/); assert.match(html, /scope="col"/)
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-label=/)
  assert.doesNotMatch(html, /<form[^>]*method="post"|contenteditable=|onclick=/i)
})

test('strength selection keeps units, variants and recorded history separate and never changes completion evidence', () => {
  const pounds = decoded(render('strength', strengthData(), 'press-lb'))
  const kilograms = decoded(render('strength', strengthData(), 'press-kg'))
  assert.match(pounds, /25 lb/); assert.match(pounds, /20 lb/); assert.match(pounds, /seated/i); assert.match(pounds, /per.hand/i)
  assert.match(kilograms, /10 kg/); assert.match(kilograms, /standing/i)
  assert.match(pounds, /<details/); assert.match(pounds, /Recorded strength session/); assert.match(pounds, /Recorded partial session/)
  assert.match(pounds, /25 lb per hand · 8 reps/); assert.match(pounds, /20 lb per hand · 6 reps/)
  assert.match(pounds, /completed/i); assert.match(pounds, /partial/i)
  assert.doesNotMatch(kilograms, /<svg[^>]*role="img"/)
  assert.doesNotMatch(pounds, /record group/)
  const sameLabel = strengthData({ series: [
    { ...strengthData().series[0], id: 'a1234567-catalog-one' },
    { ...strengthData().series[0], id: 'b1234567-catalog-two' },
  ] })
  const duplicateLabels = decoded(render('strength', sameLabel, 'b1234567-catalog-two'))
  const optionLabels = [...duplicateLabels.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(match => match[1])
  assert.equal(optionLabels.length, 2); assert.equal(new Set(optionLabels).size, 2)
  assert.ok(optionLabels.every(label => label.includes('Dumbbell press') && label.includes('lb')))
  assert.match(optionLabels[0], /record group a1234567/); assert.match(optionLabels[1], /record group b1234567/)
  assert.match(duplicateLabels, /<option value="b1234567-catalog-two" selected=""/)
})

test('strength missing, unavailable, bounded and stale-selection states remain explicit without fabricated charts', () => {
  const empty = decoded(render('strength', strengthData({ series: [], sessions: [] })))
  assert.match(empty, /no .*record|no .*history|not .*record|no .*workout/i); assert.doesNotMatch(empty, /<svg|<polyline/)
  const unavailable = decoded(render('strength', strengthData({ unavailable: true, series: [], sessions: [] })))
  assert.match(unavailable, /role="status"/); assert.match(unavailable, /unavailable|could not|couldn.t|unable/i)
  const bounded = decoded(render('strength', strengthData({ capped: true, detailCapped: true, invalidCount: 2 }), 'not-a-saved-exercise'))
  assert.match(bounded, /Showing at most 500 recent workout source records for this range/)
  assert.match(bounded, /Earlier records may be outside this view/)
  assert.match(bounded, /invalid|could not|excluded|omitted/i); assert.match(bounded, /selection|selected|available/i)
  assert.doesNotMatch(bounded, /not-a-saved-exercise/)
})

test('measurement history preserves zero, missing and invalid records, distinct units and native range controls', () => {
  const waist = decoded(render('body', bodyData(), 'waist'))
  assert.match(waist, /<form[^>]*action="\/dashboard\/progress\/body"/); assert.match(waist, /name="measurement"/)
  assert.match(waist, /href="\/dashboard\/progress\/body\?range=12w&measurement=waist"/)
  assert.match(waist, /<table/); assert.match(waist, /<caption/); assert.match(waist, /scope="col"/)
  assert.match(waist, />0(?: in)?</); assert.match(waist, /not recorded|missing/i); assert.match(waist, /invalid|unusable/i)
  const weight = decoded(render('body', bodyData(), 'weight'))
  assert.match(weight, /140 lb/); assert.match(weight, /141 lb/)
  const skinfold = decoded(render('body', bodyData(), 'tricep_skinfold'))
  assert.match(skinfold, /12 mm/); assert.match(skinfold, /Tricep Skinfold/)
  assert.match(decoded(render('body', bodyData())), /<option value="waist" selected=""/)
  const noWaist = bodyData()
  noWaist.rows.forEach(row => { row.values.waist = { status: 'missing', value: null } })
  assert.match(decoded(render('body', noWaist)), /<option value="weight" selected=""/)
  assert.match(decoded(render('body', noWaist, 'waist')), /<option value="waist" selected=""/)
  assert.doesNotMatch(waist + weight + skinfold, /body.fat|estimated.*%|%.*fat|NaN|Infinity/i)
})

test('body history passes the exact private comparison to the existing component and distinguishes photo permission', () => {
  const seen = [], comparison = { first: { id: 'synthetic-photo', date: '2026-10-01T12:00:00Z', views: {} }, latest: null, side: 'left', unavailable: false }
  const mocks = { '@/components/ProgressPhotoComparison': { __esModule: true, default: props => { seen.push(props.comparison); return React.createElement('p', null, 'Existing private comparison') } } }
  const html = decoded(render('body', bodyData({ comparison }), 'waist', mocks))
  assert.equal(seen.length, 1); assert.equal(seen[0], comparison); assert.match(html, /Existing private comparison/)
  assert.match(html, /first.*latest|first.*most recent/i); assert.match(html, /all.*time|across.*dates|regardless.*range|not.*range/i)
  render('body', bodyData({ comparison: null, photosAllowed: false }), 'waist', mocks)
  assert.equal(seen.length, 1)
  assert.doesNotMatch(html, /type="file"|upload photo|delete photo|public.*bucket/i)
})

test('existing photo missing and unavailable states survive the history surface without adding upload controls', () => {
  const emptyPhotos = decoded(render('body', bodyData()))
  assert.match(emptyPhotos, /Your first photo set will appear here/); assert.match(emptyPhotos, /No photo set yet/)
  const failedPhotos = decoded(render('body', bodyData({ comparison: { first: null, latest: null, side: 'left', unavailable: true } })))
  assert.match(failedPhotos, /Your comparison could not be loaded/); assert.match(failedPhotos, /role="status"/)
  assert.doesNotMatch(emptyPhotos + failedPhotos, /type="file"|<form[^>]*method="post"/i)
})

test('measurement bounded, unavailable and single-record states are truthful and never infer missing chart points', () => {
  const unavailable = decoded(render('body', bodyData({ unavailable: true, rows: [], comparison: null })))
  assert.match(unavailable, /role="status"/); assert.match(unavailable, /could not|couldn.t|unavailable|unable/i)
  const single = decoded(render('body', bodyData({ rows: bodyData().rows.slice(0, 1), capped: true, invalidCount: 1, ambiguousDateCount: 1 }), 'waist'))
  assert.match(single, /Showing at most 500 recent measurement source records for this range/)
  assert.match(single, /Earlier records may be outside this view/)
  assert.match(single, /invalid|omitted|excluded|could not/i); assert.match(single, /same.day|duplicate|ambiguous|multiple/i)
  assert.doesNotMatch(single, /<svg|<polyline/)
  const duplicates = bodyData({ ambiguousDateCount: 1, rows: [
    { key: 'a', date: '2026-11-02', values: { waist: { status: 'recorded', value: 29 } } },
    { key: 'b', date: '2026-11-02', values: { waist: { status: 'recorded', value: 31 } } },
  ] })
  const duplicateHtml = decoded(render('body', duplicates, 'waist'))
  assert.match(duplicateHtml, /29 in/); assert.match(duplicateHtml, /31 in/)
  assert.doesNotMatch(duplicateHtml, /<svg|<polyline/)
  // The duplicate sentinel may be outside the retained 500 rows. One retained
  // row for that known ambiguous date must still be omitted from the chart.
  const cappedDuplicate = bodyData({ capped: true, ambiguousDateCount: 1, ambiguousDates: ['2026-11-02'], rows: [
    { key: 'retained-duplicate', date: '2026-11-02', values: { waist: { status: 'recorded', value: 29 } } },
    { key: 'unique-day', date: '2026-11-03', values: { waist: { status: 'recorded', value: 30 } } },
  ] })
  const cappedDuplicateHtml = decoded(render('body', cappedDuplicate, 'waist'))
  assert.match(cappedDuplicateHtml, /29 in/); assert.match(cappedDuplicateHtml, /30 in/)
  assert.match(cappedDuplicateHtml, /One record so far/)
  assert.doesNotMatch(cappedDuplicateHtml, /<svg|<polyline/)
  const empty = decoded(render('body', bodyData({ rows: [] })))
  assert.match(empty, /no .*record|not .*record|no .*measurement/i)
})

test('history routes and presentation introduce no writes, telemetry, persistent browser storage or estimated percentage helper', () => {
  const source = [...Object.values(routes), 'components/program-dashboard/ProgressHistory.tsx'].map(path => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(source, /localStorage|sessionStorage|posthog|TrackEvent|capture\(|fetch\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|bodyFatPercent|calculateBodyFat|estimateBodyFat/)
  assert.doesNotMatch(source, /['"]use client['"]/)
})
