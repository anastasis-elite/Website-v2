import CardArtworkModule from './cardArtworkFixture.mjs'
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
const { buildTodayViewModel } = await importTs('lib/dashboard/buildTodayViewModel.ts')
const recommendations = await importTs('lib/dashboard/dailyRecommendation.ts')
const timezone = await importTs('lib/timezone.ts')
const scheduleTime = await importTs('lib/schedule/time.ts')
const recoveryPresentation = await importTs('lib/recovery/todayCompletion.ts')
const streakProgress = await importTs('lib/dashboard/logic/streakRequirementProgress.ts')
const entitlements = await importTs('lib/entitlements.ts')
const scheduleRefreshCalls = []
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
function component(path, extra = {}, exportName = 'default') {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  runInNewContext(outputText, { module, exports: module.exports, Date, require: name => extra[name] || ({
    '@/components/CardArtwork': CardArtworkModule,
    'next/link': Link,
    'next/navigation': { useRouter: () => ({ refresh() {} }), usePathname: () => '/dashboard/program/ignite' },
    '@/lib/dashboard/todayActivities': activities,
    '@/lib/dashboard/dailyRecommendation': recommendations,
    '@/lib/schedule/client': { useDailyScheduleRefresh(...args) { scheduleRefreshCalls.push(args) } },
    '@/lib/schedule/time': scheduleTime,
    '@/lib/recovery/todayCompletion': recoveryPresentation,
    '@/lib/dashboard/logic/streakRequirementProgress': streakProgress,
    '@/lib/analytics': { trackEvent() {} },
    '@/lib/analytics/todayJourney': { recordTodayActionOpened() {}, recordTodayActionCompletions() {} },
    '@/lib/timezone': timezone,
  }[name] || require(name)) })
  return module.exports[exportName]
}
const ActionArrow = component('components/ActionArrow.tsx')
const StreakRequirementsCard = component('components/program-dashboard/StreakRequirementsCard.tsx')
const Today = component('components/program-dashboard/GuidedToday.tsx', { '@/components/ActionArrow': ActionArrow, '@/components/program-dashboard/StreakRequirementsCard': StreakRequirementsCard })
const PhoneAppCard = component('components/phone-app/PhoneAppFrame.tsx', { '@/components/ActionArrow': ActionArrow, './phone-app.css': {} }, 'PhoneAppCard')
const StreakBadge = component('components/program-dashboard/TodayStreakBadge.tsx', { './TodayPlanTheme.module.css': { streakBadge: 'today-streak-badge' } })
const Header = component('components/program-dashboard/TodayDashboardHeader.tsx', { '@/components/program-dashboard/TodayStreakBadge': StreakBadge })
const Plan = component('components/program-dashboard/PlanOverview.tsx', {
  '@/components/ActionArrow': ActionArrow,
  '@/lib/entitlements': entitlements,
  './TodayDashboardHeader': Header,
  './TodayPlanTheme.module.css': { surface: 'today-surface' },
})
const flame = (tier, completed = {}) => {
  const requiredItems = { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true, recovery: tier === 'phoenix', sleep: false, customTasks: tier !== 'ember' }
  const completedItems = Object.fromEntries(Object.keys(requiredItems).map(key => [key, completed[key] === true]))
  const streakEligible = Object.keys(requiredItems).every(key => !requiredItems[key] || completedItems[key])
  return { streakEligible, requirements: { date: '2026-10-13', programTier: tier, requiredItems, completedItems, streakEligible, completionScore: 0, resetMessage: null } }
}
const fixture = (tier = 'ignite') => ({ program: tier, client: { id: 'QA-ONLY', name: 'Maya' },
  capacityStatus: { status: 'moderate_capacity' }, assessments: { dailyCompleted: false },
  hydration: { status: 'needs_input', target: 80, remaining: 80, consumed: 0 },
  nutrition: { dataStatus: 'needs_input', calories: { percent: 0 }, protein: { percent: 0 } },
  flameState: flame(tier),
  execution: { workoutComplete: false, nutritionLogged: false, recoveryComplete: false },
  workout: { assigned: true, title: 'Assigned plan' }, workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Your assigned plan is available.' },
  symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Review existing guidance.' } })
const schedule = () => ({ date: '2026-10-13', timezone: 'America/Chicago', now: '2026-10-13T13:00:00Z', events: [], nextActionableEvent: null, dailyGuide: { date: '2026-10-13', activities: {} } })
const render = (logic, state = schedule()) => renderToStaticMarkup(React.createElement(Today, { logic, schedule: { ...state, todayViewModel: buildTodayViewModel(logic, state) } }))

test('compact Plan tiles remain whole image-and-content links without arrows and with unchanged destinations', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const html = renderToStaticMarkup(React.createElement(Plan, { logic: fixture(tier), schedule: schedule() }))
    const cards = [...html.matchAll(/<a href="([^"]+)" class="plan-overview-card">([\s\S]*?)<\/a>/g)]
    assert.equal(cards.length, 4)
    for (const [index, [href, title]] of [
      [`/dashboard/program/${tier}/workout`, 'Your training'], ['/dashboard/nutrition', 'Your nutrition'],
      ['/dashboard/recovery', 'Your recovery'], ['/dashboard/schedule', 'Your schedule'],
    ].entries()) {
      assert.equal(cards[index][1], href)
      assert.match(cards[index][2], /<img[^>]+alt=""/)
      assert.ok(cards[index][2].includes(`<h3>${title}</h3>`))
      assert.doesNotMatch(cards[index][2], /<svg\b|<circle\b|plan-overview-arrow/)
      assert.doesNotMatch(cards[index][2], /↗|<a\b|<button\b|Explore sessions|View targets|View recovery|Open schedule/)
    }
  }
  const source = readFileSync('components/program-dashboard/PlanOverview.tsx', 'utf8')
  assert.doesNotMatch(source, /ActionArrow|plan-overview-arrow/)
})

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
  const DashboardLoadingContent = component('components/program-dashboard/DashboardLoadingShell.tsx', {
    './DashboardLoadingShell.module.css': { loading: 'loading', satin: 'satin', folds: 'folds', content: 'content', brand: 'brand', rule: 'rule' },
    '@/components/program-dashboard/TodayStreakBadge': StreakBadge,
    '@/components/DashboardPerformance': () => null,
    '@/components/DashboardShellTiming': () => null,
  }, 'DashboardLoadingContent')
  const Ready = component('components/program-dashboard/DashboardReadyShell.tsx', {
    '@/components/program-dashboard/DashboardLoadingShell': { DashboardLoadingContent },
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
    assert.ok(html.includes(`href="/dashboard/program/${tier}?view=plan" class="client-dashboard-nav__item client-dashboard-nav__item--plan active" aria-current="page"`))
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
    assert.doesNotMatch(html, /breakfast|supplements/i)
  }
})
test('recorded check-in advances the single action and hides its completed card while progress remains saved', () => {
  const logic = fixture(); logic.assessments.dailyCompleted = true
  logic.flameState = flame(logic.program, { dailyCheckIn: true })
  const html = render(logic)
  assert.match(html, /aria-valuenow="1"/)
  assert.match(html, /data-activity-id="water" data-tutorial-id="dashboard-whats-next"/)
  assert.doesNotMatch(html, /data-activity-id="check-in"/)
  assert.doesNotMatch(html, /Start daily check-in/)
  assert.equal(activities.buildTodayActivities(logic, schedule()).activities.find(item => item.id === 'check-in').status, 'completed')
})

