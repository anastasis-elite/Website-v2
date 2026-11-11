import CardArtworkModule from './cardArtworkFixture.mjs'
import RecoverySuggestionModule from './recoverySuggestionFixture.mjs'
import { importTs } from './typescriptModule.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const timezone = await importTs('lib/timezone.ts')
const route = readFileSync('app/dashboard/recovery/page.tsx', 'utf8')
const dashboard = readFileSync('components/recovery/RecoveryDashboardClient.tsx', 'utf8')
const refreshCalls = []
const refreshHook = { useDailyScheduleRefresh(...args) { refreshCalls.push(args) } }
const nativeRequire = createRequire(import.meta.url)
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate)) : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''

function compile(source, mocks) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, require: name => mocks[name] || nativeRequire(name) })
  return module.exports
}

function clientModule() {
  return compile(dashboard, {
    '@/components/RecoveryLogger': { __esModule: true, default: 'recovery-logger' },
    '@/components/recovery/RecoveryActivitySheets': { __esModule: true, default: 'recovery-activities' },
    '@/components/recovery/RecoverySuggestionCard': RecoverySuggestionModule,
    '@/lib/schedule/client': refreshHook,
    '@/components/CardArtwork': CardArtworkModule,
    '@/components/ActionArrow': {}, './RecoveryCards.module.css': {},
    'next/link': { __esModule: true, default: 'a' },
  })
}

test('Recovery page keeps its activity cards and own-practice logging with the current member', () => {
  const module = clientModule()
  const tree = module.default({ clientId: 'synthetic-current-member' })
  assert.equal(tree.type, 'main')
  assert.equal(tree.props.className, 'aos-nutrition-page recovery-dashboard-page')
  const ownPractice = nodes(tree, node => node.type === module.OwnPractice)
  assert.equal(ownPractice.length, 1)
  assert.equal(ownPractice[0].props.clientId, 'synthetic-current-member')
  assert.equal(nodes(tree, node => node.type === module.GuidedRecoveryCards).length, 1)
  const activitySheets = nodes(tree, node => node.type === 'recovery-activities')
  assert.equal(activitySheets.length, 1)
  assert.equal(activitySheets[0].props.clientId, 'synthetic-current-member')
  assert.equal(text(tree).trim(), 'Let us guide you.  Simple ways to unwind.')
})

test('Recovery Status and every lower panel are absent without removing shared navigation or footer', () => {
  const tree = clientModule().default({ clientId: 'synthetic-current-member' })
  assert.equal(nodes(tree, node => node.props?.['data-testid']?.startsWith('recovery-')).length, 0)
  assert.doesNotMatch(text(tree), /Recovery Status|Daily Recovery|Trends|Check-In|History|Insights|Recovery Tools|Recovery Assessment/)
  assert.doesNotMatch(dashboard, /DailyCheckInForm|BreathingReset|formatRecoveryDetails|getRecoveryScoreExplanation|getDailyTraining|useViewPreference|RecoveryTrend|CheckInInitial|recentActivities/)
  assert.match(readFileSync('app/dashboard/layout.tsx', 'utf8'), /<ClientDashboardNav program=\{program\}\/>/)
  assert.match(readFileSync('app/layout.tsx', 'utf8'), /<LegalFooter \/>/)
})

