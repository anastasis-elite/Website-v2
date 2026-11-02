import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const progressModule = await importTs('lib/dashboard/logic/streakRequirementProgress.ts')
const { getStreakRequirementProgress } = progressModule
const { getStreakRequirementDestinations } = await importTs('lib/dashboard/logic/streakRequirementDestinations.ts')
const { runFlameExecutionEngine } = await importTs('lib/dashboard/logic/engines.ts')
const date = '2026-11-02', now = `${date}T18:00:00Z`, timezone = 'America/New_York'
const requirements = (options = {}) => runFlameExecutionEngine({
  inputs: { date, program: options.tier || 'ignite', missedDayCount: options.missed || 0,
    dailyPlan: { workoutCompleted: Boolean(options.workout) },
    todayRecovery: { ...(options.checkIn ? { check_in_completed_at: now } : {}), ...(options.sleep ? { sleep_hours: 8 } : {}) },
    todayRecoveryActivities: options.recovery ? [{ activity_type: 'Meditation' }] : [],
    phoenixTaskIds: options.tasks || [], executionHistory: [] },
  hydration: { percent: options.water ?? 0 }, nutrition: { dataStatus: options.food ? 'known' : 'needs_input' },
  capacity: { status: options.capacity || 'high_capacity' },
  workoutDecision: { assignedWorkout: { workout_state: options.rest ? 'rest' : 'training' } },
})
const summary = (flame, expectedDate = date, context = {}) => getStreakRequirementProgress(flame, expectedDate, { now, timezone, ...context })

