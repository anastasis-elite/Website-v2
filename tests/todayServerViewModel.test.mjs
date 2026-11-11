import CardArtworkModule from './cardArtworkFixture.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve, extname } from 'node:path'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const { buildTodayViewModel } = await importTs('lib/dashboard/buildTodayViewModel.ts')
const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { getStreakRequirementProgress } = await importTs('lib/dashboard/logic/streakRequirementProgress.ts')
const date = '2026-11-03'
const clone = value => JSON.parse(JSON.stringify(value))
function assertSerializable(value) {
  if (value === null || value === undefined || ['string', 'boolean'].includes(typeof value)) return
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return }
  assert.equal(typeof value, 'object', 'A server view model must not carry executable values.')
  if (!Array.isArray(value)) assert.equal(Object.getPrototypeOf(value), Object.prototype, 'A server view model must carry plain data only.')
  for (const child of Object.values(value)) assertSerializable(child)
}
const nodes = (tree, predicate) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate))
  : !tree || typeof tree !== 'object' ? [] : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''

function flame(program, completed = {}, day = date) {
  const requiredItems = { dailyCheckIn: true, nutrition: true, hydration: true, workoutOrMovement: true,
    recovery: program === 'phoenix', sleep: false, customTasks: program !== 'ember' }
  const completedItems = { dailyCheckIn: true, nutrition: false, hydration: false, workoutOrMovement: false,
    recovery: false, sleep: false, customTasks: false, ...completed }
  const streakEligible = Object.entries(requiredItems).every(([key, required]) => !required || completedItems[key])
  return { dailyScore: 100, streak: 2, streakEligible, requirements: { date: day, programTier: program,
    requiredItems, completedItems, streakEligible, completionScore: 100, missedDayCount: 0,
    capacityStatus: 'moderate_capacity', resetMessage: null } }
}

