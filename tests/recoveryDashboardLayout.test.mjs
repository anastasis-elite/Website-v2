import CardArtworkModule from './cardArtworkFixture.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const route = readFileSync('app/dashboard/recovery/page.tsx', 'utf8')
const dashboard = readFileSync('components/recovery/RecoveryDashboardClient.tsx', 'utf8')
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
  let releaseLogic, receivedContext, markLogicStarted
  const logicStarted = new Promise(resolve => { markLogicStarted = resolve })
  const pendingLogic = new Promise(resolve => { releaseLogic = resolve })
  const module = compile(route, {
    '@/lib/dashboard/getDashboardContext': { async getDashboardContext() { order.push('authenticated');return { client, user, supabase } } },
    '@/lib/dashboard/logic/getProgramLogicForClient': { getProgramLogicForClient(context) { receivedContext = context;order.push('logic');markLogicStarted();return pendingLogic } },
    '@/components/recovery/RecoveryDashboardClient': { __esModule: true, default: 'recovery-dashboard' },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'recovery-frame' },
  })
  let resolved = false
  const pendingPage = module.default().then(tree => { resolved = true;return tree })
  await logicStarted
  assert.deepEqual(order, ['authenticated', 'logic'])
  assert.equal(receivedContext.client, client);assert.equal(receivedContext.user, user);assert.equal(receivedContext.supabase, supabase)
  assert.equal(resolved, false, 'The existing persistence-capable pipeline is awaited before rendering.')
  releaseLogic({ program: 'ignite' })
  const tree = await pendingPage
  assert.equal(tree.type, 'recovery-frame')
  assert.equal(tree.props.eyebrow, 'Recovery')
  assert.equal(tree.props.title, 'A little room to restore.')
  assert.equal(tree.props.subtitle, 'Choose what feels right today.')
  assert.equal(tree.props.children.type, 'recovery-dashboard')
  assert.deepEqual(Object.keys(tree.props.children.props), ['clientId'])
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
