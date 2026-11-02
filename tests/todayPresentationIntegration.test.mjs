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
const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
// The generic TS helper does not load JSON templates. Keep those actual saved
// template dependencies in this local fixture instead of stubbing day intent.
const templateMocks = Object.fromEntries([...readFileSync('lib/program/templateDayIntent.ts', 'utf8').matchAll(/from '(@\/data\/template\/[^']+\.json)'/g)]
  .map(([, path]) => [path, JSON.parse(readFileSync(path.slice(2), 'utf8'))]))
const templateIntent = compile('lib/program/templateDayIntent.ts', templateMocks)
const { getSavedPlanState } = compile('lib/program/getSavedPlanState.ts', { '@/lib/program/templateDayIntent': templateIntent })
const { nextScheduleBoundary } = await importTs('lib/schedule/refresh.ts')
const { localDateKey } = await importTs('lib/timezone.ts')
const clone = value => JSON.parse(JSON.stringify(value))

function logicFixture() {
  return { program: 'ignite', client: { id: 'SYNTHETIC-MEMBER' },
    assessments: { dailyCompleted: true }, symptoms: { redFlag: false, severity: 'none' },
    capacityStatus: { status: 'moderate_capacity' }, recoveryStatus: { status: 'ready', reasoning: 'Existing guidance.' }, fuelReadiness: { status: 'ready' },
    hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready' },
    nutrition: { dataStatus: 'known', calories: { target: 2000, consumed: 1000, remaining: 1000, percent: 50 },
      protein: { target: 100, consumed: 0, remaining: 100, percent: 0 }, carbs: { percent: 50 }, fats: { percent: 50 },
      pacing: { state: 'on_pace', expectedPercent: 40, consumedPercent: 50, nextRefreshAt: '2026-11-02T18:00:00.001Z', prompt: 'Recorded calories are on pace.' },
      macroReminder: { macros: ['protein'], startDate: '2026-10-30', endDate: '2026-11-01', message: 'Synthetic recent recorded-food note.' } },
    flameState: { requirements: { requiredItems: { dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: false, recovery: false } } },
    execution: { nutritionLogged: true, workoutComplete: false, recoveryComplete: true },
    workout: { assigned: false, title: 'Rest day' }, workoutDecision: { canTrain: false, assignedWorkout: { workout_state: 'rest' }, reasonForModification: 'Intentional rest day.' },
    cycle: {}, insight: {}, engineVersion: 'synthetic-existing-engine' }
}

function scheduleFixture() {
  const assessment = { id: 'schedule-structure:2026-11', event_type: 'assessment', source: 'system',
    title: 'Schedule Structure Assessment', action_route: '/dashboard/assessment/daily-structure?assessmentVersion=1',
    status: 'completed', suggested: false, start_at: '2026-11-02T12:00:00Z', end_at: '2026-11-02T12:15:00Z' }
  return { date: '2026-11-02', timezone: 'America/Chicago', now: '2026-11-02T17:00:00Z', events: [assessment],
    nextActionableEvent: assessment, dailyGuide: { date: '2026-11-02', activities: { schedule: { status: 'reviewed' } } } }
}

test('shared presentation and next-step selection agree without changing canonical nutrition or completed assessment progress', () => {
  const logic = logicFixture(), schedule = scheduleFixture()
  const canonical = buildTodayActivities(logic, schedule), saved = clone(canonical)
  assert.deepEqual([canonical.completed, canonical.total], [4, 4])
  const nutrition = canonical.activities.find(activity => activity.id === 'nutrition')
  assert.equal(nutrition.status, 'completed', 'A persisted logging requirement stays recorded independently of pacing.')
  for (const state of ['on_pace', 'sleep', 'complete']) {
    logic.nutrition.pacing.state = state
    assert.deepEqual(presentTodayActivities(logic, schedule, canonical.activities), [])
    const recommendation = buildDailyRecommendation(logic, schedule)
    assert.equal(recommendation.primary.id, 'pause')
    assert.equal(recommendation.supporting.length, 0)
    assert.equal(recommendation.evidence.food, 'partial', 'Existing food/readiness evidence is not rewritten by presentation.')
  }
  logic.nutrition.pacing = { ...logic.nutrition.pacing, state: 'behind', prompt: 'Log what you’ve had.' }
  const presented = presentTodayActivities(logic, schedule, canonical.activities)
  assert.deepEqual(presented.map(activity => [activity.id, activity.status]), [['nutrition', 'in_progress']])
  const recommendation = buildDailyRecommendation(logic, schedule)
  assert.equal(recommendation.primary.id, 'food-input')
  assert.equal(recommendation.primary.reason, 'Log what you’ve had.')
  assert.ok(![recommendation.primary, ...recommendation.supporting].some(action => action.eventId === schedule.nextActionableEvent.id))
  assert.deepEqual(canonical, saved)
  assert.deepEqual(buildTodayActivities(logic, schedule), saved)
})