test('Recovery route authenticates, awaits the existing logic pipeline, and removes only panel-specific reads', async () => {
  const client = { client_id: 'synthetic-current-member', program: 'ignite' }, user = { id: 'synthetic-owner' }
  const order = []
  const supabase = { from() { assert.fail('Removed panels must not trigger page-only recovery history/check-in reads.') } }
  const dailyPlan = { date: timezone.getClientLocalDate(client) }, schedule = { date: dailyPlan.date, timezone: timezone.getClientTimeZone(client), events: [] }
  let releaseLogic, receivedContext, receivedScheduleContext, markLogicStarted
  const logicStarted = new Promise(resolve => { markLogicStarted = resolve })
  const pendingLogic = new Promise(resolve => { releaseLogic = resolve })
  const module = compile(route, {
    '@/lib/dashboard/getDashboardContext': { async getDashboardContext() { order.push('authenticated');return { client, user, supabase } } },
    '@/lib/timezone': timezone,
    '@/lib/day/getDailyExecutionPlan': { async getDailyExecutionPlan(context) { assert.equal(context.client, client);assert.equal(context.supabase, supabase);order.push('plan');return dailyPlan } },
    '@/lib/schedule/service': { async getDailyScheduleState(context) { receivedScheduleContext = context;order.push('schedule');return schedule } },
    '@/lib/dashboard/logic/getProgramLogicForClient': { getProgramLogicForClient(context) { receivedContext = context;order.push('logic');markLogicStarted();return pendingLogic } },
    '@/components/recovery/RecoveryDashboardClient': { __esModule: true, default: 'recovery-dashboard' },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'recovery-frame' },
  })
  let resolved = false
  const pendingPage = module.default().then(tree => { resolved = true;return tree })
  await logicStarted
  assert.deepEqual(order, ['authenticated', 'plan', 'logic'])
  assert.equal(receivedContext.client, client);assert.equal(receivedContext.user, user);assert.equal(receivedContext.supabase, supabase);assert.equal(receivedContext.dailyPlan, dailyPlan)
  assert.equal(resolved, false, 'The existing persistence-capable pipeline is awaited before rendering.')
  releaseLogic({ program: 'ignite' })
  const tree = await pendingPage
  assert.deepEqual(order, ['authenticated', 'plan', 'logic', 'schedule'])
  assert.equal(receivedScheduleContext.dailyPlan, dailyPlan);assert.equal(receivedScheduleContext.logic.program, 'ignite')
  assert.equal(receivedScheduleContext.sourceTimeoutMs, 2000, 'Optional calendar/schedule sources share Today’s bounded read behavior.')
  assert.equal(tree.type, 'recovery-frame')
  assert.equal(tree.props.eyebrow, 'Recovery')
  assert.equal(tree.props.title, 'A little room to restore.')
  assert.equal(tree.props.subtitle, 'Choose what feels right today.')
  assert.equal(tree.props.children.type, 'recovery-dashboard')
  assert.deepEqual(Object.keys(tree.props.children.props), ['clientId', 'suggestion', 'schedule'])
  assert.equal(tree.props.children.props.suggestion, undefined)
  assert.equal(tree.props.children.props.schedule.date, schedule.date)
  assert.equal(tree.props.children.props.clientId, client.client_id)
  assert.doesNotMatch(route, /\.from\(|getClientLocalDateOffset|isSorenessRegionKey|buildTrend|checkInInitial|recentActivities/)
})

test('compact own-practice button opens the existing logger and closing restores trigger focus', () => {
  const nativeRequire = createRequire(import.meta.url)
  const module = { exports: {} }
  const mocks = {
    react: { useId: () => 'practice-dialog', useRef: () => ({ current: null }) },
    '@/components/RecoveryLogger': { __esModule: true, default: 'recovery-logger' },
    '@/components/recovery/RecoveryActivitySheets': {}, '@/lib/recovery/activityDisplay': {},
    '@/components/recovery/RecoverySuggestionCard': RecoverySuggestionModule,
    '@/lib/schedule/client': refreshHook,
    '@/components/DailyCheckInForm': {}, '@/components/recovery/BreathingReset': {},
    '@/lib/dashboard/dailyTraining': {}, '@/lib/recovery/scoreExplanation': {},
    '@/components/dashboard/useViewPreference': {}, '@/components/phone-app/PhoneAppFrame': {},
    '@/components/CardArtwork': CardArtworkModule,
    '@/components/ActionArrow': {}, './RecoveryCards.module.css': {},
    'next/link': { __esModule: true, default: 'a' },
  }
  const compiled = ts.transpileModule(dashboard, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, require: name => mocks[name] || nativeRequire(name) })
  const tree = module.exports.OwnPractice({ clientId: 'disposable-client' })
  const children = tree.props.children
  const trigger = children.find(node => node.type === 'button')
  const dialog = children.find(node => node.type === 'dialog')
  const logger = dialog.props.children.find(node => node.type === 'recovery-logger')
  let open = false, focused = false
  trigger.ref.current = { focus() { focused = true } }
  dialog.ref.current = { showModal() { open = true }, close() { open = false; dialog.props.onClose() } }
  assert.equal(trigger.props.children, 'Log your practice')
  assert.equal(trigger.props['aria-haspopup'], 'dialog')
  assert.equal(trigger.props['aria-controls'], dialog.props.id)
  assert.equal(logger.props.clientId, 'disposable-client')
  assert.equal(open, false)
  trigger.props.onClick()
  assert.equal(open, true)
  dialog.props.children[0].props.children.find(node => node.type === 'button').props.onClick()
  assert.equal(open, false)
  assert.equal(focused, true)
})


