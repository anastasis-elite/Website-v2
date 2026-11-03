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

// Evaluate actual server routes and React output with synthetic authenticated
// contexts only. The harness cannot issue database or network requests.
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
  recovery: 'app/dashboard/progress/recovery/page.tsx',
  consistency: 'app/dashboard/progress/consistency/page.tsx',
}
const componentPath = 'components/program-dashboard/RecoveryProgressHistory.tsx'
const decoded = html => html.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&#39;', "'")
const value = number => ({ status: 'recorded', value: number })
const missing = () => ({ status: 'missing', value: null })
const invalid = () => ({ status: 'invalid', value: null })
const fields = [
  { key: 'energy', label: 'Energy', unit: '/10', column: 'energy_level' },
  { key: 'stress', label: 'Stress', unit: '/10', column: 'stress_level' },
  { key: 'sleepHours', label: 'Check-in sleep duration', unit: 'hr', column: 'sleep_hours' },
  { key: 'sleepQuality', label: 'Check-in sleep quality', unit: '/10', column: 'sleep_quality' },
  { key: 'soreness', label: 'Soreness', unit: '/10', column: 'soreness_level' },
  { key: 'mood', label: 'Mood', unit: '/10', column: 'mood_level' },
  { key: 'hunger', label: 'Hunger', unit: '/10', column: 'hunger_level' },
]
const values = overrides => Object.fromEntries(fields.map(field => [field.key, overrides?.[field.key] || missing()]))
const source = (records = [], overrides = {}) => ({ unavailable: false, capped: false, invalidCount: 0, ambiguousDates: [], records, ...overrides })
const history = overrides => ({ range: '4w', periodLabel: 'Last 4 weeks', today: '2026-11-03', timeZone: 'America/Chicago', fields,
  checkins: source([
    { key: 'checkin-one', date: '2026-11-01', values: values({ energy: value(6), stress: value(8), sleepHours: value(7), sleepQuality: value(5) }) },
    { key: 'checkin-two', date: '2026-11-02', values: values({ energy: value(8), stress: missing(), sleepHours: value(0), sleepQuality: invalid() }) },
    { key: 'checkin-three', date: '2026-11-03', values: values({ energy: invalid(), stress: value(4), sleepHours: missing() }) },
  ]),
  sleep: source([{ key: 'sleep-one', date: '2026-11-01', duration: value(6), quality: value(9) }]),
  activities: source([
    { key: 'activity-one', date: '2026-11-01', label: 'Gentle walk', duration: value(12.5), durationSource: 'manual_details', ambiguous: false },
    { key: 'activity-two', date: '2026-11-02', label: 'Breathwork', duration: value(0), durationSource: 'saved_minutes', ambiguous: false },
    { key: 'activity-three', date: '2026-11-03', label: 'Full rest', duration: missing(), durationSource: 'none', ambiguous: false },
  ]),
  workouts: source([{ key: 'workout-one', date: '2026-11-01', title: 'Saved completed strength session', completed: true },
    { key: 'workout-two', date: '2026-11-02', title: 'Saved partial walking session', completed: false }]),
  includeWorkouts: true, ...overrides,
})

function pageFixture(kind, { context, auth, deniedCapability } = {}) {
  const reads = [], rendered = []
  const verified = context || { supabase: { synthetic: true }, user: owner, client: member() }
  const data = { synthetic: true }
  const render = props => { rendered.push(props); return React.createElement('div', null, 'Synthetic history view') }
  const mocks = {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: () => auth || Promise.resolve(verified) },
    '@/lib/dashboard/recoveryProgressHistory': { loadRecoveryProgressHistory: async args => { reads.push(args); return data } },
    '@/lib/dashboard/progressOverview': { progressRange: value => ['4w', '12w', 'all'].includes(value) ? value : '4w' },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: ({ children, backHref, backLabel }) => React.createElement('div', null,
      React.createElement('a', { href: backHref }, backLabel), children) },
    '@/components/program-dashboard/RecoveryProgressHistory': { EnergyRecoveryHistory: render, ConsistencyProgressHistory: render },
  }
  if (deniedCapability) mocks['@/lib/membership/policy'] = { membershipCan: (_client, capability) => capability !== deniedCapability }
  const exports = loadModule(routes[kind], mocks)
  return { page: exports.default, reads, rendered, verified, data }
}

