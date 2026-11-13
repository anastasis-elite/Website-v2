import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const context = await importTs('lib/symptoms/periodContext.ts')
const { hasRecentRecordedPeriodStart, periodContextWindowStart } = context
const require = createRequire(import.meta.url)

const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(child => nodes(child, predicate))
  : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]

test('recorded onset context includes calendar-day 0 and 7 but excludes day 8 and future dates', () => {
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', '2026-11-10'), true)
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', '2026-11-03'), true)
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', '2026-11-02'), false)
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', '2026-11-11'), false)
  assert.equal(periodContextWindowStart('2026-11-10'), '2026-11-03')
})

test('calendar dates stay stable across DST, month/year and leap-day boundaries', () => {
  assert.equal(hasRecentRecordedPeriodStart('2026-11-03', '2026-10-27'), true)
  assert.equal(hasRecentRecordedPeriodStart('2026-03-10', '2026-03-03'), true)
  assert.equal(hasRecentRecordedPeriodStart('2027-01-02', '2026-12-26'), true)
  assert.equal(hasRecentRecordedPeriodStart('2024-03-07', '2024-02-29'), true)
  assert.equal(hasRecentRecordedPeriodStart('2024-03-08', '2024-02-29'), false)
})

test('invalid dates and unconfirmed cycle logs never supply onset context', () => {
  for (const value of ['2026-02-30', '2026-13-01', '2026-11-00', '2026-11-3', '2026-11-03T00:00:00Z', '', null, undefined]) {
    assert.equal(hasRecentRecordedPeriodStart('2026-11-10', value), false, String(value))
  }
  assert.equal(hasRecentRecordedPeriodStart('2026-02-30', '2026-02-28'), false)
  assert.equal(periodContextWindowStart('2026-02-30'), null)
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', null, [{ log_date: '2026-11-10', period_started: false }]), false)
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', null, [{ log_date: '2026-11-10' }]), false)
})

test('a recent actual period-start log supplies context despite an older saved client date', () => {
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', '2026-10-03', [
    { log_date: '2026-11-03', period_started: true },
  ]), true)
  assert.equal(hasRecentRecordedPeriodStart('2026-11-10', '2026-11-03', []), true, 'Saved actual onset remains a fallback if logs cannot load.')
})

async function pageHarness({ reproductiveStatus = 'cycling', lastStart = '2026-10-03', periodLogs = [{ log_date: '2026-11-03', period_started: true }], periodError = null } = {}) {
  const queries = []
  const supabase = { from(table) {
    const query = { table, calls: [] }; queries.push(query)
    const builder = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order', 'limit'].map(method => [method, (...args) => { query.calls.push([method, ...args]); return builder }]))
    builder.maybeSingle = async () => ({ data: null })
    builder.then = (resolve, reject) => Promise.resolve({ data: table === 'cycle_logs' ? periodLogs : null, error: periodError }).then(resolve, reject)
    return builder
  } }
  const module = { exports: {} }
  const mocks = {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ supabase, client: { client_id: 'synthetic-member', auth_user_id: 'synthetic-owner', program: 'ignite', reproductive_status: reproductiveStatus, last_period_start: lastStart } }) },
    '@/components/DailyCheckInForm': { __esModule: true, default: 'daily-check-in' },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'phone-frame' },
    '@/lib/timezone': { getClientLocalDate: () => '2026-11-10', getClientTimeZone: () => 'America/Chicago' },
    '@/lib/cycle/getCycleStatus': { getCycleStatus: () => ({ enabled: false }) },
    '@/lib/symptoms/periodContext': context,
    'next/link': { __esModule: true, default: 'a' },
    './check-in-safe-area.css': {},
  }
  const compiled = ts.transpileModule(readFileSync('app/dashboard/check-in/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, require: name => mocks[name] || require(name) })
  const tree = await module.exports.default()
  return { queries, form: nodes(tree, node => node.type === 'daily-check-in')[0] }
}

test('check-in page reads bounded actual onset history and passes context separately from draft answers', async () => {
  const { queries, form } = await pageHarness()
  assert.equal(form.props.recentPeriodStart, true)
  assert.equal(form.props.cycleTrackingEnabled, true)
  assert.equal(form.props.localDate, '2026-11-10')
  assert.equal(form.props.initial.periodStarted, undefined)
  const history = queries.find(query => query.table === 'cycle_logs')
  assert.ok(history)
  for (const expected of [
    ['select', 'log_date, period_started'], ['eq', 'client_id', 'synthetic-member'], ['eq', 'auth_user_id', 'synthetic-owner'],
    ['eq', 'period_started', true], ['gte', 'log_date', '2026-11-03'], ['lte', 'log_date', '2026-11-10'], ['limit', 1],
  ]) assert.ok(history.calls.some(call => JSON.stringify(call) === JSON.stringify(expected)), JSON.stringify(expected))
  assert.ok(history.calls.some(call => call[0] === 'order' && call[1] === 'log_date' && call[2].ascending === false))
})

test('existing cycle eligibility suppresses automatic context and history reads while saved-date fallback survives history errors', async () => {
  for (const reproductiveStatus of ['menopause', 'pregnant', 'not_tracking']) {
    const { queries, form } = await pageHarness({ reproductiveStatus, lastStart: '2026-11-10' })
    assert.equal(form.props.cycleTrackingEnabled, false)
    assert.equal(form.props.recentPeriodStart, false)
    assert.equal(queries.some(query => query.table === 'cycle_logs'), false)
  }
  const { form } = await pageHarness({ lastStart: '2026-11-03', periodLogs: null, periodError: { message: 'Synthetic read failure' } })
  assert.equal(form.props.recentPeriodStart, true)
})