function fixture(program = 'ignite') {
  const logic = { program, client: { id: 'SYNTHETIC-TODAY-OWNER', name: 'Synthetic member' }, flameState: flame(program),
    assessments: { dailyCompleted: true }, symptoms: { redFlag: false },
    hydration: { target: 80, consumed: 20, remaining: 60, percent: 25, status: 'ready',
      presentationPacing: { state: 'behind', prompt: 'Add what you have had.', nextRefreshAt: null } },
    nutrition: { dataStatus: 'known', calories: { target: 2000, consumed: 500, remaining: 1500, percent: 25 },
      protein: { percent: 25 }, carbs: { percent: 25 }, fats: { percent: 25 },
      pacing: { state: 'behind', prompt: 'Log what you have had.', nextRefreshAt: null } },
    execution: { workoutComplete: false, workoutInProgress: false, recoveryComplete: false, nutritionLogged: false },
    workout: { assigned: true, title: 'Existing saved workout' },
    workoutDecision: { assignedWorkout: { workout_state: 'training' }, canTrain: true,
      adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Existing saved decision.' },
    recoveryStatus: { reasoning: 'Existing recovery guidance.' }, capacityStatus: { status: 'moderate_capacity' },
    recoveryCheck: { energy: 5, stress: 3, soreness: 2 }, sleep: { hours: 8, quality: 4 } }
  const schedule = { date, timezone: 'UTC', now: `${date}T13:00:00.000Z`, events: [], nextActionableEvent: null,
    preferences: { carouselStyle: 'section', executionStyle: 'flow', transitionMinutes: 10 },
    dailyGuide: { date, activities: { schedule: { status: 'reviewed' } } }, unavailableSources: [] }
  return { logic, schedule }
}

function modelFor(current) {
  const model = buildTodayViewModel(current.logic, current.schedule)
  current.schedule.todayViewModel = model
  return model
}

test('section style includes its exact local boundary while step keeps existing refresh and completion decisions', () => {
  const current = fixture()
  current.schedule.now = `${date}T09:59:59.000Z`
  current.logic.nutrition.pacing.nextRefreshAt = `${date}T11:00:00.000Z`
  current.logic.hydration.presentationPacing.nextRefreshAt = `${date}T12:00:00.000Z`
  const before = clone(current)
  const section = buildTodayViewModel(current.logic, current.schedule)
  assert.equal(section.daySections.currentSection, 'morning')
  assert.equal(section.nextRefreshAt, `${date}T10:00:00.000Z`)
  const step = buildTodayViewModel(current.logic, { ...current.schedule, preferences: { ...current.schedule.preferences, carouselStyle: 'step' } })
  assert.equal(step.daySections, undefined)
  assert.equal(step.nextRefreshAt, `${date}T11:00:00.000Z`)
  assert.deepEqual(step.today, section.today)
  assert.deepEqual(step.streakProgress, section.streakProgress)
  assert.deepEqual(current, before)
})

function completeFixture(program = 'ignite') {
  const current = fixture(program)
  const flags = { dailyCheckIn: true, nutrition: true, hydration: true, workoutOrMovement: true,
    recovery: true, sleep: true, customTasks: true }
  current.logic.flameState = flame(program, flags)
  Object.assign(current.logic.execution, { workoutComplete: true, recoveryComplete: true, nutritionLogged: true })
  Object.assign(current.logic.hydration, { consumed: 80, remaining: 0, percent: 100, presentationPacing: { state: 'complete' } })
  current.logic.nutrition.calories.percent = 100
  current.logic.nutrition.protein.percent = 100
  current.logic.nutrition.pacing = { state: 'complete' }
  return current
}

function harness(current = fixture()) {
  const states = [], refs = [], effects = [], modules = new Map(), timers = new Map()
  const refreshCalls = [], fetchCalls = [], scheduleRefreshCalls = [], analytics = []
  let stateCursor = 0, refCursor = 0, effectCursor = 0, nextTimer = 1, focusReturns = 0, headingFocus = 0
  let fetchResult = { ok: true, body: { dailyGuide: { date, activities: { water: { status: 'deferred', until: `${date}T14:00:00Z` } } } } }
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [current.schedule.now])) } static now() { return Date.parse(current.schedule.now) } }
  const router = { refresh() { refreshCalls.push('refresh') } }
  const mocks = {
    react: { ...React, useId: () => 'synthetic-today-dialog', useMemo: callback => callback(), useCallback: callback => callback,
      useState(initial) { const index = stateCursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
      useRef(initial) { const index = refCursor++; return refs[index] ||= { current: initial } },
      useEffect(callback, deps) { const index = effectCursor++, previous = effects[index]
        if (!previous || !deps || deps.some((value, offset) => value !== previous.deps[offset])) effects[index] = { callback, deps, pending: true, cleanup: previous?.cleanup }
      } },
    '@/components/CardArtwork': CardArtworkModule,
    'next/link': { __esModule: true, default: 'a' }, 'next/navigation': { useRouter: () => router },
    '@/lib/schedule/client': { useDailyScheduleRefresh(...args) { scheduleRefreshCalls.push(args) } },
    '@/lib/analytics': { trackEvent(...args) { analytics.push(args) } },
    '@/lib/analytics/todayJourney': { recordTodayActionOpened(...args) { analytics.push(['opened', ...args]) }, recordTodayActionCompletions(...args) { analytics.push(['completed', ...args]) } },
  }
  const window = { setTimeout(callback, delay) { const key = nextTimer++; timers.set(key, { callback, delay }); return key }, clearTimeout(key) { timers.delete(key) } }
  const fetch = async (url, options) => { fetchCalls.push({ url, options, body: JSON.parse(options.body) }); return { ok: fetchResult.ok, json: async () => fetchResult.body } }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    const module = { exports: {} }; modules.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date: FixedDate, window, fetch,
      require(name) {
        if (mocks[name]) return mocks[name]
        if (name === 'server-only' || /(?:buildTodayViewModel|todayActivities|dailyRecommendation|streakRequirementProgress|todayCompletion|targetEngine|generateProgram|getProgramLogicEngine|\/logic\/engines)$/.test(name)) throw new Error(`Authoritative client import forbidden: ${name}`)
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!base) return require(name)
        if (base.endsWith('.css')) return {}
        const target = extname(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx'
        return load(target)
      } }, { filename: path })
    return module.exports
  }
  const Today = load('components/program-dashboard/GuidedToday.tsx').default
  let dialogNode
  const dialog = { open: false, showModal() { this.open = true }, close() { this.open = false; dialogNode?.props.onClose() } }
  function render() {
    stateCursor = refCursor = effectCursor = 0
    const tree = Today({ logic: current.logic, schedule: current.schedule })
    dialogNode = nodes(tree, node => node.type === 'dialog')[0]
    if (dialogNode) { dialogNode.ref.current = dialog; nodes(dialogNode, node => node.type === 'h2')[0].ref.current = { focus() { headingFocus++ } } }
    for (const effect of effects) if (effect.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.callback() }
    return tree
  }
  return { current, render, dialog, timers, fetchCalls, refreshCalls, scheduleRefreshCalls, analytics,
    setFetchResult(value) { fetchResult = value }, get dialogNode() { render(); return dialogNode },
    get focusReturns() { return focusReturns }, get headingFocus() { return headingFocus },
    open() { const trigger = nodes(render(), node => node.props['data-testid'] === 'today-progress')[0]; trigger.props.onClick({ currentTarget: { focus() { focusReturns++ } } }); return render() },
    cleanup() { for (const effect of effects) effect.cleanup?.() },
  }
}