function compile(path, mocks, globals = {}, suffix = '') {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8') + suffix, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  runInNewContext(outputText, { module, exports: module.exports, Date, URL, ...globals,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) }, { filename: path })
  return module.exports
}

function refreshFixture(visible = true) {
  let now = Date.parse('2026-11-02T12:00:00Z'), refreshes = 0
  const effects = [], timers = new Map(), recordedTimers = [], cleared = []
  const documentListeners = new Map(), windowListeners = new Map()
  const listeners = map => ({
    addEventListener(name, callback) { const set = map.get(name) || new Set();set.add(callback);map.set(name, set) },
    removeEventListener(name, callback) { map.get(name)?.delete(callback) },
  })
  const document = { visibilityState: visible ? 'visible' : 'hidden', ...listeners(documentListeners) }
  const window = { ...listeners(windowListeners), setTimeout(callback, delay) {
    const id = recordedTimers.length + 1;timers.set(id, callback);recordedTimers.push({ id, callback, delay });return id
  }, clearTimeout(id) { cleared.push(id);timers.delete(id) }, setInterval() { assert.fail('The pace boundary must not poll.') } }
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  const router = { refresh() { refreshes++ } }
  const refreshModule = compile('lib/dashboard/requestRefresh.ts', {
    '@/lib/performance/dashboard': { markDashboardStage() {} },
  }, { Date: FixedDate })
  const hook = compile('lib/schedule/client.ts', {
    react: { useEffect(effect) { effects.push(effect) }, useRef(value) { return { current: value } } },
    'next/navigation': { useRouter: () => router },
    '@/lib/calendar/client': { CALENDAR_CHANGE_STORAGE_KEY: 'synthetic-calendar-change' },
    './refresh': { nextScheduleBoundary: schedule => nextScheduleBoundary(schedule, now) },
    '@/lib/timezone': { localDateKey }, '@/lib/dashboard/requestRefresh': refreshModule,
  }, { Date: FixedDate, document, window }).useDailyScheduleRefresh
  const paceBoundary = new Date(now + 501).toISOString()
  hook({ date: '2026-11-02', timezone: 'America/Chicago', events: [] }, true, paceBoundary)
  const cleanup = effects[0]()
  return { document, timers, recordedTimers, cleared, documentListeners, windowListeners,
    get refreshes() { return refreshes }, setNow(value) { now = value },
    focus() { for (const callback of windowListeners.get('focus') || []) callback() }, cleanup,
    atPaceBoundary() { now = Date.parse(paceBoundary) + 50;recordedTimers[0].callback() },
  }
}

test('calculated pace refresh uses one timer, survives focus debounce, ignores a hidden document and cleans up', () => {
  const visible = refreshFixture()
  assert.equal(visible.recordedTimers.length, 1)
  assert.equal(visible.recordedTimers[0].delay, 551)
  visible.focus();assert.equal(visible.refreshes, 1)
  visible.atPaceBoundary();assert.equal(visible.refreshes, 2, 'The actual shared one-second focus debounce must not swallow the pace crossing.')
  assert.equal(visible.recordedTimers.length, 1, 'A boundary callback does not schedule a polling loop.')
  visible.cleanup()
  assert.equal(visible.timers.size, 0);assert.deepEqual(visible.cleared, [1])
  for (const listeners of [...visible.documentListeners.values(), ...visible.windowListeners.values()]) assert.equal(listeners.size, 0)
  const hidden = refreshFixture(false)
  hidden.focus();hidden.atPaceBoundary();assert.equal(hidden.refreshes, 0)
  hidden.cleanup();assert.equal(hidden.timers.size, 0)
})