test('both routes wait for authentication and reject failed auth, foreign ownership or ineligible membership before reads', async () => {
  for (const kind of Object.keys(routes)) {
    const auth = deferred(), fixture = pageFixture(kind, { auth: auth.promise })
    const pending = fixture.page({ searchParams: Promise.resolve({ range: '4w' }) })
    await flush(); assert.equal(fixture.reads.length, 0)
    auth.resolve(fixture.verified); renderToStaticMarkup(await pending)
    assert.equal(fixture.reads.length, 1)
    const failure = pageFixture(kind, { auth: Promise.reject(new Error('SYNTHETIC_AUTH_FAILURE')) })
    await assert.rejects(failure.page({ searchParams: Promise.resolve({}) }), /SYNTHETIC_AUTH_FAILURE/)
    assert.equal(failure.reads.length, 0)
    for (const override of [{ auth_user_id: 'another-owner' }, { auth_user_id: null }, { program: 'free' }, { program: 'tracker' },
      { program: 'unknown' }, { membership_expires_at: '2000-01-01T00:00:00Z' }, { active: false }, { access: false }]) {
      const denied = pageFixture(kind, { context: { supabase: {}, user: owner, client: member(override) } })
      await assert.rejects(denied.page({ searchParams: Promise.resolve({}) }), /SYNTHETIC_NOT_FOUND/)
      assert.equal(denied.reads.length, 0)
    }
    for (const capability of ['generatedCoaching', 'progressView', 'trendsView', 'recoveryBasic', ...(kind === 'consistency' ? ['workoutLogging'] : [])]) {
      const denied = pageFixture(kind, { deniedCapability: capability })
      await assert.rejects(denied.page({ searchParams: Promise.resolve({}) }), /SYNTHETIC_NOT_FOUND/)
      assert.equal(denied.reads.length, 0)
    }
  }
})

test('guided tiers pass canonical owner and normalized range only, retain back navigation and request workouts only for comparison', async () => {
  for (const kind of Object.keys(routes)) for (const program of ['ember', 'ignite', 'phoenix']) {
    const fixture = pageFixture(kind, { context: { supabase: {}, user: owner, client: member({ program }) } })
    const html = renderToStaticMarkup(await fixture.page({ searchParams: Promise.resolve({ range: '12w', signal: 'stress',
      userId: 'attacker-user', clientId: 'attacker-client', owner: 'attacker-owner' }) }))
    assert.match(html, /href="\/dashboard\/progress\?range=12w"/)
    const [args] = fixture.reads
    assert.equal(args.user, owner); assert.equal(args.client, fixture.verified.client); assert.equal(args.supabase, fixture.verified.supabase)
    assert.equal(args.range, '12w'); assert.equal(Boolean(args.includeWorkouts), kind === 'consistency')
    assert.ok(!Object.hasOwn(args, 'clientId')); assert.ok(!Object.hasOwn(args, 'userId')); assert.ok(!Object.hasOwn(args, 'owner'))
    assert.equal(fixture.rendered[0].data, fixture.data)
    if (kind === 'recovery') assert.equal(fixture.rendered[0].selection, 'stress')
    const invalid = pageFixture(kind)
    renderToStaticMarkup(await invalid.page({ searchParams: Promise.resolve({ range: ['all'], signal: ['energy'] }) }))
    assert.equal(invalid.reads[0].range, '4w')
    if (kind === 'recovery') assert.equal(invalid.rendered[0].selection, undefined)
  }
})

function render(kind, data = history(), selection) {
  const component = loadModule(componentPath)[kind === 'recovery' ? 'EnergyRecoveryHistory' : 'ConsistencyProgressHistory']
  return decoded(renderToStaticMarkup(React.createElement(component, { data, selection })))
}