test('server Today model matches the existing tier decisions, required evidence and canonical history without mutating inputs', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const current = fixture(tier), before = clone(current)
    const model = buildTodayViewModel(current.logic, current.schedule)
    const today = buildTodayActivities(current.logic, current.schedule)
    assert.deepEqual(clone(model.today), clone(today))
    assert.deepEqual(clone(model.presentedActivities), clone(presentTodayActivities(current.logic, current.schedule, today.activities)))
    assert.deepEqual(clone(model.recommendation), clone(buildDailyRecommendation(current.logic, current.schedule)))
    assert.deepEqual(clone(model.streakProgress), clone(getStreakRequirementProgress(current.logic.flameState, current.schedule.date,
      { programTier: tier, now: current.schedule.now, timezone: current.schedule.timezone })))
    assert.equal(model.tier, tier)
    assert.equal(model.clientId, current.logic.client.id)
    assert.deepEqual(current, before)
    assertSerializable(model)
    assert.doesNotThrow(() => JSON.stringify(model))
  }
})

test('saved Schedule defer and skip decisions survive the server adapter with unchanged action priority and resume limits', () => {
  const current = fixture()
  current.schedule.events = [{ id: 'saved-water', event_type: 'hydration', status: 'deferred', suggested: false,
    start_at: `${date}T12:00:00Z`, end_at: `${date}T12:10:00Z`, adjusted_start_at: `${date}T14:00:00Z` }]
  current.schedule.dailyGuide.activities.water = { status: 'deferred', until: `${date}T13:20:00Z` }
  current.schedule.dailyGuide.activities.nutrition = { status: 'skipped' }
  const model = buildTodayViewModel(current.logic, current.schedule)
  const water = model.presentedActivities.find(activity => activity.id === 'water')
  assert.equal(water.status, 'deferred')
  assert.equal(water.canResume, false, 'A saved Schedule move cannot be undone through a free Resume control.')
  assert.equal(model.presentedActivities.find(activity => activity.id === 'nutrition').status, 'skipped')
  assert.equal(model.recommendation.primary.id, 'workout')
  assert.deepEqual(clone(model.recommendation), clone(buildDailyRecommendation(current.logic, current.schedule)))
  current.logic.symptoms.redFlag = true
  assert.equal(buildTodayViewModel(current.logic, current.schedule).recommendation.primary.id, 'safety')
})

