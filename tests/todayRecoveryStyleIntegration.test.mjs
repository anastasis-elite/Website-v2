import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import CardArtworkModule from './cardArtworkFixture.mjs'
import TodayAffirmationModule from './todayAffirmationFixture.mjs'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const { buildTodayViewModel } = await importTs('lib/dashboard/buildTodayViewModel.ts')
const { buildRecoveryRewardSuggestion } = await importTs('lib/recovery/rewardSuggestion.ts')
const scheduleTime = await importTs('lib/schedule/time.ts')
const timezone = await importTs('lib/timezone.ts')
const date = new Date().toISOString().slice(0, 10)
const now = new Date(`${date}T12:00:00Z`)
const userId = 'RECOVERY-STYLE-OWNER', clientId = 'RECOVERY-STYLE-MEMBER'

function loadComponents() {
  const cache = new Map()
  const mocks = {
    react: React,
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/CardArtwork': CardArtworkModule,
    '@/components/program-dashboard/TodayAffirmation': TodayAffirmationModule,
    '@/components/program-dashboard/StreakRequirementsCard': { __esModule: true, default: () => null },
    '@/lib/schedule/client': { useDailyScheduleRefresh() {} },
    '@/lib/schedule/time': scheduleTime, '@/lib/timezone': timezone,
    '@/lib/analytics': { trackEvent() {} },
    '@/lib/analytics/todayJourney': { recordTodayActionOpened() {}, recordTodayActionCompletions() {} },
  }
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    const module = { exports: {} }; cache.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(compiled, { module, exports: module.exports, Date,
      fetch() { assert.fail('Rendering or switching Today style cannot write recovery, schedules, history or goals.') },
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name]
        if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        return !base ? require(name) : load(extname(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: path })
    return module.exports
  }
  return load
}

const Workspace = loadComponents()('components/program-dashboard/TierAwareDashboardWorkspace.tsx').default
function fixture(program = 'ignite', style = 'section', savedPatch = {}) {
  const member = { client_id: clientId, auth_user_id: userId, program, timezone: 'UTC' }
  const saved = { client_id: clientId, auth_user_id: userId, log_date: date, updated_at: `${date}T11:00:00Z`,
    energy_level: 5, stress_level: 8, soreness_level: 3, ...savedPatch }
  const reward = buildRecoveryRewardSuggestion({ date, userId, client: member, now,
    sources: { recoveryLog: saved, recoveryAvailable: true, workoutsAvailable: true }, workouts: [],
    safety: { canTrain: true, workoutState: 'planned' } })
  const logic = { program, client: { id: clientId, timezone: 'UTC' },
    assessments: { dailyCompleted: true }, symptoms: { redFlag: false },
    capacityStatus: { status: 'moderate_capacity' }, recoveryStatus: { status: 'normal_training_day', reasoning: 'Existing saved recovery guidance.' },
    hydration: { target: 80, consumed: 40, remaining: 40, status: 'ready' },
    nutrition: { dataStatus: 'known', calories: { percent: 40 }, protein: { percent: 40 } },
    workout: { assigned: true, title: 'Existing saved generated day' },
    workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Existing saved training decision.', assignedWorkout: { workout_state: 'planned' } },
    execution: { workoutComplete: false, nutritionLogged: false, recoveryComplete: false,
      recoveryEvidence: { ownerUserId: userId, clientId, date, available: true, completedAt: [], unlinkedRecordCount: 0 } },
    ...(reward ? { recoveryRewardSuggestion: reward } : {}),
  }
  const schedule = { date, timezone: 'UTC', now: now.toISOString(), events: [], unavailableSources: [], nextActionableEvent: null,
    preferences: { carouselStyle: style, executionStyle: 'flow', transitionMinutes: 10 }, dailyGuide: { date, activities: {} } }
  return { logic, schedule, member }
}

function rendered(current) {
  const before = structuredClone({ logic: current.logic, schedule: current.schedule })
  const model = buildTodayViewModel(current.logic, current.schedule)
  const html = renderToStaticMarkup(React.createElement(Workspace, {
    tier: current.logic.program, logic: current.logic, schedule: { ...current.schedule, todayViewModel: model },
  }))
  assert.deepEqual({ logic: current.logic, schedule: current.schedule }, before)
  return { model, html }
}

const recoveryEvent = () => ({ id: 'later-recovery', user_id: userId, client_id: clientId, schedule_date: date,
  title: 'Saved evening recovery', event_type: 'recovery', source: 'manual', status: 'scheduled', all_day: false,
  start_at: `${date}T18:00:00Z`, end_at: `${date}T18:30:00Z`, timezone: 'UTC', flexibility_type: 'fixed', suggested: false })

test('eligible live Recovery suggestions render once in both saved styles with their original tier and optional behavior', () => {
  for (const program of ['ignite', 'phoenix']) for (const style of ['step', 'section']) {
    const current = fixture(program, style), { model, html } = rendered(current)
    assert.equal(model.recoveryRewardSuggestion, current.logic.recoveryRewardSuggestion)
    assert.equal((html.match(/data-recovery-suggestion="high-stress"/g) || []).length, 1)
    assert.match(html, /Let the day soften\./); assert.match(html, /Optional/); assert.match(html, /Maybe another time/)
    if (style === 'section') {
      assert.equal((html.match(/data-day-section=/g) || []).length, 3)
      assert.doesNotMatch(html, /Review schedule|Select schedule|Schedule review|At your pace/)
    } else assert.match(html, /data-testid="guided-next-step"/)
  }
})

