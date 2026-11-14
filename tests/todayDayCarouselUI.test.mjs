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

test('saved dashboard style selects the time-section and anytime carousel or existing next-step view in every tier', () => {
  const Workspace = modules()('components/program-dashboard/TierAwareDashboardWorkspace.tsx').default
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const current = fixture('section', tier), before = clone(current)
    let html = renderToStaticMarkup(React.createElement(Workspace, { tier, ...current }))
    assert.equal((html.match(/data-day-section=/g) || []).length, 4)
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
  assert.match(html, /aria-label="Today’s actions"/)
  assert.doesNotMatch(html, /Parts of your day|Your day, in view|Your commitments and remaining actions|Swipe through your day|↗|<button/)
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

test('carousel panels preserve cards and support bounded keyboard navigation without separate buttons', () => {
  const runtime = hooks(), opened = []
  const Carousel = modules(runtime.react)('components/program-dashboard/TodayDayCarousel.tsx').default
  const current = fixture(), before = clone(current)
  const tree = runtime.render(() => Carousel({ day: current.schedule.todayViewModel.daySections, timezone: 'UTC', onOpen: id => opened.push(id) }))
  const sections = nodes(tree, node => node.props?.['data-day-section'])
  assert.deepEqual(sections.map(section => section.props['data-day-section']), ['morning', 'midday', 'evening', 'untimed'])
  for (const section of sections) {
    assert.equal(section.props.tabIndex, 0)
    assert.equal(typeof section.props.onKeyDown, 'function')
    assert.equal(section.props.hidden, undefined)
  }
  const navigation = []
  sections.forEach((section, index) => section.ref({
    scrollIntoView(options) { navigation.push(['scroll', index, options.inline]) },
    focus(options) { navigation.push(['focus', index, options.preventScroll]) },
  }))
  function key(index, key, nested = false) {
    const target = {}, event = { key, target, currentTarget: nested ? {} : target, preventDefault() { navigation.push(['prevent']) } }
    sections[index].props.onKeyDown(event)
  }
  key(0, 'ArrowRight'); key(1, 'End'); key(3, 'ArrowRight'); key(3, 'Home'); key(0, 'ArrowLeft')
  assert.deepEqual(navigation.filter(entry => entry[0] === 'focus').map(entry => entry[1]), [1, 3, 3, 0, 0])
  assert.ok(navigation.filter(entry => entry[0] === 'focus').every(entry => entry[2] === true))
  const count = navigation.length
  key(1, 'ArrowRight', true); key(1, 'Enter')
  assert.equal(navigation.length, count)
  assert.equal(nodes(tree, node => node.type === 'button').length, 0)
  const actions = nodes(tree, node => node.type?.name === 'DayAction')
  assert.equal(actions.length, 6)
  for (const action of actions) {
    const card = action.type(action.props)
    const link = nodes(card, node => node.type === 'a')[0]
    assert.equal(link.props.href, action.props.item.href)
    link.props.onClick()
    link.props.onClick()
  }
  assert.deepEqual(opened, actions.flatMap(action => [action.props.item.activityId || action.props.item.id, action.props.item.activityId || action.props.item.id]))
  assert.deepEqual(current, before)
  const css = readFileSync('components/program-dashboard/TodayDayCarousel.module.css', 'utf8')
  assert.match(css, /\.carousel\s*\{[^}]*display: flex;[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory/)
  assert.match(css, /\.section\s*\{[^}]*flex: 0 0 100%;[^}]*scroll-snap-align: center/)
  assert.match(css, /\.artwork\s*\{[^}]*width: 100%;[^}]*height: auto/)
  assert.match(css, /\.action:focus-visible/)
  assert.doesNotMatch(css, /\.arrow|\.navigation/)
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


test('Any time today is inside the scroll track and empty untimed actions do not create a fourth panel', () => {
  const runtime = hooks()
  const Carousel = modules(runtime.react)('components/program-dashboard/TodayDayCarousel.tsx').default
  const day = fixture().schedule.todayViewModel.daySections
  const render = () => runtime.render(() => Carousel({ day, timezone: 'UTC', onOpen() {} }))
  let tree = render()
  let track = nodes(tree, node => node.props?.className === 'carousel')[0]
  assert.equal(nodes(track, node => node.props?.['data-day-section'] === 'untimed').length, 1)
  assert.equal(nodes(tree, node => node.props?.['data-day-section'] === 'untimed').length, 1)
  day.untimed = []
  tree = render()
  const sections = nodes(tree, node => node.props?.['data-day-section'])
  assert.equal(sections.length, 3)
  const focus = []
  sections.forEach((section, i) => section.ref({ scrollIntoView() {}, focus() { focus.push(i) } }))
  const target = {}
  sections[0].props.onKeyDown({ target, currentTarget: target, key: 'End', preventDefault() {} })
  assert.deepEqual(focus, [2])
  runtime.cleanup()
})

test('pending sections remain navigable and keep an honest Anytime panel while enrichment updates the same carousel', () => {
  const runtime = hooks(), Carousel = modules(runtime.react)('components/program-dashboard/TodayDayCarousel.tsx').default
  const empty = fixture().schedule.todayViewModel.daySections
  for (const section of empty.sections) section.items = []
  empty.untimed = []
  const pending = renderToStaticMarkup(React.createElement(Carousel, { day: empty, timezone: 'UTC', pending: true, onOpen() {} }))
  assert.equal((pending.match(/data-day-section=/g) || []).length, 4)
  assert.match(pending, /Any time today/)
  assert.match(pending, /Your other saved actions and current guidance are still loading/)
  assert.doesNotMatch(pending, /No remaining saved actions/)
  const verifiedCheckIn = clone(empty)
  verifiedCheckIn.sections[0].items.push(item('activity:check-in', 'Daily check-in', 'check_in', null, { activityId: 'check-in', href: '/dashboard/check-in', timingPending: true }))
  const early = renderToStaticMarkup(React.createElement(Carousel, { day: verifiedCheckIn, timezone: 'UTC', pending: true, onOpen() {} }))
  assert.match(early, /Timing is being confirmed/)
  assert.doesNotMatch(early, /No set time/, 'Early completion verification cannot invent an untimed schedule preference')

  let tree = runtime.render(() => Carousel({ day: empty, timezone: 'UTC', pending: true, keepAnytime: true, onOpen() {} }))
  const original = nodes(tree, node => node.props?.['data-day-section'])
  const calls = []
  original.forEach((section, index) => section.ref({ scrollIntoView() { calls.push(['scroll', index]) }, focus() { calls.push(['focus', index]) } }))
  const target = {}
  original[0].props.onKeyDown({ target, currentTarget: target, key: 'End', preventDefault() {} })
  assert.deepEqual(calls, [['scroll', 3], ['focus', 3]])
  const enriched = fixture().schedule.todayViewModel.daySections
  tree = runtime.render(() => Carousel({ day: enriched, timezone: 'UTC', pending: false, keepAnytime: true, onOpen() {} }))
  const updated = nodes(tree, node => node.props?.['data-day-section'])
  assert.deepEqual(updated.map(node => [node.key, node.props.id]), original.map(node => [node.key, node.props.id]))
  assert.deepEqual(calls, [['scroll', 3], ['focus', 3]], 'Enrichment never moves scroll or focus itself')
  tree = runtime.render(() => Carousel({ day: empty, timezone: 'UTC', pending: false, keepAnytime: true, onOpen() {} }))
  assert.equal(nodes(tree, node => node.props?.['data-day-section']).length, 4, 'A previously selected Anytime panel is retained even if its current actions complete')
  runtime.cleanup()
})

test('removing a focused card restores its current check-in or panel without stealing deliberate external focus', () => {
  const runtime = hooks(), body = {}, document = { body, documentElement: {}, activeElement: body }
  const Carousel = modules(runtime.react, {}, { document })('components/program-dashboard/TodayDayCarousel.tsx').default
  let day = fixture().schedule.todayViewModel.daySections, cards = [], calls = []
  const render = () => runtime.render(() => Carousel({ day, timezone: 'UTC', onOpen() {} }))
  let tree = render()
  const panels = nodes(tree, node => node.props?.['data-day-section']).map(node => ({
    dataset: { daySection: node.props['data-day-section'] },
    focus(options) { calls.push(['panel', this.dataset.daySection, options.preventScroll]) },
    scrollIntoView() { assert.fail('Data replacement cannot change carousel scroll position') },
  }))
  nodes(tree, node => node.props?.['data-day-section']).forEach((node, index) => node.ref(panels[index]))
  const root = { querySelectorAll: () => cards, contains: target => target === panels[0] }
  tree.ref.current = root
  const oldCard = { dataset: { dayItemId: 'activity:check-in', activityId: 'check-in' } }
  const oldLink = { isConnected: true, closest(selector) { return selector === '[data-day-section]' ? panels[0] : oldCard } }
  tree.props.onFocusCapture({ target: oldLink })

  const currentLink = { focus(options) { calls.push(['check-in', options.preventScroll]) } }
  cards = [{ dataset: { dayItemId: 'event:current-check-in', eventId: 'current-check-in', activityId: 'check-in' }, querySelector: () => currentLink }]
  oldLink.isConnected = false
  day = clone(day); day.sections[0].items[1] = { ...day.sections[0].items[1], id: 'event:current-check-in', eventId: 'current-check-in' }
  tree = render()
  assert.deepEqual(calls, [['check-in', true]], 'The fresh equivalent check-in receives focus with preventScroll')

  calls = []; document.activeElement = { id: 'intentional-external-focus' }; day = clone(day); tree = render()
  assert.deepEqual(calls, [], 'A deliberate focus outside the carousel is preserved')

  document.activeElement = body; cards = []; day = clone(day); tree = render()
  assert.deepEqual(calls, [['panel', 'morning', true]], 'Completed/removed actions fall back to their existing panel')
  calls = []
  tree.props.onBlurCapture({ currentTarget: root, relatedTarget: { id: 'outside-button' } })
  day = clone(day); render()
  assert.deepEqual(calls, [], 'An intentional blur clears restoration ownership')
  runtime.cleanup()
})

test('bootstrap check-in keeps its React key when a saved occurrence enriches it without duplicating keys', () => {
  const runtime = hooks(), Carousel = modules(runtime.react)('components/program-dashboard/TodayDayCarousel.tsx').default
  const current = fixture().schedule.todayViewModel.daySections
  const render = day => runtime.render(() => Carousel({ day, timezone: 'UTC', onOpen() {} }))
  const before = nodes(render(current), node => node.type?.name === 'DayAction' && node.props.item.activityId === 'check-in')[0]
  const enriched = clone(current)
  enriched.sections[0].items[1] = { ...enriched.sections[0].items[1], id: 'event:scheduled-check-in', eventId: 'scheduled-check-in' }
  enriched.sections[0].items.push({ ...enriched.sections[0].items[1], id: 'event:second-check-in', eventId: 'second-check-in' })
  const after = nodes(render(enriched), node => node.type?.name === 'DayAction' && node.props.item.activityId === 'check-in')
  assert.equal(before.key, after[0].key)
  assert.equal(new Set(after.map(node => node.key)).size, after.length)
  runtime.cleanup()
})
