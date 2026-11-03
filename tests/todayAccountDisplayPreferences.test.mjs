import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
function load(path, mocks = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(source, { module, exports: module.exports, fetch: (...args) => globalThis.fetch(...args), require(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === 'next/link') return Link
    if (name === 'server-only') return {}
    return require(name)
  } }, { filename: path })
  return module.exports
}
function descendants(node) {
  if (!node || typeof node !== 'object') return []
  const children = node.props?.children
  return [node, ...(Array.isArray(children) ? children : [children]).flatMap(descendants)]
}
const router = { refreshes: 0, refresh() { this.refreshes++ } }
const Preferences = load('components/DailyDisplayPreferences.tsx', { 'next/navigation': { useRouter: () => router } }).default

test('Today mounts only guided content while dedicated progress, assessment, history and schedule modules remain', () => {
  const Guided = () => React.createElement('div', { 'data-testid': 'preserved-guided-today' }, 'Today progress and actions')
  const workspace = load('components/program-dashboard/TierAwareDashboardWorkspace.tsx', {
    './GuidedToday': Guided,
    '@/lib/nutrition/loggingRoutes': { mealEntryHref: () => '/dashboard/nutrition', WATER_ENTRY_HREF: '/dashboard/nutrition?log=water' },
    '@/lib/dashboard/dailyRecommendation': {}, '@/lib/dashboard/dailyTraining': {}, '@/lib/schedule/time': {},
    '@/lib/schedule/engine': {}, '@/lib/entitlements': {}, '@/lib/dashboard/ignite/getIgniteDashboardData': {},
    '@/lib/dashboard/phoenix/getPhoenixDashboardData': {}, '@/lib/assessment/getStrengthAssessmentStatus': {},
  })
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const html = renderToStaticMarkup(React.createElement(workspace.default, { tier, logic: { client: { id: 'QA-OWNER' } },
      schedule: { date: '2026-11-02', preferences: { carouselStyle: 'step' } } }))
    assert.match(html, /data-testid="preserved-guided-today"/)
    assert.match(html, /data-quiet="true"/)
    assert.doesNotMatch(html, /<details|Your schedule at a glance|How would you like to see your day|Progress, assessments, and details/)
  }
  const panels = load('components/program-dashboard/DashboardDetailPanels.tsx', {
    '@/lib/nutrition/loggingRoutes': {}, '@/lib/dashboard/dailyTraining': {}, '@/lib/schedule/time': {},
    '@/lib/schedule/engine': {}, '@/lib/entitlements': {}, '@/lib/dashboard/ignite/getIgniteDashboardData': {},
    '@/lib/dashboard/phoenix/getPhoenixDashboardData': {}, '@/lib/assessment/getStrengthAssessmentStatus': {},
  })
  for (const name of ['ProgressTab', 'AssessmentsTab', 'TrendsTab', 'SchedulePreview', 'buildPlanBlocks']) assert.equal(typeof panels[name], 'function')
  for (const path of ['app/dashboard/schedule/page.tsx', 'app/dashboard/progress/page.tsx', 'app/dashboard/assessment/page.tsx',
    'components/program-dashboard/DashboardCalendar.tsx', 'components/LegalFooter.tsx']) assert.equal(existsSync(path), true, path)
})

test('Account page forwards only saved display preferences with zero buffer preserved from the authenticated client', async () => {
  const client = { client_id: 'QA-ACCOUNT', execution_style: 'hybrid', carousel_style: 'step',
    onboarding_data: { transitionMinutes: 0, unrelated: 'preserved elsewhere' } }
  const contexts = []
  const Account = () => null
  const Page = load('app/dashboard/account/page.tsx', {
    '@/lib/dashboard/getDashboardContext': { async getDashboardContext(options) { contexts.push(options);return { client, user: { email: 'synthetic@example.invalid' }, supabase: {} } } },
    '@/lib/dashboard/account/getAccountData': { async getAccountData() { return { profile: { clientId: client.client_id } } } },
    '@/components/account/AccountDashboard': { __esModule: true, default: Account },
  }).default
  const element = await Page()
  assert.equal(element.type, Account)
  assert.deepEqual(JSON.parse(JSON.stringify(element.props.displayPreferences)), { executionStyle: 'hybrid', carouselStyle: 'step', transitionMinutes: 0 })
  assert.deepEqual(JSON.parse(JSON.stringify(contexts)), [{ allowInactiveAccess: true, allowIncompleteOnboarding: true }])
  assert.equal(element.props.displayPreferences.unrelated, undefined)
  assert.equal(element.props.displayPreferences.clientId, undefined)
})

