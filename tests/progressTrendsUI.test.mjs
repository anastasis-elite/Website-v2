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
    runInNewContext(code, { module, exports: module.exports, Date, Intl, Map, Set,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name === 'server-only') return {}
        if (name === 'next/link') return link
        if (name === 'next/navigation') return { notFound: () => { throw new Error('SYNTHETIC_NOT_FOUND') } }
        if (name.endsWith('.css')) return css
        const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null
        if (!target) return require(name)
        return load(extname(target) ? target : ['.ts', '.tsx', '.js'].map(extension => target + extension).find(existsSync) || target)
      },
    }, { filename: file })
    return module.exports
  }
  return load(entry)
}

const base = { range: '12w', today: '2026-11-04', periodLabel: 'Last 12 weeks', coverageStart: '2026-10-02', coverageEnd: '2026-11-02', capped: false }
const metric = (label, unit, points = [], overrides = {}) => ({ label, unit, points, unavailable: false, capped: false, ...overrides })
const nutrition = overrides => ({ ...base, timeZone: 'America/Chicago', ambiguousDays: 0, series: {
  hydration: metric('Hydration', 'oz', [{ date: '2026-11-02', value: 0 }]),
  calories: metric('Calories', 'kcal', [], { unavailable: true }),
  protein: metric('Protein', 'g', [{ date: '2026-11-02', value: 20 }]),
  carbs: metric('Carbohydrates', 'g'), fats: metric('Fats', 'g'),
}, ...overrides })
const cycle = overrides => ({ ...base, enabled: true, unavailable: false, invalidCount: 0,
  intervals: [{ start: '2026-10-02', date: '2026-11-02', days: 31 }], points: [{ date: '2026-11-02', value: 31 }], ...overrides })
const components = loadModule('components/program-dashboard/ProgressTrends.tsx')
const render = (name, data) => renderToStaticMarkup(React.createElement(components[name], { data }))

test('nutrition cards and tables distinguish recorded zero, missing and failed metrics', () => {
  const card = render('NutritionProgressCard', nutrition({ capped: true, ambiguousDays: 2 }))
  for (const label of ['Hydration', 'Calories', 'Protein', 'Carbohydrates', 'Fats']) assert.ok(card.includes(label))
  assert.match(card, /0 <span>oz/)
  assert.match(card, /Temporarily unavailable/)
  assert.match(card, /Not recorded/)
  assert.match(card, /at most 500 recent daily logs/)
  assert.match(card, /Conflicting or incomplete daily totals are excluded/)
  assert.match(card, /href="\/dashboard\/progress\/nutrition\?range=12w"/)
  const history = render('NutritionProgressHistory', nutrition())
  assert.match(history, /<td>0<\/td><td>Unavailable<\/td><td>20<\/td><td>Not recorded<\/td><td>Not recorded<\/td>/)
  assert.match(history, /Retry nutrition history/)
  assert.match(history, /<caption>Recorded daily nutrition totals/)
  assert.match(history, /href="\/dashboard\/progress\/nutrition\?range=all"/)
  assert.match(history, /aria-current="page"/)
})

test('nutrition chart limits displayed records and uses dots without filling missing dates', () => {
  const data = nutrition()
  data.series.protein.points = Array.from({ length: 15 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, value: index }))
  const card = render('NutritionProgressCard', data)
  assert.equal((card.match(/<circle/g) || []).length, 12)
  assert.doesNotMatch(card, /<polyline|<path/)
  assert.match(card, /2026-10-04: 3 g/)
  assert.doesNotMatch(card, /2026-10-01: 0 g/)
})

test('cycle disabled preference hides interval records in cards and detail pages', () => {
  const disabled = cycle({ enabled: false })
  assert.equal(render('CycleProgressCard', disabled), '')
  const history = render('CycleProgressHistory', disabled)
  assert.match(history, /Cycle tracking is currently off/)
  assert.doesNotMatch(history, /31 days|2026-10-02|2026-11-02|<table|<svg/)
})

test('cycle history shows calendar interval evidence, caps and unavailable retry separately', () => {
  const card = render('CycleProgressCard', cycle())
  assert.match(card, /31 <span>days · latest interval/)
  assert.match(card, /href="\/dashboard\/progress\/cycle\?range=12w"/)
  const history = render('CycleProgressHistory', cycle({ capped: true, invalidCount: 1 }))
  assert.match(history, /31 days/)
  assert.match(history, /at most 500 recent logged starts/)
  assert.match(history, /Some saved dates were invalid/)
  assert.match(history, /href="\/dashboard\/cycle"/)
  const failed = render('CycleProgressHistory', cycle({ unavailable: true }))
  assert.match(failed, /Retry cycle history/)
  assert.doesNotMatch(failed, /31 days|<table|<svg/)
})

const owner = { id: 'synthetic-owner' }
const member = overrides => ({ client_id: 'synthetic-client', auth_user_id: owner.id, program: 'ignite', access: true,
  active: true, membership_expires_at: '2099-01-01T00:00:00Z', ...overrides })
function pageFixture(kind, overrides = {}, authFailure = false) {
  const reads = []
  const exports = loadModule(`app/dashboard/progress/${kind}/page.tsx`, {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => {
      if (authFailure) throw new Error('AUTH_FAILED')
      return { supabase: {}, user: owner, client: member(overrides) }
    } },
    '@/lib/dashboard/progressOverview': { progressRange: value => ['4w', '12w', 'all'].includes(value) ? value : '4w' },
    '@/lib/dashboard/nutritionProgress': { loadNutritionProgress: async args => { reads.push(args); return nutrition() } },
    '@/lib/dashboard/cycleProgress': { loadCycleProgress: async args => { reads.push(args); return cycle() } },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: ({ children, backHref, backLabel }) => React.createElement('div', null, React.createElement('a', { href: backHref }, backLabel), children) },
    '@/components/program-dashboard/ProgressTrends': { NutritionProgressHistory: () => null, CycleProgressHistory: () => null },
  })
  return { ...exports, reads }
}

test('new trend routes retain range and permit only current owner coaching-tier access', async () => {
  for (const kind of ['nutrition', 'cycle']) {
    for (const program of ['ember', 'ignite', 'phoenix']) {
      const fixture = pageFixture(kind, { program })
      const page = await fixture.default({ searchParams: Promise.resolve({ range: 'all' }) })
      assert.equal(fixture.dynamic, 'force-dynamic')
      assert.equal(fixture.reads.length, 1)
      assert.equal(fixture.reads[0].user.id, owner.id)
      assert.equal(fixture.reads[0].range, 'all')
      assert.match(renderToStaticMarkup(page), /href="\/dashboard\/progress\?range=all"/)
    }
    for (const denied of [{ program: 'free' }, { program: 'tracker' }, { active: false }, { access: false }, { auth_user_id: 'other-owner' }, { membership_expires_at: '2020-01-01T00:00:00Z' }]) {
      const fixture = pageFixture(kind, denied)
      await assert.rejects(fixture.default({ searchParams: Promise.resolve({ range: '12w' }) }), /SYNTHETIC_NOT_FOUND/)
      assert.equal(fixture.reads.length, 0)
    }
    const failed = pageFixture(kind, {}, true)
    await assert.rejects(failed.default({ searchParams: Promise.resolve({}) }), /AUTH_FAILED/)
    assert.equal(failed.reads.length, 0)
    const malformed = pageFixture(kind)
    await malformed.default({ searchParams: Promise.resolve({ range: ['all'] }) })
    assert.equal(malformed.reads[0].range, '4w')
  }
})