test('energy trends retain native range and signal selection with chart and equivalent recorded-value table', () => {
  const html = render('recovery', history(), 'energy')
  assert.match(html, /<form[^>]*action="\/dashboard\/progress\/recovery"/)
  assert.match(html, /method="get"/i); assert.match(html, /name="signal"/)
  assert.match(html, /name="range"[^>]*value="4w"/)
  assert.match(html, /href="\/dashboard\/progress\/recovery\?range=12w&signal=energy"/)
  assert.match(html, /aria-current="page"/); assert.match(html, /<label[^>]*for=/)
  assert.match(html, /<option[^>]*value="energy"[^>]*selected=/)
  assert.match(html, /<table/); assert.match(html, /<caption/); assert.match(html, /scope="col"/)
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-label=/)
  assert.match(html, /6\s*\/10/); assert.match(html, /8\s*\/10/)
  const stress = render('recovery', history(), 'stress')
  assert.match(stress, /<option[^>]*value="stress"[^>]*selected=/)
  assert.match(stress, /4\s*\/10/)
  assert.doesNotMatch(html + stress, /(?:readiness|recovery) score\s*[:=]\s*\d|caused|diagnos/i)
})

test('saved zero, missing, invalid and duplicate-date check-ins are not fabricated or averaged into chart points', () => {
  const sleep = render('recovery', history(), 'sleepHours')
  assert.match(sleep, />0\s*hr</); assert.match(sleep, /not recorded/i)
  const quality = render('recovery', history(), 'sleepQuality')
  assert.match(quality, /invalid/i); assert.match(quality, /not recorded/i)
  const duplicate = history({ checkins: source([
    { key: 'a', date: '2026-11-02', values: values({ energy: value(5) }) },
    { key: 'b', date: '2026-11-03', values: values({ energy: value(9) }) },
  ], { ambiguousDates: ['2026-11-02'], capped: true }) })
  const ambiguous = render('recovery', duplicate, 'energy')
  assert.match(ambiguous, /5\s*\/10/); assert.match(ambiguous, /9\s*\/10/)
  assert.doesNotMatch(ambiguous, /<svg[^>]*role="img"/)
  assert.match(ambiguous, /duplicate|multiple|ambiguous/i)
  const stale = render('recovery', history(), 'unknown-signal')
  assert.match(stale, /available|choose|not.*signal|not.*shown/i)
  assert.doesNotMatch(stale, /unknown-signal/)
  assert.doesNotMatch(sleep + quality + ambiguous, /NaN|Infinity|body.fat|estimated.*%|%.*fat/i)
})

test('recovery activities show only recorded durations and provenance, with missing and ambiguous records kept explicit', () => {
  const data = history({ activities: source([
    ...history().activities.records,
    { key: 'activity-four', date: '2026-11-03', label: 'Ambiguous saved sauna', duration: value(10), durationSource: 'saved_minutes', ambiguous: true },
    { key: 'activity-five', date: '2026-11-03', label: 'Invalid recorded activity', duration: invalid(), durationSource: 'none', ambiguous: false },
  ], { invalidCount: 1, ambiguousDates: ['2026-11-03'] }) })
  const html = render('recovery', data)
  assert.match(html, /Gentle walk/); assert.match(html, /12\.5\s*(?:minutes|min)/)
  assert.match(html, /Breathwork/); assert.match(html, /0\s*(?:minutes|min)/)
  assert.match(html, /Full rest/); assert.match(html, /not recorded/i)
  assert.match(html, /manual|detail/i); assert.match(html, /saved|stored/i)
  assert.match(html, /Ambiguous saved sauna/); assert.match(html, /ambiguous|conflict/i)
  assert.match(html, /Invalid recorded activity/); assert.match(html, /invalid/i)
  assert.doesNotMatch(html, /22\.5\s*(?:minutes|min)|total.*22\.5|automatic.*heart|continuous.*heart/i)
})