test('Account settings mounts the existing preference form with stored values and an owner-keyed form instance', () => {
  const initialData = { profile: { clientId: 'QA-ACCOUNT', name: 'QA Member', email: 'synthetic@example.invalid',
    program: 'ignite', avatarUrl: null, subscriptionStatus: null }, billing: { connected: false, billingType: null } }
  const Account = load('components/account/AccountDashboard.tsx', {
    '@/components/DailyDisplayPreferences': { __esModule: true, default: Preferences },
    '@/components/AccountProfileForm': { __esModule: true, default: () => null },
    './LogoutButton': { __esModule: true, default: () => React.createElement('button', null, 'Log out') },
    './BillingControls': { __esModule: true, default: () => null },
    './hooks': { useAccountData: value => value, useClientProfile: value => value.profile },
    '@/components/navigation/DashboardMoreMenu': { __esModule: true, default: () => null },
    '@/lib/entitlements': { normalizeProgramTier: value => value },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: ({ children }) => React.createElement('div', null, children) },
  }).default
  const props = { initialData, client: {}, user: { email: null }, displayPreferences: { executionStyle: 'schedule', carouselStyle: 'step', transitionMinutes: 0 } }
  const tree = Account(props), form = descendants(tree).find(node => node.type === Preferences)
  assert.ok(form)
  assert.equal(form.key, 'QA-ACCOUNT')
  const html = renderToStaticMarkup(React.createElement(Account, props))
  assert.match(html, /href="#daily-display-preferences"/)
  assert.match(html, /id="daily-display-preferences" aria-labelledby="daily-display-preferences-title"/)
  assert.match(html, /<option value="schedule" selected=""/)
  assert.match(html, /<option value="step" selected=""/)
  assert.match(html, /type="number" min="0" max="120" value="0"/)
  assert.match(html, /Save display preferences/)
  for (const href of ['/dashboard/progress', '/dashboard/assessment', '/dashboard/assessment/daily-structure', '/dashboard/settings/calendars']) assert.ok(html.includes(`href="${href}"`))
})

test('the relocated unchanged form uses the same PATCH payload, single-flight save and truthful retry feedback', async t => {
  const originalFetch = globalThis.fetch;t.after(() => { globalThis.fetch = originalFetch })
  const states = [];let cursor = 0
  const hooks = { ...React,
    useState(initial) { const index = cursor++;if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
    useRef(initial) { const index = cursor++;if (!(index in states)) states[index] = { current: initial };return states[index] },
  }
  const currentRouter = { refreshes: 0, refresh() { this.refreshes++ } }
  const Form = load('components/DailyDisplayPreferences.tsx', { react: hooks, 'next/navigation': { useRouter: () => currentRouter } }).default
  const render = () => { cursor = 0;return Form({ executionStyle: 'hybrid', carouselStyle: 'step', transitionMinutes: 0 }) }
  const requests = [];let resolve
  globalThis.fetch = (url, options) => { requests.push({ url, options });return new Promise(done => { resolve = done }) }
  let tree = render(), form = descendants(tree).find(node => node.type === 'form')
  const pending = form.props.onSubmit({ preventDefault() {} })
  await form.props.onSubmit({ preventDefault() {} })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api/dashboard/preferences')
  assert.equal(requests[0].options.method, 'PATCH')
  assert.deepEqual(JSON.parse(requests[0].options.body), { executionStyle: 'hybrid', carouselStyle: 'step', transitionMinutes: 0 })
  resolve(Response.json({ success: true }));await pending
  assert.equal(currentRouter.refreshes, 1)
  assert.match(renderToStaticMarkup(render()), /Saved\. Today’s view now follows your preferences/)
  globalThis.fetch = async () => Response.json({ error: 'Please retry saving.' }, { status: 500 })
  tree = render();form = descendants(tree).find(node => node.type === 'form')
  await form.props.onSubmit({ preventDefault() {} })
  assert.equal(currentRouter.refreshes, 1)
  assert.match(renderToStaticMarkup(render()), /Please retry saving/)
})