test('saved holds, completed recovery, unread evidence and future recovery windows keep the optional suggestion suppressed in both styles', () => {
  for (const style of ['step', 'section']) for (const condition of ['completed', 'skipped', 'deferred', 'unavailable', 'future']) {
    const current = fixture('ignite', style)
    if (condition === 'completed') { current.logic.execution.recoveryComplete = true; current.logic.execution.recoveryEvidence.completedAt = [`${date}T08:00:00Z`] }
    if (condition === 'skipped') current.schedule.dailyGuide.activities.recovery = { status: 'skipped' }
    if (condition === 'deferred') current.schedule.dailyGuide.activities.recovery = { status: 'deferred', until: `${date}T19:00:00Z` }
    if (condition === 'unavailable') current.logic.execution.recoveryEvidence.available = false
    if (condition === 'future') current.schedule.events = [recoveryEvent()]
    const { model, html } = rendered(current)
    assert.equal(model.recoveryRewardSuggestion, undefined, `${style} ${condition}`)
    assert.doesNotMatch(html, /data-recovery-suggestion="high-stress"/)
    if (style === 'section' && condition === 'future') assert.match(html, /data-event-id="later-recovery"/)
  }
})

test('Ember keeps approved generic reward wording and cannot gain a personalized suggestion by switching styles', () => {
  for (const style of ['step', 'section']) {
    const current = fixture('ember', style)
    assert.equal(current.logic.recoveryRewardSuggestion, undefined)
    const { model, html } = rendered(current)
    assert.equal(model.recoveryRewardSuggestion, undefined)
    const recovery = model.today.activities.find(item => item.id === 'recovery')
    assert.equal(recovery.title, 'A little reward, just for you.')
    assert.equal(recovery.detail, 'Put on a podcast, get comfortable, or choose your own way to unwind.')
    assert.equal(recovery.href, '/dashboard/recovery')
    assert.match(html, /A little reward, just for you\./)
    assert.doesNotMatch(html, /data-recovery-suggestion|You logged high stress/)
    current.logic.recoveryRewardSuggestion = fixture('ignite', style).logic.recoveryRewardSuggestion
    assert.equal(rendered(current).model.recoveryRewardSuggestion, undefined)
  }
})

test('validated saved safety guidance survives both styles and keeps visible workout identities on the existing recovery destination', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) for (const style of ['step', 'section']) {
    const current = fixture(program, style, { sick: true })
    assert.equal(current.logic.symptoms.redFlag, false, 'The saved validated safety suggestion need not alter the base symptom decision.')
    current.logic.execution.recoveryComplete = true
    current.schedule.dailyGuide.activities.recovery = { status: 'skipped' }
    const event = { id: 'saved-separate-workout', user_id: userId, client_id: clientId, schedule_date: date,
      title: 'Saved evening training', event_type: 'workout', source: 'external_calendar', calendar_event_id: 'saved-class',
      status: 'scheduled', all_day: false, start_at: `${date}T18:00:00Z`, end_at: `${date}T19:00:00Z`, timezone: 'UTC', flexibility_type: 'fixed' }
    current.schedule.events = [event]
    const { model, html } = rendered(current)
    assert.equal(model.recoveryRewardSuggestion.kind, 'safety'); assert.equal(model.recommendation.primary.id, 'safety')
    assert.equal(model.workout.state, 'recovery'); assert.equal(model.workout.inactive, true)
    assert.match(html, /data-kind="safety"/); assert.match(html, /Your safety comes first\./)
    assert.doesNotMatch(html, /Maybe another time|Later today/)
    assert.ok(!model.presentedActivities.some(item => item.category === 'workout' || item.id === 'assessment:strength'))
    if (style === 'section') {
      const card = model.daySections.sections.flatMap(section => section.items).find(item => item.eventId === event.id)
      assert.ok(card); assert.equal(card.href, '/dashboard/recovery'); assert.equal(card.startAt, `${date}T18:00:00.000Z`)
      assert.equal(card.detail, model.recoveryRewardSuggestion.description)
      assert.match(html, /data-event-id="saved-separate-workout"/)
      assert.doesNotMatch(html, /href="\/dashboard\/program\/[^/]+\/workout"/)
    }
  }
})

test('stale or foreign live suggestion scope stays suppressed without rewriting recovery evidence in either style', () => {
  for (const style of ['step', 'section']) for (const patch of [{ clientId: 'another-member' }, { date: '2020-01-01' }, { timezone: 'America/Chicago' }]) {
    const current = fixture('ignite', style)
    current.logic.recoveryRewardSuggestion = { ...current.logic.recoveryRewardSuggestion, ...patch }
    const { model, html } = rendered(current)
    assert.equal(model.recoveryRewardSuggestion, undefined)
    assert.doesNotMatch(html, /data-recovery-suggestion="high-stress"/)
  }
})
