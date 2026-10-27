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
const StreakBadge = component('components/program-dashboard/TodayStreakBadge.tsx', { './TodayPlanTheme.module.css': { streakBadge: 'today-streak-badge' } })
const Header = component('components/program-dashboard/TodayDashboardHeader.tsx', { '@/components/program-dashboard/TodayStreakBadge': StreakBadge })
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

test('Today shows a confirmed zero and nonzero streak, while Plan omits the badge', () => {
  for (const count of [0, 1, 17]) {
    const logic = fixture(); logic.flameState.streak = count; logic.streakAvailable = true
    const html = renderToStaticMarkup(React.createElement(Header, { logic, schedule: schedule() }))
    assert.match(html, new RegExp(`aria-label="${count} ${count === 1 ? 'day' : 'days'} streak"`))
    assert.ok(html.includes(`<span aria-hidden="true">${count}</span>`))
    assert.ok(html.includes('data-testid="today-streak"'))
    const plan = renderToStaticMarkup(React.createElement(Header, { logic, schedule: schedule(), plan: true }))
    assert.doesNotMatch(plan, /data-testid="today-streak"/)
  }
})

test('missing, failed, invalid or loading streak data never renders a confirmed zero', () => {
  for (const props of [{ count: 0 }, { count: 0, available: false }, { available: true }, { count: null, available: true }, { count: NaN, available: true }, { count: -1, available: true }, { count: 0, available: true, loading: true }]) {
    const html = renderToStaticMarkup(React.createElement(StreakBadge, props))
    assert.doesNotMatch(html, /aria-label="0 days streak"/)
    assert.ok(html.includes('—'))
    if (props.loading) assert.match(html, /aria-busy="true"/)
  }
})

test('known Today loading shell keeps a flame placeholder without claiming zero', () => {
  const Ready = component('components/program-dashboard/DashboardReadyShell.tsx', {
    '@/components/program-dashboard/TodayStreakBadge': StreakBadge,
    '@/components/DashboardPerformance': () => null,
    '@/components/DashboardShellTiming': () => null,
    '@/lib/nutrition/loggingRoutes': { WATER_ENTRY_HREF: '/dashboard/nutrition?log=water', foodEntryHref: () => '/dashboard/nutrition' },
  })
  const html = renderToStaticMarkup(React.createElement(Ready, { program: 'ember' }))
  assert.match(html, /aria-label="Streak loading"/)
  assert.doesNotMatch(html, /0 days streak/)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Ready, { program: 'ember', showStreak: false })), /today-streak/)
})

test('Community uses the existing destination and active state without disturbing Today or Plan', () => {
  let pathname = '/dashboard/program/ember', query = ''
  const Navigation = component('components/navigation/ClientDashboardNav.tsx', {
    'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(query) },
    '@/components/navigation/DashboardMoreMenu': () => React.createElement('button', null, 'You'),
    './guided-navigation.css': {},
  })
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    pathname = `/dashboard/program/${tier}`; query = ''
    let html = renderToStaticMarkup(React.createElement(Navigation, { program: tier }))
    assert.ok(html.includes('href="/dashboard/community"'))
    assert.match(html, /data-nav-item="community"/)
    assert.match(html, /<small>Community<\/small>/)
    query = 'view=plan'
    html = renderToStaticMarkup(React.createElement(Navigation, { program: tier }))
    assert.match(html, /href="[^\"]+\/plan"[^>]+aria-current="page"/)
    pathname = '/dashboard/community'; query = ''
    html = renderToStaticMarkup(React.createElement(Navigation, { program: tier }))
    assert.match(html, /href="\/dashboard\/community"[^>]+aria-current="page"/)
    pathname = '/dashboard/onboarding/profile'
    assert.equal(renderToStaticMarkup(React.createElement(Navigation, { program: tier })), '')
  }
})

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
test('all six activities keep their destinations and use the shared illustrated cards, with water and schedule first', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const html = render(fixture(tier))
    const cards = [...html.matchAll(/<li data-activity-id="([^"]+)"[^>]*data-illustrated="true"[^>]*>([\s\S]*?)<\/li>/g)]
    assert.deepEqual(cards.map(card => card[1]), ['water', 'schedule', 'check-in', 'nutrition', 'workout', 'recovery'])
    const targets = [
      ['water', '/dashboard/nutrition?log=water'], ['schedule', '/dashboard/schedule'],
      ['check-in', '/dashboard/check-in'], ['nutrition', `/dashboard/nutrition${tier === 'ember' ? '' : '?log=meal'}`],
      ['training', `/dashboard/program/${tier}/workout`], ['recovery', '/dashboard/recovery'],
    ]
    cards.forEach((card, index) => {
      assert.ok(card[2].includes(`src="/illustrations/today-${targets[index][0]}.svg"`))
      assert.ok(card[2].includes(`href="${targets[index][1]}"`))
    })
  }
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
