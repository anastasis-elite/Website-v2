import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const state = await importTs('lib/program/weekdayMusclePreferences.ts')
const { WEEKDAYS } = await importTs('lib/program/weekdayMuscleTypes.ts')
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const days = patch => Object.fromEntries(WEEKDAYS.map(day => [day, patch[day] || []]))
const choice = { mode: 'custom', days: days({ Monday: ['lats'], Tuesday: ['chest', 'biceps'], Wednesday: ['core'], Thursday: ['feet_ankles'], Friday: ['glutes', 'calves'] }) }
const input = (overrides = {}) => ({ expectedRevision: 0, operationId: id, choice, today: '2026-11-03', savedAt: '2026-11-03T12:00:00.000Z', ...overrides })

test('following Monday is strictly future across Monday, DST, month and year boundaries', () => {
  for (const [date, expected] of [['2026-11-02', '2026-11-09'], ['2026-11-03', '2026-11-09'], ['2026-11-01', '2026-11-02'], ['2028-02-29', '2028-03-06'], ['2026-12-31', '2027-01-04']]) assert.equal(state.nextWeekdayPreferenceMonday(date), expected)
  assert.equal(state.isPreferenceDate('2026-02-30'), false)
  assert.throws(() => state.nextWeekdayPreferenceMonday('2026-02-30'))
})
test('custom canonical groups retain chest plus biceps and core; incomplete or unknown selection is rejected', () => {
  assert.deepEqual(state.parseWeekdayMuscleChoice(choice), choice)
  assert.equal(state.parseWeekdayMuscleChoice({ mode: 'custom', days: { Monday: ['chest'] } }), null)
  assert.equal(state.parseWeekdayMuscleChoice({ mode: 'custom', days: days({}) }), null)
  assert.equal(state.parseWeekdayMuscleChoice({ mode: 'custom', days: days({ Monday: ['invented'] }) }), null)
  assert.equal(state.parseWeekdayMuscleChoice({ mode: 'custom', days: days({ Monday: ['chest', 'chest'] }) }), null)
  assert.equal(state.parseWeekdayMuscleChoice({ mode: 'program_default', owner: 'other' }), null)
})
test('unset, future custom, effective custom and next-week explicit reset remain distinct without reads mutating state', () => {
  const baseline = { kept: { history: true } }
  assert.equal(state.getWeekdayMusclePreferencesView(baseline, '2026-11-03', 'America/New_York').status, 'unset')
  const saved = state.mergeWeekdayMusclePreferences(baseline, input()).onboardingData
  const snapshot = JSON.stringify(saved)
  const pending = state.getWeekdayMusclePreferencesView(saved, '2026-11-08', 'America/New_York')
  assert.equal(pending.current, null); assert.equal(pending.pending.effectiveDate, '2026-11-09')
  const effective = state.getWeekdayMusclePreferencesView(saved, '2026-11-09', 'America/New_York')
  assert.equal(effective.status, 'saved'); assert.deepEqual(effective.current.choice, choice); assert.equal(effective.pending, null)
  assert.equal(JSON.stringify(saved), snapshot)
  const reset = state.mergeWeekdayMusclePreferences(saved, input({ expectedRevision: 1, operationId: id2, choice: { mode: 'program_default' }, today: '2026-11-09' })).onboardingData
  const resetView = state.getWeekdayMusclePreferencesView(reset, '2026-11-09', 'America/New_York')
  assert.deepEqual(resetView.current.choice, choice); assert.equal(resetView.pending.effectiveDate, '2026-11-16')
  assert.equal(resetView.pending.choice.mode, 'program_default'); assert.deepEqual(reset.kept, baseline.kept)
})
test('repeated operation is identical while changed payload, stale revision and malformed saved state cannot clobber data', () => {
  const saved = state.mergeWeekdayMusclePreferences({ unrelated: 'preserved' }, input()).onboardingData
  const replay = state.mergeWeekdayMusclePreferences(saved, input())
  assert.equal(replay.replayed, true); assert.equal(replay.onboardingData, saved)
  for (const changed of [input({ choice: { mode: 'program_default' } }), input({ expectedRevision: 1 }), input({ operationId: id2 }), input({ today: '2026-11-04' })]) assert.throws(() => state.mergeWeekdayMusclePreferences(saved, changed), state.WeekdayMusclePreferenceConflict)
  assert.equal(state.getWeekdayMusclePreferencesView({ weekdayMusclePreferences: null }, '2026-11-03', 'Etc/UTC').status, 'invalid')
  assert.throws(() => state.mergeWeekdayMusclePreferences({ weekdayMusclePreferences: {} }, input()), state.WeekdayMusclePreferenceConflict)
})
