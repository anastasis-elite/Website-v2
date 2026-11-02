import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { calculateTodayNutritionPacing, recordedHistoryMacros, recentZeroMacroReminder } = await importTs('lib/nutrition/todayPacing.ts')
const { runNutritionEngine, getExpectedMacroTargetsByBlock } = await importTs('lib/dashboard/logic/engines.ts')
const client = { timezone: 'America/New_York', wake_time: '05:00', bed_time: '21:00' }
const pace = (time, changes = {}) => calculateTodayNutritionPacing({ client, target: 2000, consumed: 1000,
  hasLoggedIntake: true, now: new Date(`2026-11-02T${time}-05:00`), ...changes })

test('Today calorie pacing is cumulative from saved wake to bedtime across all day sections', () => {
  for (const [time, consumed, expected] of [['09:00:00', 500, 25], ['13:00:00', 1000, 50], ['17:00:00', 1500, 75]]) {
    const result = pace(time, { consumed })
    assert.equal(result.expectedPercent, expected)
    assert.equal(result.consumedPercent, expected)
    assert.equal(result.state, 'on_pace')
    assert.equal(result.nextRefreshAt, new Date(`2026-11-02T${time}.001-05:00`).toISOString())
  }
})

test('ahead intake becomes behind only at the calculated crossing boundary, with no periodic refresh', () => {
  const ahead = pace('08:00:00')
  assert.equal(ahead.state, 'on_pace')
  assert.equal(ahead.nextRefreshAt, '2026-11-02T18:00:00.001Z')
  assert.equal(pace('13:00:00').state, 'on_pace')
  const after = calculateTodayNutritionPacing({ client, target: 2000, consumed: 1000, hasLoggedIntake: true, now: new Date(ahead.nextRefreshAt) })
  assert.equal(after.state, 'behind')
  assert.equal(after.nextRefreshAt, '2026-11-03T02:00:00.000Z')
})

test('missing logs, invalid target, invalid clocks and unavailable records remain neutral rather than complete or a deficit', () => {
  for (const target of [0, -1, NaN, Infinity]) assert.equal(pace('13:00:00', { target }).state, 'neutral')
  for (const schedule of [{ wake_time: null }, { bed_time: '' }, { wake_time: '25:00' }, { bed_time: '21:61' }, { bed_time: '05:00' }]) {
    assert.equal(pace('13:00:00', { client: { ...client, ...schedule }, consumed: 2000 }).reason, 'missing_schedule')
  }
  assert.equal(pace('13:00:00', { hasLoggedIntake: false, consumed: 0 }).reason, 'unlogged')
  assert.equal(pace('13:00:00', { consumed: -1 }).reason, 'invalid_consumed')
  assert.equal(pace('13:00:00', { available: false }).reason, 'unavailable')
  assert.equal(pace('13:00:00', { consumed: 0 }).state, 'behind', 'Explicit zero intake differs from an unlogged day.')
  assert.match(pace('13:00:00', { consumed: 0 }).prompt, /logs|Log what you’ve had/)
})

test('full calorie target stops reminders without requiring any macro and sleep never produces a deficit', () => {
  assert.equal(pace('13:00:00', { consumed: 2000 }).state, 'complete')
  assert.equal(pace('13:00:00', { consumed: 2400 }).state, 'complete')
  for (const time of ['04:00:00', '21:00:00', '23:00:00']) {
    const result = pace(time, { consumed: 0, hasLoggedIntake: false })
    assert.equal(result.state, 'sleep')
    assert.equal(result.expectedPercent, null)
    assert.doesNotMatch(result.prompt, /behind|deficit|eat|finish/i)
  }
  assert.equal(pace('04:00:00').nextRefreshAt, '2026-11-02T10:00:00.000Z')
  assert.equal(pace('23:00:00').nextRefreshAt, '2026-11-03T10:00:00.000Z')
})

test('overnight waking windows stay neutral across midnight rather than comparing a reset calendar-day intake', () => {
  const nightClient = { ...client, wake_time: '19:00', bed_time: '07:00' }
  for (const time of ['23:00:00', '01:00:00', '06:59:59']) {
    const result = pace(time, { client: nightClient, consumed: 0 })
    assert.equal(result.state, 'neutral')
    assert.equal(result.reason, 'overnight_unavailable')
    assert.equal(result.expectedPercent, null)
    assert.doesNotMatch(result.prompt, /behind|deficit|eat more/i)
  }
  assert.equal(pace('12:00:00', { client: nightClient, consumed: 0 }).state, 'sleep')
})

