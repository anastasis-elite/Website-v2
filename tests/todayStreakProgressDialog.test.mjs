import CardArtworkModule from './cardArtworkFixture.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const activities = await importTs('lib/dashboard/todayActivities.ts')
const { buildTodayViewModel } = await importTs('lib/dashboard/buildTodayViewModel.ts')
const recommendations = await importTs('lib/dashboard/dailyRecommendation.ts')
const time = await importTs('lib/schedule/time.ts')
const recovery = await importTs('lib/recovery/todayCompletion.ts')
const streak = await importTs('lib/dashboard/logic/streakRequirementProgress.ts')
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate)) : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''
const date = '2026-11-02'
const flags = { dailyCheckIn: true, nutrition: true, hydration: true, workoutOrMovement: true, recovery: false, sleep: false, customTasks: true }
function flame(patch = {}) {
  const completedItems = { ...flags, customTasks: false, recovery: true, sleep: true, ...patch }
  const streakEligible = Object.keys(flags).every(key => !flags[key] || completedItems[key])
  return { streakEligible, requirements: { date, programTier: 'ignite', requiredItems: { ...flags }, completedItems,
    streakEligible, completionScore: 100, resetMessage: null } }
}
const fixture = () => ({ program: 'ignite', client: { id: 'QA-STREAK' }, flameState: flame(),
  hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready' },
  nutrition: { dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 100 }, pacing: { state: 'complete' } },
  assessments: { dailyCompleted: true }, execution: { workoutComplete: true, nutritionLogged: true, recoveryComplete: true },
  workout: { assigned: true, title: 'Saved workout' }, workoutDecision: { canTrain: true, reasonForModification: 'Existing guidance.' },
  capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing recovery guidance.' } })
const schedule = () => ({ date, timezone: 'UTC', now: `${date}T13:00:00Z`, events: [], nextActionableEvent: null,
  dailyGuide: { date, activities: { schedule: { status: 'reviewed' } } } })

function harness(current = fixture(), state = schedule()) {
  const states = [], refs = [];let stateIndex = 0, refIndex = 0, focusReturns = 0, headingFocus = 0, refreshes = 0
  const mocks = {
    react: { useId: () => 'streak-dialog', useEffect() {}, useRef(initial) { return refs[refIndex++] ||= { current: initial } },
      useState(initial) { const index = stateIndex++;if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] } },
    '@/components/CardArtwork': CardArtworkModule,
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ refresh() { refreshes++ } }) },
    '@/lib/dashboard/todayActivities': activities, '@/lib/dashboard/dailyRecommendation': recommendations,
    '@/lib/schedule/client': { useDailyScheduleRefresh() {} }, '@/lib/schedule/time': time,
    '@/lib/recovery/todayCompletion': recovery, '@/lib/dashboard/logic/streakRequirementProgress': streak,
    '@/lib/analytics': { trackEvent() {} }, '@/lib/analytics/todayJourney': { recordTodayActionOpened() {}, recordTodayActionCompletions() {} },
  }
  function load(path) {
    const module = { exports: {} }
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date, require: name => mocks[name] || require(name) })
    return module.exports.default
  }
  const Card = load('components/program-dashboard/StreakRequirementsCard.tsx')
  mocks['@/components/program-dashboard/StreakRequirementsCard'] = { __esModule: true, default: Card }
  const Today = load('components/program-dashboard/GuidedToday.tsx')
  let dialogNode
  const nativeDialog = { open: false, showModal() { this.open = true }, close() { this.open = false;dialogNode.props.onClose() } }
  function render() {
    stateIndex = refIndex = 0
    const tree = Today({ logic: current, schedule: { ...state, todayViewModel: buildTodayViewModel(current, state) } })
    dialogNode = nodes(tree, node => node.type === 'dialog')[0]
    dialogNode.ref.current = nativeDialog
    nodes(dialogNode, node => node.type === 'h2')[0].ref.current = { focus() { headingFocus++ } }
    return tree
  }
  return { current, state, render, nativeDialog, Card,
    open() { const button = nodes(render(), node => node.props['data-testid'] === 'today-progress')[0];button.props.onClick({ currentTarget: { focus() { focusReturns++ } } });return render() },
    get dialog() { render();return dialogNode }, get focusReturns() { return focusReturns }, get headingFocus() { return headingFocus }, get refreshes() { return refreshes } }
}