test('only authoritative required completion secures the model; optional score, empty cards and unknown evidence do not', () => {
  const current = completeFixture()
  current.logic.flameState = flame('ignite', { dailyCheckIn: true, nutrition: true, hydration: true, workoutOrMovement: true, recovery: true, sleep: true })
  let model = buildTodayViewModel(current.logic, current.schedule)
  assert.equal(model.today.completed, model.today.total)
  assert.equal(model.presentedActivities.length, 0)
  assert.equal(model.streakProgress.secured, false)
  assert.equal(model.recommendation.primary.title, 'A little moment, just for you.')
  current.logic.flameState = flame('ignite', { dailyCheckIn: true, nutrition: true, hydration: true, workoutOrMovement: true, recovery: true, sleep: true, customTasks: true })
  model = buildTodayViewModel(current.logic, current.schedule)
  assert.equal(model.streakProgress.secured, true)
  assert.equal(model.recommendation.primary.title, 'Day completed')
  assert.equal(model.recommendation.primary.reason, 'Reward yourself with a little treat.')
  for (const invalid of [null, { error: 'Synthetic failed read' }, { ...current.logic.flameState, streakEligible: false }]) {
    current.logic.flameState = invalid
    model = buildTodayViewModel(current.logic, current.schedule)
    assert.equal(model.streakProgress.available, false)
    assert.equal(model.streakProgress.secured, false)
    assert.notEqual(model.recommendation.primary.title, 'Day completed')
  }
})

test('server boundaries retain cumulative pace, recovery and explicit defer refresh times rather than freezing visibility', () => {
  const current = fixture()
  current.logic.nutrition.pacing = { state: 'on_pace', prompt: 'On pace.', nextRefreshAt: `${date}T13:30:00.001Z` }
  current.logic.hydration.presentationPacing = { state: 'on_pace', prompt: 'On pace.', nextRefreshAt: `${date}T13:45:00.001Z` }
  current.logic.execution.recoveryEvidence = { ownerUserId: 'SYNTHETIC-USER', clientId: current.logic.client.id,
    date, available: true, completedAt: [], unlinkedRecordCount: 0 }
  current.schedule.events = [{ id: 'future-recovery', event_type: 'recovery', user_id: 'SYNTHETIC-USER', client_id: current.logic.client.id,
    status: 'scheduled', start_at: `${date}T14:00:00Z`, end_at: `${date}T14:15:00Z` }]
  current.schedule.dailyGuide.activities.water = { status: 'deferred', until: `${date}T13:20:00Z` }
  let model = buildTodayViewModel(current.logic, current.schedule)
  assert.equal(model.nextRefreshAt, `${date}T13:30:00.001Z`)
  assert.equal(model.deferredReturnAt, `${date}T13:20:00.000Z`)
  assert.ok(!model.presentedActivities.some(activity => ['nutrition', 'water', 'recovery'].includes(activity.id)))
  current.schedule.now = `${date}T13:31:00.000Z`
  current.logic.nutrition.pacing = { state: 'behind', prompt: 'Log what you have had.', nextRefreshAt: null }
  model = buildTodayViewModel(current.logic, current.schedule)
  assert.ok(model.presentedActivities.some(activity => activity.id === 'nutrition'))
  assert.equal(model.nextRefreshAt, `${date}T13:45:00.001Z`)
  assert.equal(model.deferredReturnAt, null)
})

test('member-local midnight changes completion copy only after a fresh server model for the selected day', () => {
  const current = completeFixture()
  current.schedule.timezone = 'America/Chicago'
  current.schedule.now = '2026-11-04T05:59:59.000Z'
  assert.equal(buildTodayViewModel(current.logic, current.schedule).recommendation.primary.title, 'Day completed')
  current.schedule.now = '2026-11-04T06:00:00.000Z'
  assert.equal(buildTodayViewModel(current.logic, current.schedule).recommendation.primary.title, 'A little moment, just for you.')
  current.schedule.date = '2026-11-04'
  current.schedule.dailyGuide.date = current.schedule.date
  current.logic.flameState.requirements.date = current.schedule.date
  assert.equal(buildTodayViewModel(current.logic, current.schedule).recommendation.primary.title, 'Day completed')
})

test('client rendering consumes only the server model and passes its refresh boundary without recalculating authoritative decisions', () => {
  const current = fixture(), model = modelFor(current)
  model.nextRefreshAt = `${date}T13:30:00.001Z`
  model.deferredReturnAt = `${date}T13:20:00.000Z`
  current.logic.symptoms.redFlag = true
  current.logic.hydration.target = 0
  const view = harness(current), tree = view.render()
  const primary = nodes(tree, node => node.props['data-testid'] === 'guided-next-step')[0]
  assert.match(text(primary), new RegExp(model.recommendation.primary.title))
  assert.equal(view.scheduleRefreshCalls.at(-1)[2], model.nextRefreshAt)
  assert.ok(nodes(tree, node => node.props['data-activity-id'] === 'water').length)
  assert.doesNotMatch(text(primary), /Review today’s recovery guidance/)
  assert.equal(view.timers.size, 1)
  const deferredTimer = [...view.timers.values()][0]
  assert.equal(deferredTimer.delay, 20 * 60 * 1000 + 50)
  deferredTimer.callback()
  assert.equal(view.refreshCalls.length, 1)
  view.cleanup()
  assert.equal(view.timers.size, 0)
})