test('submitted Schedule Structure disappears while its canonical assessment completion remains counted', () => {
  const logic = fixture(); logic.assessments.dailyCompleted = true
  logic.flameState = flame(logic.program, { dailyCheckIn: true })
  const state = schedule()
  state.events = [{ id: 'schedule-structure:2026-10', event_type: 'assessment', source: 'system', title: 'Schedule Structure Assessment',
    action_route: '/dashboard/assessment/daily-structure?assessmentVersion=1', status: 'completed' }]
  const html = render(logic, state)
  assert.doesNotMatch(html, /data-activity-id="assessment:|Schedule Structure Assessment/)
  assert.match(html, /aria-valuenow="1"/)
  assert.equal(activities.buildTodayActivities(logic, state).activities.find(item => item.id === 'assessment:schedule-structure:2026-10').status, 'completed')
})

test('all-complete Today keeps saved progress and a history route without completed activity cards', () => {
  const logic = fixture(), state = schedule()
  logic.assessments.dailyCompleted = true
  logic.hydration = { status: 'ready', target: 80, remaining: 0, consumed: 80 }
  logic.execution = { workoutComplete: true, nutritionLogged: true, recoveryComplete: true }
  logic.flameState = flame(logic.program, { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true, recovery: true, customTasks: true })
  logic.nutrition = { ...logic.nutrition, dataStatus: 'known', calories: { percent: 100 }, protein: { percent: 0 },
    pacing: { state: 'complete', nextRefreshAt: null, prompt: 'Your recorded calories meet today’s target.' } }
  state.dailyGuide.activities.schedule = { status: 'reviewed' }
  const html = render(logic, state)
  assert.doesNotMatch(html, /<li data-activity-id=/)
  assert.ok(html.includes('Your recorded activities are saved. You can revisit your progress and history anytime.'))
  assert.match(html, /<h2>Day completed<\/h2>/)
  assert.ok(html.includes('Reward yourself with a little treat.'))
  assert.doesNotMatch(html, /A little moment, just for you|Look at you showing up for yourself/)
  assert.match(html, /aria-valuenow="5"/)
  assert.match(html, /Your streak is secured for today/)
  assert.match(html, /href="\/dashboard\/progress">View progress/)
  assert.equal(activities.buildTodayActivities(logic, state).completed, 4)
})

test('calorie pacing hides an on-pace card then restores it when behind without changing recorded progress', () => {
  const logic = fixture(), state = schedule()
  logic.assessments.dailyCompleted = true
  logic.hydration = { status: 'ready', target: 80, remaining: 0, consumed: 80 }
  logic.execution.nutritionLogged = true
  logic.nutrition = { ...logic.nutrition, dataStatus: 'known', calories: { percent: 40 }, protein: { percent: 0 },
    pacing: { state: 'on_pace', nextRefreshAt: '2026-10-13T16:00:00.001Z', prompt: 'Your recorded calories are on pace.' } }
  const ahead = render(logic, state)
  assert.doesNotMatch(ahead, /data-activity-id="nutrition"/)
  assert.equal(scheduleRefreshCalls.at(-1)[2], '2026-10-13T16:00:00.001Z')
  const savedProgress = activities.buildTodayActivities(logic, state).completed
  logic.nutrition.pacing = { state: 'behind', nextRefreshAt: '2026-10-14T02:00:00Z', prompt: 'Log what you’ve had, and consider a meal when it suits you.' }
  const behind = render(logic, state)
  assert.match(behind, /<li data-activity-id="nutrition" data-status="in_progress"/)
  assert.match(behind, /Log what you’ve had/)
  assert.equal(activities.buildTodayActivities(logic, state).completed, savedProgress)
})

test('sleep suppresses nutrition action cards and neutral input keeps a truthful logging option', () => {
  const logic = fixture()
  logic.nutrition.pacing = { state: 'sleep', nextRefreshAt: '2026-10-14T10:00:00Z', prompt: 'Nutrition reminders are paused during your sleep window.' }
  assert.doesNotMatch(render(logic), /data-activity-id="nutrition"/)
  logic.nutrition.pacing = { state: 'neutral', nextRefreshAt: null, prompt: 'Log what you’ve had. A saved waking schedule is needed to show your pace.' }
  const neutral = render(logic)
  assert.match(neutral, /<li data-activity-id="nutrition"/)
  assert.match(neutral, /Log what you’ve had/)
  assert.doesNotMatch(neutral, /you haven.t eaten|calorie deficit/i)
})

test('recent zero-macro note remains separate and does not restore an on-pace calorie card', () => {
  const logic = fixture()
  logic.nutrition.pacing = { state: 'on_pace', nextRefreshAt: '2026-10-13T16:00:00.001Z', prompt: 'Your recorded calories are on pace.' }
  logic.nutrition.macroReminder = { macros: ['protein'], startDate: '2026-10-10', endDate: '2026-10-12',
    message: 'Your recent logs show no recorded protein. Give that some attention in your food choices.' }
  const html = render(logic)
  assert.doesNotMatch(html, /data-activity-id="nutrition"/)
  assert.match(html, /<aside class="today-feedback" aria-label="Recent nutrition logs">/)
  assert.match(html, /Your recent logs show no recorded protein/)
  assert.match(html, /href="\/dashboard\/nutrition">Review nutrition logs/)
  assert.doesNotMatch(html, /role="alert"/)
})
test('compact Today cards keep one primary image-title-status link and separate activity options', () => {
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
      const kind = targets[index][0]
      const artwork = kind === 'check-in' || kind === 'recovery'
        ? `/illustrations/today-${kind}.svg`
        : `/_next/static/media/${kind}-640.webp`
      assert.ok(card[2].includes(`src="${artwork}"`))
      assert.ok(card[2].includes(`href="${targets[index][1]}"`))
      const primary = card[2].match(/^\s*<a\b[^>]*>([\s\S]*?)<\/a>/)?.[1]
      assert.ok(primary)
      assert.match(primary, /today-card-illustration/)
      assert.match(primary, /<strong>/)
      assert.match(primary, /today-activity-state/)
      assert.doesNotMatch(primary, /<button\b|<details\b|<summary\b|today-card-action|today-action-arrow/)
      const options = card[2].slice(card[2].indexOf('</a>') + 4)
      assert.match(options, /<details class="today-row-options">/)
      assert.doesNotMatch(card[2], /↗|today-card-action|today-action-arrow/)
    })
  }
  const state = schedule();state.dailyGuide.activities.water = { status: 'skipped' }
  const water = render(fixture(), state).match(/<li data-activity-id="water"[^>]*>([\s\S]*?)<\/li>/)[1]
  assert.match(water, /<\/a><button[^>]+aria-label="Resume activity: Hydration"/)
  assert.doesNotMatch(water.match(/^\s*<a\b[^>]*>([\s\S]*?)<\/a>/)[1], /<button\b/)
  const css = readFileSync('components/program-dashboard/TodayPlanTheme.module.css', 'utf8')
  assert.match(css, /height: clamp\(92px, 12vw, 132px\)/)
  assert.match(css, /height: 86px/)
  assert.match(css, /focus-visible[^}]*outline: 2px/)
  assert.doesNotMatch(css, /\.today-card-action|\.today-action-arrow/)
})

