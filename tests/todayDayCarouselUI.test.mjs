import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import CardArtworkModule from './cardArtworkFixture.mjs'
import TodayAffirmationModule from './todayAffirmationFixture.mjs'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const scheduleTime = await importTs('lib/schedule/time.ts')
const nodes = (tree, predicate) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate))
  : !tree || typeof tree !== 'object' ? [] : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''
const clone = value => JSON.parse(JSON.stringify(value))
const day = '2026-11-11'

function item(id, title, category, startAt, patch = {}) {
  return { id, title, category, startAt, endAt: startAt ? startAt.replace(':00:00Z', ':30:00Z') : null,
    timing: startAt ? 'scheduled' : 'untimed', continuesFromPreviousDay: false, detail: 'Existing saved detail.',
    href: `/dashboard/schedule#${id}`, status: 'scheduled', ...patch }
}

function fixture(style = 'section', tier = 'ignite') {
  const activities = [
    { id: 'schedule', title: 'Schedule review', category: 'schedule', href: '/dashboard/schedule', status: 'available' },
    { id: 'check-in', title: 'Daily check-in', category: 'check_in', href: '/dashboard/check-in', status: 'available' },
    { id: 'water', title: 'Hydration', category: 'hydration', href: '/dashboard/nutrition?log=water', status: 'available' },
  ].map(activity => ({ detail: 'Existing action detail.', countsTowardProgress: true, canSkip: false, canDefer: false, canResume: false, ...activity }))
  const sections = [
    { id: 'morning', title: 'Morning', range: 'Before 10:00 a.m.', items: [
      item('event:work', 'Saved work', 'work', `${day}T08:00:00Z`, { eventId: 'work' }),
      item('activity:check-in', 'Daily check-in', 'check_in', `${day}T09:00:00Z`, { activityId: 'check-in', href: '/dashboard/check-in' }),
    ] },
    { id: 'midday', title: 'Midday', range: '10:00 a.m. – before 3:00 p.m.', items: [
      item('event:school', 'Saved school', 'school', `${day}T10:00:00Z`, { eventId: 'school' }),
    ] },
    { id: 'evening', title: 'Evening', range: '3:00 p.m. onward', items: [
      item('event:appointment', 'Saved appointment', 'appointment', `${day}T15:00:00Z`, { eventId: 'appointment' }),
    ] },
  ]
  const daySections = { sections, currentSection: 'midday', nextBoundaryAt: `${day}T15:00:00.000Z`, untimed: [
    item('event:all-day', 'Saved all-day commitment', 'personal', null, { timing: 'all_day', eventId: 'all-day' }),
    item('activity:water', 'Hydration', 'hydration', null, { activityId: 'water', href: '/dashboard/nutrition?log=water' }),
  ] }
  const logic = { program: tier, client: { id: 'SYNTHETIC-DAY-CAROUSEL', name: 'Synthetic member' } }
  const schedule = { date: day, timezone: 'UTC', now: `${day}T13:00:00.000Z`, events: [], unavailableSources: [],
    preferences: { carouselStyle: style, executionStyle: 'flow', transitionMinutes: 10 },
    todayViewModel: { version: 1, date: day, timezone: 'UTC', generatedAt: `${day}T13:00:00.000Z`, clientId: logic.client.id, tier,
      today: { activities, completed: 0, total: 3 }, presentedActivities: activities, daySections,
      recommendation: { primary: { id: 'schedule', title: 'Review schedule', category: 'schedule', reason: 'Existing next-step decision.', href: '/dashboard/schedule', completed: false } },
      streakProgress: { available: true, requiredCount: 3, completedCount: 0, secured: false }, nextRefreshAt: daySections.nextBoundaryAt,
      deferredReturnAt: null, quiet: style === 'step', macroReminder: null,
      workout: { state: 'training', inactive: false, title: 'Existing workout', reason: 'Existing safety decision.', inProgress: false } } }
  return { logic, schedule }
}

function modules(react = React, extra = {}, globals = {}) {
  const cache = new Map()
  const mocks = {
    react,
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/CardArtwork': CardArtworkModule,
    '@/components/program-dashboard/TodayAffirmation': TodayAffirmationModule,
    '@/components/program-dashboard/StreakRequirementsCard': { __esModule: true, default: () => React.createElement('div', null, 'Existing streak requirements') },
    '@/lib/schedule/time': scheduleTime,
    '@/lib/schedule/client': { useDailyScheduleRefresh() {} },
    '@/lib/analytics': { trackEvent() {} },
    '@/lib/analytics/todayJourney': { recordTodayActionOpened() {}, recordTodayActionCompletions() {} },
    ...extra,
  }
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    const module = { exports: {} }; cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date, ...globals,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return require(name)
        return load(extname(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: path })
    return module.exports
  }
  return load
}