test('Recovery uses the shared schedule model candidate, never its ungated logic reward, and keeps all activities', async () => {
  const client = { client_id: 'synthetic-current-member', program: 'ignite', timezone: 'Pacific/Honolulu' }, user = { id: 'synthetic-owner' }
  const suggestion = { version: 1, clientId: client.client_id, date: timezone.getClientLocalDate(client), timezone: client.timezone, kind: 'reward', id: 'after-workout', title: 'Unwind your way.', description: 'Take a comfortable pause.' }
  const dailyPlan = { date: suggestion.date }, nextRefreshAt = '2026-11-12T04:00:00Z'
  let candidate = suggestion, logicCandidate = { ...suggestion, id: 'ungated-logic' }, failSchedule = false, planReads = 0, deferredReturnAt, modelChange = {}
  const now = new Date().toISOString()
  const schedule = () => ({ date: suggestion.date, timezone: client.timezone, now, events: [], todayViewModel: {
    version: 1, clientId: client.client_id, tier: client.program, date: suggestion.date, timezone: client.timezone, generatedAt: now,
    recoveryRewardSuggestion: candidate, nextRefreshAt, deferredReturnAt, ...modelChange } })
  const module = compile(route, {
    '@/lib/dashboard/getDashboardContext': { async getDashboardContext() { return { client, user, supabase: {} } } },
    '@/lib/dashboard/logic/getProgramLogicForClient': { async getProgramLogicForClient(context) { assert.equal(context.dailyPlan, dailyPlan);return { program: client.program, recoveryRewardSuggestion: logicCandidate } } },
    '@/lib/day/getDailyExecutionPlan': { async getDailyExecutionPlan() { planReads++;return dailyPlan } },
    '@/lib/schedule/service': { async getDailyScheduleState(context) { assert.equal(context.dailyPlan, dailyPlan);if (failSchedule) throw new Error('optional schedule unavailable');return schedule() } },
    '@/lib/timezone': timezone,
    '@/components/recovery/RecoveryDashboardClient': { __esModule: true, default: 'recovery-dashboard' },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'recovery-frame' },
  })
  const first = (await module.default()).props.children.props
  assert.equal(first.suggestion, suggestion)
  assert.equal(first.schedule.nextRefreshAt, new Date(nextRefreshAt).toISOString())
  assert.equal(planReads, 1, 'The saved daily plan is read once and passed through both pipelines.')
  const clientTree = clientModule().default(first)
  const children = clientTree.props.children.props.children
  assert.equal(children[0].type, RecoverySuggestionModule.default)
  assert.equal(children[0].props.suggestion, suggestion)
  assert.equal(children[1].type.name, 'OwnPractice')
  for (const change of [{ clientId: 'OTHER' }, { date: '2020-01-01' }, { timezone: 'UTC' }]) {
    candidate = { ...suggestion, ...change }
    assert.equal((await module.default()).props.children.props.suggestion, undefined)
  }
  candidate = suggestion
  for (const change of [{ clientId: 'OTHER' }, { tier: 'ember' }, { date: '2020-01-01' }, { generatedAt: '2020-01-01T00:00:00Z' }]) {
    modelChange = change
    assert.equal((await module.default()).props.children.props.suggestion, undefined, 'A stale or mismatched model stays hidden, just as on Today.')
  }
  modelChange = {}
  for (const state of ['completed', 'skipped', 'deferred', 'not-due', 'tier-without-guidance']) {
    candidate = undefined
    const output = (await module.default()).props.children.props
    assert.equal(output.suggestion, undefined, state + ' keeps the model decision authoritative')
    assert.ok(output.schedule, 'A hidden suggestion still refreshes for the next due boundary.')
  }
  deferredReturnAt = '2026-11-12T03:00:00Z'
  assert.equal((await module.default()).props.children.props.schedule.nextRefreshAt, '2026-11-12T03:00:00.000Z')
  candidate = { ...suggestion, kind: 'safety', id: 'safety-first' }
  assert.equal((await module.default()).props.children.props.suggestion.kind, 'safety')
  failSchedule = true
  const failure = (await module.default()).props.children.props
  assert.equal(failure.suggestion, undefined)
  assert.equal(failure.schedule, undefined)
  const failureTree = clientModule().default(failure)
  assert.equal(nodes(failureTree, node => node.type === 'recovery-activities').length, 1)
  assert.equal(nodes(failureTree, node => node.type.name === 'OwnPractice').length, 1)
  logicCandidate = { ...suggestion, kind: 'safety', id: 'safety-first' }
  assert.equal((await module.default()).props.children.props.suggestion, logicCandidate, 'Validated safety guidance survives an optional schedule failure.')
  logicCandidate = { ...logicCandidate, clientId: 'OTHER' }
  assert.equal((await module.default()).props.children.props.suggestion, undefined, 'The safety fallback still requires the current owner/day/timezone.')
})