test('Recovery action cards use the same decorative SVG without changing destinations or unavailable controls', () => {
  for (const [href, action] of [
    ['/dashboard/meditation?practice=recovery-meditation', 'Open silent timer'],
    ['/dashboard/meditation?practice=breath-reset', 'Open breathing timer'],
    ['#own-practice', 'Choose your activity above'],
  ]) {
    const html = renderToStaticMarkup(React.createElement(PhoneAppCard, { title: 'Recovery practice', copy: 'Synthetic guidance', href, action }))
    assert.ok(html.includes(`href="${href}"`))
    assert.ok(html.includes(`>${action}<svg`))
    assert.match(html, /<svg class="phone-app-action-arrow"[^>]+stroke="currentColor"[^>]+aria-hidden="true"[^>]+focusable="false"/)
    assert.doesNotMatch(html, /↗/)
  }
  const html = renderToStaticMarkup(React.createElement(PhoneAppCard, { title: 'Recovery practice', copy: 'Synthetic guidance', href: '/dashboard/meditation', unavailable: 'Guided recording unavailable' }))
  assert.doesNotMatch(html, /<a\b|<svg\b/)
  assert.match(html, /Guided recording unavailable/)
})

test('Today and Plan preserve explicit rest and unavailable day labels without inventing workout completion', () => {
  for (const [state, title, reason] of [
    ['rest', 'Rest day', 'Today is an intentional rest day in your program. No workout is assigned.'],
    ['unavailable', 'Workout unavailable', 'Your training plan is missing or incomplete. Contact your coach to review it.'],
  ]) {
    const logic = fixture()
    logic.workout = { assigned: false, title }
    logic.workoutDecision = { ...logic.workoutDecision, assignedWorkout: { workout_state: state }, canTrain: false, reasonForModification: reason }
    const html = render(logic)
    const status = html.match(/<p class="today-workout-status"[^>]*>([\s\S]*?)<\/p>/)?.[1]
    assert.ok(status)
    assert.ok(status.includes(`<strong>${title}</strong>`))
    assert.ok(status.includes(reason))
    assert.doesNotMatch(status, /<a\b|<button\b/)
    assert.doesNotMatch(html, /data-activity-id="workout"/)
    const plan = renderToStaticMarkup(React.createElement(Plan, { logic, schedule: schedule() }))
    assert.ok(plan.includes(`<p>${title}</p>`))
    assert.doesNotMatch(plan, /Make room for movement and rest/)
  }
  const unknown = fixture(); unknown.workout.assigned = false
  assert.doesNotMatch(render(unknown), /today-workout-status/)
  assert.match(renderToStaticMarkup(React.createElement(Plan, { logic: unknown, schedule: schedule() })), /Make room for movement and rest/)
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

test('GuidedToday schedules the earliest water, calorie or distinct recovery boundary without polling', () => {
  const current = fixture(), state = schedule()
  current.nutrition.pacing = { state: 'on_pace', nextRefreshAt: '2026-10-13T16:00:00.001Z' }
  current.hydration.presentationPacing = { state: 'on_pace', nextRefreshAt: '2026-10-13T15:00:00.001Z' }
  scheduleRefreshCalls.length = 0
  render(current, state)
  assert.equal(scheduleRefreshCalls.at(-1)[2], '2026-10-13T15:00:00.001Z')
  current.hydration.presentationPacing.nextRefreshAt = 'invalid'
  render(current, state)
  assert.equal(scheduleRefreshCalls.at(-1)[2], '2026-10-13T16:00:00.001Z')
  current.execution.recoveryEvidence = { ownerUserId: 'QA-OWNER', clientId: 'QA-ONLY', date: state.date,
    available: true, completedAt: [], unlinkedRecordCount: 0 }
  state.events = [{ id: 'later-recovery', user_id: 'QA-OWNER', client_id: 'QA-ONLY', event_type: 'recovery',
    status: 'scheduled', start_at: '2026-10-13T14:00:00Z', end_at: '2026-10-13T14:15:00Z' }]
  render(current, state)
  assert.equal(scheduleRefreshCalls.at(-1)[2], '2026-10-13T14:00:00.000Z')
  assert.equal(scheduleRefreshCalls.at(-1)[1], true)
  const source = readFileSync('components/program-dashboard/GuidedToday.tsx', 'utf8')
  assert.doesNotMatch(source, /setInterval/)
})

test('approved incomplete copy maps the treat invitation to next step and encouragement to At your pace while progress stays visible', () => {
  const logic = fixture(), state = schedule()
  logic.assessments.dailyCompleted = true
  logic.hydration = { status: 'ready', target: 80, consumed: 40, remaining: 40, presentationPacing: { state: 'on_pace' } }
  logic.nutrition = { ...logic.nutrition, dataStatus: 'known', calories: { percent: 50 }, pacing: { state: 'on_pace', nextRefreshAt: null } }
  logic.execution = { workoutComplete: true, nutritionLogged: false, recoveryComplete: true }
  logic.flameState = flame(logic.program, { dailyCheckIn: true, workoutOrMovement: true, customTasks: true })
  state.dailyGuide.activities.schedule = { status: 'reviewed' }
  const html = render(logic, state)
  const emptySection = /<section class="today-activities"[\s\S]*?<\/section>/.exec(html)?.[0]
  assert.ok(emptySection)
  assert.match(html, /<h2>A little moment, just for you\.<\/h2>/)
  assert.ok(html.includes('You’ve made space for yourself today. Enjoy a warm cup of coffee or tea, a little dessert, or whatever feels like a treat to you. You deserve to enjoy it.'))
  assert.ok(emptySection.includes('<h2>At your pace.</h2>'))
  assert.ok(emptySection.includes('<p role="status"><strong>Look at you showing up for yourself.</strong>'))
  assert.ok(emptySection.includes('You’re making space for your well-being today, and that matters. Take a breath and enjoy this moment. You’re doing beautifully.'))
  assert.doesNotMatch(emptySection, /A little moment, just for you|warm cup of coffee|Nothing else is due/)
  assert.match(emptySection, /href="\/dashboard\/progress">View progress<\/a>/)
  assert.match(html, /aria-valuenow="3"/)
  assert.match(html, /2 required items remain/)
  assert.doesNotMatch(html, /Day completed|Your streak is secured|Your recorded activities are saved/)
})

test('approved empty copy never replaces actionable activity cards or their original destinations', () => {
  const logic = fixture(), state = schedule(), html = render(logic, state)
  assert.match(html, /data-activity-id="check-in"/)
  assert.match(html, /href="\/dashboard\/check-in"/)
  assert.match(html, /Start daily check-in/)
  assert.match(html, /<li data-activity-id="water"/)
  assert.match(html, /<li data-activity-id="nutrition"/)
  assert.match(html, /<h2>At your pace\.<\/h2>/)
  assert.doesNotMatch(html, /A little moment, just for you|Look at you showing up for yourself|warm cup of coffee|You’re doing beautifully/)
})