test('Today progress and dialog share required-only evidence while canonical activity completion stays separate', () => {
  const view = harness(), before = structuredClone(view.current), tree = view.render()
  const trigger = nodes(tree, node => node.props['data-testid'] === 'today-progress')[0]
  assert.equal(trigger.type, 'button');assert.equal(trigger.props.type, 'button')
  assert.equal(trigger.props['aria-haspopup'], 'dialog');assert.equal(trigger.props['aria-controls'], 'streak-dialog')
  assert.equal(nodes(trigger, node => ['button', 'a', 'input', 'select', 'summary'].includes(node.type)).length, 1)
  assert.match(trigger.props['aria-label'], /4 of 5 required items/)
  assert.match(text(trigger), /1 required item remains/)
  assert.doesNotMatch(text(trigger), /streak is secured/)
  const bar = nodes(trigger, node => node.props.role === 'progressbar')[0]
  const card = nodes(tree, node => node.type === view.Card)[0]
  assert.equal(bar.props['aria-valuenow'], card.props.progress.completedCount)
  assert.equal(bar.props['aria-valuemax'], card.props.progress.requiredCount)
  const canonical = activities.buildTodayActivities(view.current, view.state)
  assert.deepEqual([canonical.completed, canonical.total], [4, 4])
  const html = renderToStaticMarkup(tree)
  assert.match(html, /<h3>Your next steps<\/h3>/)
  assert.equal((html.match(/<small>Not yet completed<\/small>/g) || []).length, 1)
  assert.equal((html.match(/<small>Completed<\/small>/g) || []).length, 4)
  assert.match(html, /aria-label="Day-block tasks: Not yet completed requirement\./)
  assert.match(html, /href="\/dashboard\/day\/midday\?date=2026-11-02"/)
  assert.doesNotMatch(html, /data-requirement="sleep"|data-requirement="recovery"/)
  assert.deepEqual(view.current, before)
})

test('the native progress dialog opens, closes by button and Escape, restores focus and reopens', () => {
  const view = harness()
  view.open();assert.equal(view.nativeDialog.open, true);assert.equal(view.headingFocus, 1)
  assert.equal(view.dialog.props['aria-labelledby'], 'streak-dialog-title')
  assert.equal(view.dialog.props['aria-describedby'], 'streak-dialog-description')
  nodes(view.dialog, node => node.type === 'button' && text(node) === 'Close')[0].props.onClick()
  assert.equal(view.nativeDialog.open, false);assert.equal(view.focusReturns, 1)
  view.open();let prevented = false
  view.dialog.props.onCancel({ preventDefault() { prevented = true } })
  assert.equal(prevented, true);assert.equal(view.nativeDialog.open, false);assert.equal(view.focusReturns, 2)
  view.open();assert.equal(view.nativeDialog.open, true);assert.equal(view.headingFocus, 3)
})

test('missing, stale or inconsistent requirements show neutral retry without a fabricated secured count', () => {
  for (const invalid of [null, { ...flame(), streakEligible: true }, { ...flame(), requirements: { ...flame().requirements, date: '2026-11-01' } }]) {
    const current = fixture();current.flameState = invalid
    const view = harness(current), tree = view.open(), trigger = nodes(tree, node => node.props['data-testid'] === 'today-progress')[0]
    assert.match(text(trigger), /Status unavailable/)
    assert.doesNotMatch(text(trigger), /\d of \d|streak is secured/)
    assert.equal(nodes(trigger, node => node.props.role === 'progressbar')[0].props['aria-valuenow'], undefined)
    const refresh = nodes(view.dialog, node => node.type === 'button' && text(node) === 'Refresh requirements')[0]
    refresh.props.onClick();assert.equal(view.refreshes, 1)
  }
})

test('updated authoritative required flags secure the open dialog without changing pacing or activity history', () => {
  const view = harness();view.open();const originalHydration = structuredClone(view.current.hydration)
  view.current.flameState = flame({ customTasks: true })
  const tree = view.render(), trigger = nodes(tree, node => node.props['data-testid'] === 'today-progress')[0]
  assert.equal(view.nativeDialog.open, true)
  assert.match(trigger.props['aria-label'], /5 of 5/)
  assert.match(text(trigger), /Your streak is secured for today/)
  assert.match(renderToStaticMarkup(tree), /No outstanding requirements/)
  assert.deepEqual(view.current.hydration, originalHydration)
})