test('Recovery refresh follows the same exact model boundary even while no reward is visible', () => {
  const date = '2026-11-11', schedule = { date, timezone: 'America/Chicago', events: [], nextRefreshAt: date + 'T20:30:00Z' }
  refreshCalls.length = 0
  clientModule().default({ clientId: 'synthetic-current-member', schedule })
  assert.equal(refreshCalls.length, 1)
  assert.equal(refreshCalls[0][0], schedule)
  assert.equal(refreshCalls[0][1], true)
  assert.equal(refreshCalls[0][2], schedule.nextRefreshAt)
  clientModule().default({ clientId: 'synthetic-current-member' })
  assert.equal(refreshCalls[1][1], false)
})


test('Ember Recovery offers a generic reward shell while safety and other tier shells keep their existing care copy', async () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const client = { client_id: 'CURRENT', auth_user_id: 'OWNER', program: tier, timezone: 'UTC' }, user = { id: 'OWNER' }
    const date = timezone.getClientLocalDate(client), now = new Date().toISOString(), plan = { date }
    let safety = false, scheduleUnavailable = false
    const care = { version: 1, clientId: client.client_id, date, timezone: client.timezone, kind: 'safety', id: 'safety-first', title: 'Your safety comes first.', description: 'Follow your existing care guidance.' }
    const module = compile(route, {
      '@/lib/dashboard/getDashboardContext': { async getDashboardContext() { return { client, user, supabase: {} } } },
      '@/lib/day/getDailyExecutionPlan': { async getDailyExecutionPlan() { return plan } },
      '@/lib/dashboard/logic/getProgramLogicForClient': { async getProgramLogicForClient() { return { program: tier, ...(safety ? { recoveryRewardSuggestion: care } : {}) } } },
      '@/lib/schedule/service': { async getDailyScheduleState() {
        if (scheduleUnavailable) throw new Error('Optional schedule unavailable')
        return { date, timezone: client.timezone, now, events: [], todayViewModel: { version: 1, clientId: client.client_id, date, timezone: client.timezone,
          generatedAt: now, tier, ...(safety ? { recoveryRewardSuggestion: care } : {}) } }
      } },
      '@/lib/timezone': timezone,
      '@/components/recovery/RecoveryDashboardClient': { __esModule: true, default: 'recovery-dashboard' },
      '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'recovery-frame' },
    })
    const tree = await module.default(), normal = tree.props.children.props
    assert.equal(tree.props.title, tier === 'ember' ? 'A little reward, just for you.' : 'A little room to restore.')
    assert.equal(tree.props.subtitle, tier === 'ember' ? 'Choose your own way to unwind.' : 'Choose what feels right today.')
    assert.doesNotMatch(tree.props.title + tree.props.subtitle, /at your own pace|you logged|high stress|hard workout/i)
    assert.equal(normal.clientId, client.client_id)
    assert.equal(normal.suggestion, undefined, 'Static Ember copy does not create a personalized recommendation.')
    const normalActivities = clientModule().default(normal)
    assert.equal(nodes(normalActivities, node => node.type === 'recovery-activities').length, 1)
    assert.equal(nodes(normalActivities, node => node.type.name === 'OwnPractice').length, 1)
    for (const unavailable of [false, true]) {
      safety = true;scheduleUnavailable = unavailable
      const safetyTree = await module.default()
      assert.equal(safetyTree.props.title, 'A little room to restore.')
      assert.equal(safetyTree.props.subtitle, 'Choose what feels right today.')
      assert.equal(safetyTree.props.children.props.suggestion, care, 'Validated care guidance remains ahead of a generic reward invitation.')
      assert.equal(safetyTree.props.children.props.clientId, normal.clientId)
    }
  }
})
