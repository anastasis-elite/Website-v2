import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const activities = await importTs('lib/dashboard/todayActivities.ts')
const recommendations = await importTs('lib/dashboard/dailyRecommendation.ts')
const timezone = await importTs('lib/timezone.ts')
const scheduleTime = await importTs('lib/schedule/time.ts')
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
function component(path, extra = {}) {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  runInNewContext(outputText, { module, exports: module.exports, Date, require: name => extra[name] || ({
    'next/link': Link,
    'next/navigation': { useRouter: () => ({ refresh() {} }), usePathname: () => '/dashboard/program/ignite' },
    '@/lib/dashboard/todayActivities': activities,
    '@/lib/dashboard/dailyRecommendation': recommendations,
    '@/lib/schedule/client': { useDailyScheduleRefresh() {} },
    '@/lib/schedule/time': scheduleTime,
    '@/lib/analytics': { trackEvent() {} },
    '@/lib/analytics/todayJourney': { recordTodayActionOpened() {}, recordTodayActionCompletions() {} },
    '@/lib/timezone': timezone,
  }[name] || require(name)) })
  return module.exports.default
}
const Today = component('components/program-dashboard/GuidedToday.tsx')
const Header = component('components/program-dashboard/TodayDashboardHeader.tsx')
const fixture = (tier = 'ignite') => ({ program: tier, client: { id: 'QA-ONLY', name: 'Maya' },
  capacityStatus: { status: 'moderate_capacity' }, assessments: { dailyCompleted: false },
  hydration: { status: 'needs_input', target: 80, remaining: 80, consumed: 0 },
  nutrition: { dataStatus: 'needs_input', calories: { percent: 0 }, protein: { percent: 0 } },
  flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true, recovery: false } } },
  execution: { workoutComplete: false, nutritionLogged: false, recoveryComplete: false },
  workout: { assigned: true, title: 'Assigned plan' }, workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Your assigned plan is available.' },
  symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Review existing guidance.' } })
const schedule = () => ({ date: '2026-10-13', timezone: 'America/Chicago', now: '2026-10-13T13:00:00Z', events: [], nextActionableEvent: null, dailyGuide: { date: '2026-10-13', activities: {} } })
const render = (logic, state = schedule()) => renderToStaticMarkup(React.createElement(Today, { logic, schedule: state }))

test('fresh Today has one primary action, persisted progress, and directly accessible activities in each tier', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const html = render(fixture(tier))
    assert.equal((html.match(/class="tier-primary-action"/g) || []).length, 1)
    assert.match(html, /aria-valuenow="0"/)
    assert.match(html, /Start daily check-in/)
    for (const href of ['/dashboard/check-in', '/dashboard/nutrition?log=water', '/dashboard/schedule', `/dashboard/program/${tier}/workout`, '/dashboard/recovery']) assert.ok(html.includes(`href="${href}"`))
    assert.ok(html.includes(`href="/dashboard/nutrition${tier === 'ember' ? '' : '?log=meal'}"`))
    assert.doesNotMatch(html, /breakfast|supplements|streak/i)
  }
})
test('recorded check-in advances the single action and completed status is explicit', () => {
  const logic = fixture(); logic.assessments.dailyCompleted = true
  const html = render(logic)
  assert.match(html, /aria-valuenow="1"/)
  assert.match(html, /data-activity-id="water" data-tutorial-id="dashboard-whats-next"/)
  assert.match(html, /data-activity-id="check-in" data-status="completed"/)
  assert.doesNotMatch(html, /Start daily check-in/)
})
test('one-step preference quiets supporting copy while keeping every activity accessible', () => {
  const state = schedule(); state.preferences = { carouselStyle: 'step' }
  const html = render(fixture(), state)
  assert.match(html, /Your day at a glance/)
  assert.match(html, /href="\/dashboard\/recovery"/)
  assert.doesNotMatch(html, /A quiet moment is available when you need it/)
  assert.doesNotMatch(html, /Log your next meal or reuse a saved entry/)
})
test('deferred check-in stays available to resume without becoming completion', () => {
  const state = schedule(); state.dailyGuide.activities['check-in'] = { status: 'deferred', until: '2026-10-13T15:00:00Z' }
  const html = render(fixture(), state)
  assert.match(html, /data-activity-id="check-in" data-status="deferred"/)
  assert.match(html, /Resume activity: Daily check-in/)
  assert.match(html, /aria-valuenow="0"/)
  assert.doesNotMatch(html, /Start daily check-in/)
})
test('safety guidance has no Later today button in the primary card', () => {
  const logic = fixture(); logic.symptoms.redFlag = true
  const html = render(logic)
  const card = html.match(/<article class="today-next"[\s\S]*?<\/article>/)[0]
  assert.match(card, /Review today/)
  assert.doesNotMatch(card, /Later today/)
})
test('header uses the member timezone for both greeting and date', () => {
  const state = schedule(); state.now = '2026-10-14T03:00:00Z'
  const html = renderToStaticMarkup(React.createElement(Header, { logic: fixture(), schedule: state }))
  assert.match(html, /Good Evening/)
  assert.match(html, /Tuesday, October 13/)
  assert.doesNotMatch(html, /Good Morning/)
})

test('partial schedule failure stays visible while core dashboard activities remain accessible', () => {
  const state = schedule(); state.unavailableSources = ['recurring_commitments']
  const html = render(fixture(), state)
  assert.match(html, /role="status">Some schedule details are temporarily unavailable/)
  assert.match(html, /Your saved activities are still recorded/)
  assert.match(html, /Start daily check-in/)
  assert.match(html, /href="\/dashboard\/nutrition\?log=water"/)
})