function dashboardFixture(result) {
  const state = { result, logic: logicFixture(), logicCalls: 0, workoutCalls: 0, readyRenders: 0, audits: [], afters: [], reads: [] }
  const supabase = { from(table) {
    assert.equal(table, 'program_outputs');state.reads.push(['from', table])
    return {
      select(value) { state.reads.push(['select', value]);return this },
      eq(key, value) { state.reads.push(['eq', key, value]);return this },
      order(key, value) { state.reads.push(['order', key, value]);return this },
      limit(value) { state.reads.push(['limit', value]);return this },
      async maybeSingle() { return state.result },
      insert() { assert.fail('Viewing a saved day cannot regenerate or overwrite a plan.') },
      update() { assert.fail('Viewing a saved day cannot rewrite workout history.') },
    }
  } }
  const Ready = () => { state.readyRenders++;return React.createElement('div', { 'data-synthetic-ready': true }, 'Saved day') }
  const mocks = {
    'next/navigation': { redirect() { assert.fail('The private dashboard fixture should not redirect.') } },
    'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
    'next/server': { after(callback) { state.afters.push(callback) } },
    '@/components/program-dashboard/PlanOverview': () => null,
    '@/components/program-dashboard/EmberDashboard': Ready,
    '@/components/program-dashboard/IgniteDashboard': Ready,
    '@/components/program-dashboard/PhoenixDashboard': Ready,
    '@/lib/dashboard/getDashboardContext': { getDashboardContext() { assert.fail('Verified context is supplied directly to this private rendering fixture.') } },
    '@/lib/day/getDailyExecutionPlan': { getDailyExecutionPlan: async () => ({}) },
    '@/lib/cycle/getCycleStatus': { getCycleStatus: () => ({}) },
    '@/lib/program/getProgramWorkout': { getProgramWorkout() { state.workoutCalls++;return { programJson: {}, todaysWorkout: null, cycleAdjustment: {}, adjustedExercises: [] } } },
    '@/lib/program/getSavedPlanState': { getSavedPlanState },
    '@/lib/safety/getRecentSafetyFlags': { getRecentSafetyFlags: async () => [] },
    '@/components/legal/SafetyEscalationNotice': () => null,
    '@/lib/legal/logRecommendationAudit': { logRecommendationAudit: async audit => { state.audits.push(audit) } },
    '@/lib/dashboard/logic/getProgramLogicEngine': { getProgramLogicEngine: async () => { state.logicCalls++;return state.logic } },
    '@/lib/assessment/getMonthlyAssessmentStatus': { getMonthlyAssessmentStatus: async () => ({ due: false }) },
    '@/lib/schedule/service': { getDailyScheduleState: async () => ({ date: '2026-11-02', now: '2026-11-02T17:00:00Z' }) },
    '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations': { getPhoenixRecipeRecommendations: () => [] },
    '@/components/program-dashboard/DashboardReadyShell': () => null,
    '@/components/DashboardPerformance': () => null,
    '@/components/program-dashboard/TodayPlanTheme.module.css': { page: 'synthetic-page' },
  }
  const page = compile('app/dashboard/program/[program]/page.tsx', mocks, {
    fetch() { assert.fail('Rendering a saved day must not request plan regeneration.') },
  }, '\nexport { PersonalizedDashboard as __testPersonalizedDashboard }\n')
  return { state, render: () => page.__testPersonalizedDashboard({ supabase, user: { id: 'SYNTHETIC-OWNER' },
    client: { client_id: 'SYNTHETIC-MEMBER', program: 'ignite' }, program: 'ignite', view: 'today' }) }
}

test('saved-plan read failure reaches the existing error boundary instead of rendering missing-plan or ready content', async () => {
  const fixture = dashboardFixture({ data: null, error: { message: 'Synthetic private database detail' } })
  await assert.rejects(fixture.render(), error => error.message === 'We couldn’t load your saved training plan. Please retry.')
  assert.equal(fixture.state.workoutCalls, 0);assert.equal(fixture.state.logicCalls, 0)
  assert.equal(fixture.state.readyRenders, 0);assert.equal(fixture.state.afters.length, 0)
  assert.ok(fixture.state.reads.some(row => row[0] === 'eq' && row[1] === 'client_id' && row[2] === 'SYNTHETIC-MEMBER'))
  assert.ok(fixture.state.reads.some(row => row[0] === 'eq' && row[1] === 'program' && row[2] === 'ignite'))
})

test('missing and incomplete saved plans expose manual setup or repair while ready plans do not, with no automatic generation', async () => {
  for (const [output, expected] of [
    [null, 'Open plan setup'],
    [{ program: 'ignite', program_json: { days: [{ day_name: 'Monday', day_intent: 'training', exercises: [] }] } }, 'Review and retry plan'],
    [{ program: 'ignite', program_json: { days: [{ day_name: 'Monday', day_intent: 'training', exercises: [{ id: 'saved-exercise' }] }] } }, null],
  ]) {
    const fixture = dashboardFixture({ data: output, error: null })
    const html = renderToStaticMarkup(await fixture.render())
    assert.equal(fixture.state.readyRenders, 1, 'Usable day content remains available alongside a manual recovery link.')
    if (expected) {
      assert.match(html, /href="\/dashboard\/onboarding\/plan"/)
      assert.ok(html.includes(expected))
    } else assert.doesNotMatch(html, /onboarding\/plan|Review and retry plan/)
    assert.equal(fixture.state.reads.filter(row => row[0] === 'from').length, 1)
  }
})

test('transient calorie and macro presentation hints are excluded from the existing recommendation audit', async () => {
  const fixture = dashboardFixture({ data: null, error: null })
  const original = clone(fixture.state.logic.nutrition)
  await fixture.render()
  assert.equal(fixture.state.afters.length, 1)
  await fixture.state.afters[0]()
  const audit = fixture.state.audits[0]
  assert.equal(audit.recommendationType, 'daily_program_logic')
  const recorded = audit.recommendationOutput.nutrition
  assert.equal(Object.hasOwn(recorded, 'pacing'), false)
  assert.equal(Object.hasOwn(recorded, 'macroReminder'), false)
  assert.equal(recorded.calories.consumed, original.calories.consumed)
  assert.equal(recorded.protein.percent, original.protein.percent)
  assert.deepEqual(fixture.state.logic.nutrition, original, 'Filtering audit hints does not erase ready UI state.')
})