const require = createRequire(import.meta.url)
const module = { exports: {} }
const code = ts.transpileModule(readFileSync('components/program-dashboard/StreakRequirementsCard.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
runInNewContext(code, { module, exports: module.exports, require(name) {
  if (name === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }
  if (name === '@/lib/dashboard/logic/streakRequirementProgress') return progressModule
  return require(name)
} })
const Card = module.exports.default
const render = (flame, props = {}) => renderToStaticMarkup(React.createElement(Card, { flame, expectedDate: date, now, timezone, ...props }))

test('required-only progress reads the actual tier engine flags rather than activity counts', () => {
  for (const [tier, count] of [['ember', 4], ['ignite', 5], ['phoenix', 6]]) {
    const flame = requirements({ tier }), model = summary(flame, date, { programTier: tier })
    assert.equal(model.available, true)
    assert.deepEqual([model.completedCount, model.requiredCount, model.secured], [0, count, false])
    assert.equal(model.entries.length, count)
    assert.ok(model.entries.every(entry => flame.requirements.requiredItems[entry.id]))
    assert.equal(model.entries.some(entry => entry.id === 'sleep'), false)
  }
})

test('the existing hydration80 and completed-workout OR recorded-recovery engine evidence drives progress', () => {
  const before = requirements({ water: 79.9 }), atGoal = requirements({ water: 80 })
  assert.equal(summary(before).entries.find(entry => entry.id === 'hydration').complete, false)
  assert.equal(summary(atGoal).entries.find(entry => entry.id === 'hydration').complete, true)
  for (const options of [{ workout: true }, { recovery: true }]) {
    const model = summary(requirements(options)), item = model.entries.find(entry => entry.id === 'workoutOrMovement')
    assert.equal(item.complete, true)
    assert.match(item.description, /Either one counts/)
    assert.equal(item.destination.href, '/dashboard/program/ignite/workout')
    assert.equal(item.alternativeDestinations[0].href, '/dashboard/recovery')
  }
})

test('rest, low-capacity and missed-day rules retain exactly the existing engine requirements', () => {
  const rested = summary(requirements({ rest: true }))
  assert.equal(rested.entries.some(entry => entry.id === 'workoutOrMovement'), false)
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const low = summary(requirements({ tier, capacity: 'low_capacity' }))
    assert.deepEqual(low.entries.map(entry => entry.id), ['dailyCheckIn', 'recovery'])
    const reduced = summary(requirements({ tier, missed: 4 }))
    assert.deepEqual(reduced.entries.map(entry => entry.id), tier === 'phoenix' ? ['dailyCheckIn', 'recovery'] : ['dailyCheckIn'])
  }
})

test('optional score and optional completed items never replace true requirements or a secured flag', () => {
  const flame = requirements({ tier: 'ember', checkIn: true, sleep: true, tasks: ['morning-complete'] })
  flame.requirements.completionScore = 100;flame.dailyScore = 100
  const model = summary(flame)
  assert.deepEqual([model.completedCount, model.requiredCount, model.secured], [1, 4, false])
  assert.equal(model.entries.some(entry => entry.id === 'customTasks' || entry.id === 'sleep'), false)
  const complete = summary(requirements({ tier: 'phoenix', checkIn: true, food: true, water: 80, recovery: true, tasks: ['midday-complete'] }))
  assert.equal(complete.completedCount, complete.requiredCount)
  assert.equal(complete.secured, true)
})

test('missing, malformed, stale or inconsistent streak evidence remains neutral without fabricated counts', () => {
  const valid = requirements()
  const variants = [undefined, {}, { ...valid, requirements: undefined }, { ...valid, streakEligible: true },
    { ...valid, requirements: { ...valid.requirements, date: '2026-11-01' } },
    { ...valid, requirements: { ...valid.requirements, requiredItems: { ...valid.requirements.requiredItems, dailyCheckIn: false } } },
    { ...valid, requirements: { ...valid.requirements, completedItems: { ...valid.requirements.completedItems, nutrition: 'true' } } },
    { ...valid, requirements: { ...valid.requirements, requiredItems: { ...valid.requirements.requiredItems, futureUnknownRequirement: true } } },
  ]
  for (const variant of variants) {
    const model = summary(variant)
    assert.deepEqual([model.available, model.completedCount, model.requiredCount, model.secured], [false, null, null, false])
    assert.deepEqual(model.entries, [])
  }
  assert.equal(summary(valid, date, { programTier: 'phoenix' }).available, false)
  assert.equal(summary(valid, date, { now: 'not-time' }).available, false)
  assert.equal(summary(valid, date, { timezone: 'not/a-zone' }).available, false)
})

test('task requirement destinations reach existing current-local-day checklists instead of a removed Today dropdown', () => {
  for (const [instant, block] of [[`${date}T13:00:00Z`, 'morning'], [`${date}T18:00:00Z`, 'midday'], [`${date}T23:00:00Z`, 'evening']]) {
    const item = summary(requirements(), date, { now: instant }).entries.find(entry => entry.id === 'customTasks')
    assert.equal(item.destination.href, `/dashboard/day/${block}?date=${date}`)
  }
  for (const tier of ['ember', 'ignite', 'phoenix']) assert.equal(getStreakRequirementDestinations(tier).customTasks.href, '/dashboard/day/morning')
  assert.equal(existsSync('app/dashboard/day/[block]/page.tsx'), true)
  assert.match(readFileSync('app/dashboard/day/[block]/page.tsx', 'utf8'), /DayBlockCompletionForm/)
  assert.match(readFileSync('components/DayBlockCompletionForm.tsx', 'utf8'), /fetch\('\/api\/day-block\/complete'/)
  assert.equal(summary(requirements({ tasks: ['morning-complete'] })).entries.find(entry => entry.id === 'customTasks').complete, true)
})

test('reused requirement card shows exact outstanding/completed counts and valid alternative links without optional work', () => {
  const flame = requirements({ tier: 'ember', checkIn: true, sleep: true }), model = summary(flame)
  const html = render(flame, { progress: model })
  assert.match(html, /<strong>1 of 4<\/strong>/)
  assert.match(html, /Outstanding requirements/)
  assert.match(html, /Completed requirements/)
  assert.match(html, /Record at least 80% of your existing daily water target/)
  assert.match(html, /href="\/dashboard\/program\/ember\/workout"/)
  assert.match(html, /class="streak-requirement-alternative"/)
  assert.match(html, /aria-label="Water logged: Outstanding requirement\./)
  assert.match(html, /aria-label="Or record a recovery activity to meet/)
  assert.doesNotMatch(html, /data-requirement="sleep"|data-requirement="customTasks"|Optional|100%|streak is secured/)
  assert.equal((html.match(/data-requirement=/g) || []).length, model.requiredCount)
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/)
})

test('the card truthfully announces a secured streak and missing evidence has no fake zero or secured claim', () => {
  const secured = requirements({ tier: 'phoenix', checkIn: true, food: true, water: 80, recovery: true, tasks: ['evening-complete'] })
  const html = render(secured)
  assert.match(html, /<strong>6 of 6<\/strong>/)
  assert.match(html, /Today’s streak is secured/)
  assert.match(html, /No outstanding requirements/)
  const missing = render(undefined)
  assert.match(missing, /role="status">Today’s streak requirements could not be confirmed/)
  assert.doesNotMatch(missing, /0 of|streak is secured|data-requirement=/)
})