test('absent or mismatched server payloads show truthful refresh state instead of rebuilding a day in the browser', () => {
  for (const mismatch of ['missing', 'date', 'owner', 'tier']) {
    const current = fixture()
    current.schedule.unavailableSources = ['calendar']
    if (mismatch !== 'missing') {
      const model = modelFor(current)
      if (mismatch === 'date') model.date = '2026-11-02'
      if (mismatch === 'owner') model.clientId = 'OTHER-MEMBER'
      if (mismatch === 'tier') model.tier = 'phoenix'
    }
    const view = harness(current), tree = view.render()
    assert.equal(nodes(tree, node => node.props['data-testid'] === 'guided-next-step').length, 0)
    assert.match(text(tree), /(?:refresh|loading|could not be confirmed|saved day)/i)
    assert.match(text(tree), /Some schedule details are temporarily unavailable/)
    assert.equal(view.refreshCalls.length, 1, 'A missing server snapshot gets one immediate reload.')
    view.render()
    assert.equal(view.refreshCalls.length, 1, 'An unresolved snapshot must not cause a repeated refresh loop.')
    const refresh = nodes(tree, node => node.type === 'button' && /refresh/i.test(text(node)))[0]
    assert.ok(refresh)
    refresh.props.onClick()
    assert.equal(view.refreshCalls.length, 2)
    assert.equal(view.fetchCalls.length, 0)
    view.cleanup()
  }
})

test('activity writes retain transient busy/error feedback and refresh after save without replacing server decisions locally', async () => {
  const current = fixture(), original = clone(modelFor(current)), view = harness(current)
  const water = nodes(view.render(), node => node.props['data-activity-id'] === 'water' && node.type === 'li')[0]
  const options = nodes(water, node => typeof node.type === 'function' && node.props.activity?.id === 'water')[0]
  await options.props.onAction('water', 'defer')
  const tree = view.render()
  assert.equal(view.fetchCalls.length, 1)
  assert.deepEqual(clone(view.fetchCalls[0].body), { date, activityId: 'water', action: 'defer' })
  assert.equal(view.refreshCalls.length, 1)
  assert.match(text(tree), /Saved for later today/)
  assert.deepEqual(clone(current.schedule.todayViewModel), original)
  view.setFetchResult({ ok: false, body: { error: 'Synthetic save failed.' } })
  const nextWater = nodes(tree, node => node.props['data-activity-id'] === 'water' && node.type === 'li')[0]
  const nextOptions = nodes(nextWater, node => typeof node.type === 'function' && node.props.activity?.id === 'water')[0]
  await nextOptions.props.onAction('water', 'defer')
  assert.match(text(view.render()), /Synthetic save failed/)
  assert.equal(view.refreshCalls.length, 1)
  view.cleanup()
})

test('server-required streak dialog keeps native open, Escape, focus return and updated counts without client recomputation', () => {
  const current = fixture(); modelFor(current)
  const view = harness(current)
  view.open()
  assert.equal(view.dialog.open, true)
  assert.equal(view.headingFocus, 1)
  const trigger = nodes(view.render(), node => node.props['data-testid'] === 'today-progress')[0]
  assert.match(trigger.props['aria-label'], /required items/)
  let prevented = false
  view.dialogNode.props.onCancel({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(view.dialog.open, false)
  assert.equal(view.focusReturns, 1)
  Object.assign(current.logic, completeFixture().logic)
  modelFor(current)
  view.open()
  assert.equal(view.dialog.open, true)
  assert.equal(view.headingFocus, 2)
  assert.match(text(view.render()), /streak is secured for today/)
  assert.match(renderToStaticMarkup(view.render()), /No outstanding requirements/)
  view.cleanup()
})