test('day comparison keeps saved workout status and separate stress, check-in sleep, sleep-log and recovery sources', () => {
  const html = render('consistency')
  assert.match(html, /href="\/dashboard\/progress\/consistency\?range=12w"/)
  assert.match(html, /<table/); assert.match(html, /<caption/); assert.match(html, /scope="col"/)
  assert.match(html, /Saved completed strength session/); assert.match(html, /Saved partial walking session/)
  assert.match(html, /completed/i); assert.match(html, /partial|saved work/i)
  assert.match(html, /check.in sleep/i); assert.match(html, /sleep log/i)
  assert.match(html, /7\s*(?:hours|hr)/); assert.match(html, /6\s*(?:hours|hr)/); assert.match(html, /0\s*(?:hours|hr)/)
  assert.match(html, /8\s*\/10/); assert.match(html, /4\s*\/10/)
  assert.match(html, /Gentle walk/); assert.match(html, /12\.5\s*(?:minutes|min)/)
  assert.match(html, /comparison|alongside/i); assert.match(html, /caus|does not show why|does not prove/i)
  assert.match(html, /not recorded/i)
  assert.doesNotMatch(html, /13\s*(?:hours|hr)|(?:readiness|recovery) score\s*[:=]\s*\d|streak.*earned|credit.*earned/i)
  const rows = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr>/g) || []
  assert.equal(rows.length, 28)
  assert.match(html, /dateTime="2026-11-03"/i); assert.match(html, /dateTime="2026-10-07"/i)
  const twelve = render('consistency', history({ range: '12w', periodLabel: 'Last 12 weeks' }))
  assert.equal((twelve.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr>/g) || []).length, 84)
  assert.match(twelve, /dateTime="2026-08-12"/i)
})

test('independent source errors, safe bounds, empty and single records remain truthful with retry navigation', () => {
  const empty = history({ checkins: source(), sleep: source(), activities: source(), workouts: source() })
  const energy = render('recovery', empty)
  assert.match(energy, /No dated check-in records are available in this view/)
  assert.match(energy, /No dated separate sleep logs are available in this view/)
  assert.match(energy, /No dated recovery activities are available in this view/)
  assert.match(energy, /sleep values mirrored from the sleep form/)
  assert.match(energy, /saved answer alone does not establish a completed check-in/)
  assert.doesNotMatch(energy, /<svg[^>]*role="img"/)
  const single = render('recovery', history({ checkins: source(history().checkins.records.slice(0, 1)) }))
  assert.doesNotMatch(single, /<svg[^>]*role="img"/)
  const failed = history({ checkins: source([], { unavailable: true }), activities: source(history().activities.records, { capped: true }) })
  const partial = render('recovery', failed)
  assert.match(partial, /unavailable|could not|unable/i); assert.match(partial, /retry/i)
  assert.match(partial, /Gentle walk/); assert.match(partial, /500/); assert.match(partial, /earlier|partial|outside/i)
  const failedActivities = render('consistency', history({ activities: source([], { unavailable: true }), workouts: source([], { unavailable: true }) }))
  assert.match(failedActivities, /unavailable|could not|unable/i); assert.match(failedActivities, /retry/i)
  assert.match(failedActivities, /8\s*\/10/); assert.match(failedActivities, /7\s*(?:hours|hr)/)
  assert.doesNotMatch(failedActivities, /0 completed|0 recovery minutes|no workouts completed/i)
  const oldDates = Array.from({ length: 501 }, (_, index) => new Date(Date.parse('2026-11-03T12:00:00Z') - index * 86400000).toISOString().slice(0, 10))
  const cappedDays = render('consistency', history({ range: 'all', periodLabel: 'All-time range',
    checkins: source(oldDates.slice(0, 500).map((date, i) => ({ key: `checkin-${i}`, date, values: values({ stress: value(3) }) })), { capped: true }),
    sleep: source([{ key: 'old-sleep', date: oldDates[500], duration: value(7), quality: value(8) }]),
    activities: source(), workouts: source(),
  }))
  assert.equal((cappedDays.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr>/g) || []).length, 500)
  assert.match(cappedDays, /most recent 500 dates/); assert.match(cappedDays, /earlier dates|earlier records/i)
  assert.doesNotMatch(cappedDays, new RegExp(`dateTime="${oldDates[500]}"`, 'i'))
  const allEmpty = render('consistency', { ...empty, range: 'all', periodLabel: 'All-time range' })
  assert.match(allEmpty, /No dated workout, check-in, sleep or recovery records are available in this view/)
  assert.doesNotMatch(allEmpty, /<tbody>|0 completed|0 recovery minutes|no saved records/i)
})

test('new history routes and presentation remain server-rendered read-only without telemetry, health storage or score reconstruction', () => {
  const source = [...Object.values(routes), componentPath].map(path => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(source, /localStorage|sessionStorage|posthog|TrackEvent|capture\(|fetch\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|calculateBodyFat|estimateBodyFat|runFlameExecutionEngine|getProgramLogicForClient|runWorkoutOS/)
  assert.doesNotMatch(source, /['"]use client['"]/)
})