test('member timezone and DST use actual elapsed wake-window instants for the refresh boundary', () => {
  const spring = { ...client, wake_time: '00:00', bed_time: '08:00' }
  const result = calculateTodayNutritionPacing({ client: spring, target: 3500, consumed: 1500, hasLoggedIntake: true,
    now: new Date('2026-03-08T04:00:00-04:00') })
  assert.equal(result.state, 'on_pace')
  assert.ok(Math.abs(result.expectedPercent - 3 / 7 * 100) < 1e-9)
  assert.equal(result.nextRefreshAt, '2026-03-08T08:00:00.001Z')
  assert.equal(pace('13:00:00', { client: { ...client, timezone: 'America/Los_Angeles' } }).expectedPercent, 31.25)
})

const history = values => ['2026-10-30', '2026-10-31', '2026-11-01'].map((date, index) => ({ date, mealCount: 1,
  nutritionLogId: `synthetic-${index}`, recordedMacros: { protein: 0, carbs: 20, fats: 0, ...values } }))

test('macro note requires all three completed consecutive local logged days and exact recorded zeros', () => {
  const rows = history()
  const result = recentZeroMacroReminder('2026-11-02', rows)
  assert.deepEqual(result.macros, ['protein', 'fats'])
  assert.equal(result.startDate, '2026-10-30')
  assert.equal(result.endDate, '2026-11-01')
  assert.match(result.message, /recent logs show no recorded protein and fats/)
  assert.doesNotMatch(result.message, /deficien|extra calories|must|diagnos/i)
  assert.equal(recentZeroMacroReminder('2026-11-02', rows.slice(1)), null)
  for (const missing of [{ mealCount: 0 }, { nutritionLogId: null }, { recordedMacros: undefined }]) {
    const incomplete = history();incomplete[1] = { ...incomplete[1], ...missing }
    assert.equal(recentZeroMacroReminder('2026-11-02', incomplete), null)
  }
  const gap = history();gap[1].date = '2026-10-29'
  assert.equal(recentZeroMacroReminder('2026-11-02', gap), null)
  assert.equal(recentZeroMacroReminder('2026-11-02', rows, false), null)
  assert.equal(recentZeroMacroReminder('2026-11-02', history({ protein: 0.001, carbs: 10, fats: 0.001 })), null)
})

test('missing macro amounts stay unknown and positive fractional values never become zero through rounding', () => {
  assert.deepEqual(recordedHistoryMacros([], [{ protein_g: 0, carbs_g: 20, fat_g: 0.001 }]), { protein: 0, carbs: 20, fats: 0.001 })
  assert.deepEqual(recordedHistoryMacros([], [{ protein_g: null, carbs_g: 0, fat_g: 0 }]), { protein: null, carbs: 0, fats: 0 })
  assert.deepEqual(recordedHistoryMacros([], []), { protein: null, carbs: null, fats: null })
  assert.equal(recordedHistoryMacros([{ protein_eaten_g: 0, carbs_eaten_g: 5, fat_eaten_g: 0 }], [{ protein_g: 0, carbs_g: 6, fat_g: 0 }]).carbs, 11)
})

test('nutrition engine adds presentation pacing and a separate macro note without changing targets, blocks or recorded completion', () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-02T18:00:00Z') })
  const inputs = { date: '2026-11-02', client, program: 'ignite', dailyPlan: { calories: 2000,
    dailyTargets: { protein: 100, carbs: 200, fats: 60 }, dailyRemaining: { calories: 0, protein: 100, carbs: 200, fats: 60 } },
    nutritionLogs: [{ id: 'today', log_date: '2026-11-02' }], nutritionTotals: [],
    macroEntries: [{ nutrition_log_id: 'today', calories: 2000, protein_g: 0, carbs_g: 0, fat_g: 0, day_block: 'morning' }],
    mealEntries: [], recentFuelingHistory: history(), nutritionHistoryAvailable: true }
  try {
    const before = structuredClone(inputs), result = runNutritionEngine(inputs)
    assert.equal(result.pacing.state, 'complete')
    assert.equal(result.dataStatus, 'known')
    assert.equal(result.protein.percent, 0)
    assert.deepEqual(result.macroReminder.macros, ['protein', 'fats'])
    assert.deepEqual(result.blockTargets, getExpectedMacroTargetsByBlock({ calories: 2000, protein: 100, carbs: 200, fats: 60 }))
    assert.deepEqual(inputs, before)
  } finally { mock.timers.reset() }
})

after(() => mock.timers.reset())