test('saved dashboard style selects the real three-section carousel or existing next-step view in every tier', () => {
  const Workspace = modules()('components/program-dashboard/TierAwareDashboardWorkspace.tsx').default
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const current = fixture('section', tier), before = clone(current)
    let html = renderToStaticMarkup(React.createElement(Workspace, { tier, ...current }))
    assert.equal((html.match(/data-day-section=/g) || []).length, 3)
    assert.match(html, /data-testid="today-day-carousel"/)
    for (const title of ['Saved work', 'Saved school', 'Saved appointment']) assert.ok(html.includes(title))
    assert.doesNotMatch(html, /Review schedule|Select schedule|Schedule review|At your pace|data-testid="guided-next-step"/)
    assert.match(html, /Today’s progress/)
    assert.deepEqual(current, before)

    current.schedule.preferences.carouselStyle = 'step'
    current.schedule.todayViewModel.quiet = true
    html = renderToStaticMarkup(React.createElement(Workspace, { tier, ...current }))
    assert.match(html, /data-testid="guided-next-step"/); assert.match(html, /At your pace/)
    assert.match(html, /Review schedule/); assert.doesNotMatch(html, /data-testid="today-day-carousel"/)
  }
})

test('day cards retain supplied artwork and existing destinations, with explicit all-day and untimed actions', () => {
  const Carousel = modules()('components/program-dashboard/TodayDayCarousel.tsx').default
  const current = fixture(), model = current.schedule.todayViewModel
  const html = renderToStaticMarkup(React.createElement(Carousel, { day: model.daySections, timezone: 'UTC', onOpen() {} }))
  assert.match(html, /aria-label="Parts of your day"/)
  assert.match(html, /aria-current="time"/)
  assert.match(html, /href="\/dashboard\/check-in"/)
  assert.match(html, /href="\/dashboard\/nutrition\?log=water"/)
  assert.match(html, /src="\/_next\/static\/media\/check-in-640\.webp"/)
  assert.match(html, /width="640" height="700"/)
  assert.match(html, /Any time today/); assert.match(html, /All day/); assert.match(html, /No set time/)
  assert.match(html, /No scheduled time has been added/)
  const ids = [...html.matchAll(/data-day-item-id="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, 6); assert.equal(new Set(ids).size, ids.length)
  assert.doesNotMatch(html, /<a[^>]*>[\s\S]*?<button/)
})

function hooks() {
  const states = [], refs = [], effects = []
  let stateCursor = 0, refCursor = 0, effectCursor = 0
  const react = { ...React, useId: () => 'synthetic-day-carousel',
    useState(initial) { const index = stateCursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
    useRef(initial) { const index = refCursor++; return refs[index] ||= { current: initial } },
    useEffect(callback, deps) { const index = effectCursor++, previous = effects[index]; if (!previous || !deps || deps.some((value, offset) => value !== previous.deps[offset])) effects[index] = { callback, deps, pending: true, cleanup: previous?.cleanup } },
  }
  return { react, render(callback) {
    stateCursor = refCursor = effectCursor = 0
    const tree = callback()
    for (const effect of effects) if (effect.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.callback() }
    return tree
  }, cleanup() { for (const effect of effects) effect.cleanup?.() } }
}

test('section controls and Arrow/Home/End navigate focus without intercepting action links or touch events', () => {
  const runtime = hooks(), opened = [], calls = []
  const Carousel = modules(runtime.react)('components/program-dashboard/TodayDayCarousel.tsx').default
  const current = fixture(), tree = runtime.render(() => Carousel({ day: current.schedule.todayViewModel.daySections, timezone: 'UTC', onOpen: id => opened.push(id) }))
  const cards = nodes(tree, node => node.props?.['data-day-section'])
  cards.forEach((card, index) => {
    assert.equal(card.props.tabIndex, 0)
    card.ref({ scrollIntoView(options) { calls.push(['scroll', index, clone(options)]) }, focus(options) { calls.push(['focus', index, clone(options)]) } })
    assert.equal(card.props.onTouchStart, undefined); assert.equal(card.props.onPointerDown, undefined)
  })
  const controls = nodes(tree, node => node.type === 'button')
  controls[2].props.onClick(); assert.deepEqual(calls.slice(-2).map(call => call.slice(0, 2)), [['scroll', 2], ['focus', 2]])
  assert.equal(controls[2].props['aria-controls'], cards[2].props.id)
  const press = (index, key, descendant = false) => {
    const target = {}, event = { key, currentTarget: target, target: descendant ? {} : target, prevented: false, preventDefault() { this.prevented = true } }
    cards[index].props.onKeyDown(event); return event
  }
  for (const [from, key, to] of [[0, 'ArrowRight', 1], [0, 'ArrowLeft', 0], [1, 'End', 2], [2, 'Home', 0]]) {
    assert.equal(press(from, key).prevented, true)
    assert.deepEqual(calls.at(-1).slice(0, 2), ['focus', to])
  }
  const before = calls.length
  assert.equal(press(0, 'ArrowRight', true).prevented, false)
  assert.equal(press(0, 'Tab').prevented, false); assert.equal(calls.length, before)
  assert.deepEqual(opened, [])
  runtime.cleanup()
})

test('style switching and carousel navigation preserve schedule, completion and goal inputs without issuing writes', () => {
  const runtime = hooks(), current = fixture(), before = clone(current), refreshes = []
  const load = modules(runtime.react, { 'next/navigation': { useRouter: () => ({ refresh() { refreshes.push('refresh') } }) } }, {
    fetch() { assert.fail('Changing Today presentation cannot write schedule, completion history or goals.') },
    window: { setTimeout() { assert.fail('This fixture has no deferred timer.') }, clearTimeout() {} },
  })
  const Workspace = load('components/program-dashboard/TierAwareDashboardWorkspace.tsx').default
  const Today = load('components/program-dashboard/GuidedToday.tsx').default
  for (const style of ['section', 'step', 'section']) {
    const state = { ...current.schedule, preferences: { ...current.schedule.preferences, carouselStyle: style } }
    const branch = Workspace({ tier: 'ignite', logic: current.logic, schedule: state }).props.children
    assert.equal(branch.props.logic, current.logic); assert.equal(branch.props.schedule, state)
    const tree = runtime.render(() => Today(branch.props))
    const carousel = nodes(tree, node => node.type?.name === 'TodayDayCarousel')[0]
    if (style === 'section') assert.equal(carousel.props.day, current.schedule.todayViewModel.daySections)
    else assert.equal(carousel, undefined)
  }
  assert.deepEqual(refreshes, []); assert.deepEqual(current, before)
  runtime.cleanup()
})

test('section style keeps safety guidance and source-unavailable notices visible, and refreshes a missing section snapshot', () => {
  const load = modules(), Today = load('components/program-dashboard/GuidedToday.tsx').default
  const current = fixture()
  current.schedule.unavailableSources = ['saved_events']
  current.schedule.todayViewModel.recommendation.primary = { id: 'safety', category: 'recovery', title: 'Review today’s recovery guidance', reason: 'Existing safety guidance.', href: '/dashboard/recovery', completed: false }
  let html = renderToStaticMarkup(React.createElement(Today, { ...current, presentation: 'section' }))
  assert.match(html, /data-testid="guided-next-step"/); assert.match(html, /href="\/dashboard\/recovery"/)
  assert.match(html, /Some schedule details are temporarily unavailable/)
  assert.match(html, /data-testid="today-day-carousel"/)
  assert.doesNotMatch(html, /Later today|Schedule review|Review schedule|Select schedule/)

  delete current.schedule.todayViewModel.daySections
  const runtime = hooks(), refreshes = []
  const Missing = modules(runtime.react, { 'next/navigation': { useRouter: () => ({ refresh() { refreshes.push('refresh') } }) } }, {
    fetch() { assert.fail('Missing section data must never synthesize a completion.') },
    window: { setTimeout() { assert.fail('No deferred action exists.') }, clearTimeout() {} },
  })('components/program-dashboard/GuidedToday.tsx').default
  const render = () => runtime.render(() => Missing({ ...current, presentation: 'section' }))
  const tree = render(); render()
  assert.match(text(tree), /Your saved day could not be confirmed/)
  assert.equal(nodes(tree, node => node.type?.name === 'TodayDayCarousel').length, 0)
  assert.equal(refreshes.length, 1)
  nodes(tree, node => node.type === 'button' && text(node) === 'Refresh day')[0].props.onClick()
  assert.equal(refreshes.length, 2)
  runtime.cleanup()
})
