import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const route = readFileSync('app/dashboard/recovery/page.tsx', 'utf8')
const dashboard = readFileSync('components/recovery/RecoveryDashboardClient.tsx', 'utf8')
const checkIn = readFileSync('components/DailyCheckInForm.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

test('recovery dashboard uses objective, two-panel row, and full-width management panel', () => {
  assert.match(dashboard, /data-testid="recovery-objective"/)
  assert.match(dashboard, /className="recovery-dashboard-row"/)
  assert.match(dashboard, /data-testid="recovery-progress-panel"/)
  assert.match(dashboard, /data-testid="recovery-actions-panel"/)
  assert.match(dashboard, /data-testid="recovery-management-panel"/)
  assert.match(css, /\.recovery-dashboard-row\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/)
  assert.match(css, /@media\(max-width:860px\).*\.recovery-dashboard-row.*grid-template-columns:1fr/s)
})

test('recovery dashboard exposes daily, trends, tools, check-in, and management tabs', () => {
  assert.match(dashboard, /type ProgressTab = 'daily' \| 'trends'/)
  assert.match(dashboard, /type ActionTab = 'tools' \| 'checkIn'/)
  assert.match(dashboard, /type ManagementTab = 'assessment' \| 'history' \| 'insights'/)
  assert.match(dashboard, /data-testid="recovery-daily-tab"/)
  assert.match(dashboard, /data-testid="recovery-trends-tab"/)
  assert.match(dashboard, /data-testid="recovery-tools-tab"/)
  assert.match(dashboard, /data-testid="recovery-check-in-tab"/)
  assert.match(dashboard, /data-testid="recovery-assessment-tab"/)
  assert.match(dashboard, /className="tier-tab-list recovery-panel-tabs"/)
  assert.match(dashboard, /className="tier-tab-list recovery-management-tabs"/)
})

test('recovery dashboard reuses existing recovery logic, logger, check-in, and history sources', () => {
  assert.match(route, /getProgramLogicForClient/)
  assert.match(route, /\.from\('recovery_logs'\)/)
  assert.match(route, /\.from\('recovery_activity_logs'\)/)
  assert.match(dashboard, /RecoveryLogger/)
  assert.match(dashboard, /DailyCheckInForm/)
  assert.match(dashboard, /BreathingReset/)
  assert.match(dashboard, /logic\.recoveryStatus/)
  assert.match(dashboard, /logic\.recoveryActions/)
  assert.match(checkIn, /stayOnSave/)
  assert.doesNotMatch(dashboard, /Math\.random|placeholder/i)
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
