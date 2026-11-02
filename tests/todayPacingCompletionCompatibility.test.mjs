import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { workoutCompletion, workoutRecordComplete, summarizeActivityUnits, activityDose } = await importTs('lib/workout/activity.ts')
const { initialWorkoutLogs } = await importTs('lib/workout/session.ts')
const { createManualCardioExercise } = await importTs('lib/workout/manualCardio.ts')
const { buildTodayActivities, presentTodayActivities } = await importTs('lib/dashboard/todayActivities.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { calculateTodayNutritionPacing } = await importTs('lib/nutrition/todayPacing.ts')

const date = '2026-11-02', timezone = 'America/New_York'
const stamp = '2026-11-02T17:00:00Z'
const client = { timezone, wake_time: '05:00', bed_time: '21:00' }
const plan = [1, 2, 3].map(id => ({ id: `today-strength-${id}`, exercise: `Strength ${id}`, exercise_category: 'strength', sets: 3, reps: 8 }))
const set = (number, patch = {}) => ({ id: `set-${number}`, set_number: number, reps: 8, weight: 10, weight_unit: 'lb', completed_at: stamp, ...patch })
const logsFor = counts => initialWorkoutLogs(plan).map((log, index) => ({ ...log, completed: counts[index] === 3,
  set_logs: Array.from({ length: counts[index] }, (_, position) => set(position + 1)) }))
const schedule = (now = '2026-11-02T18:00:00Z') => ({ date, timezone, now, events: [], nextActionableEvent: null, dailyGuide: { date, activities: {} } })
const logic = () => ({ program: 'ignite', flameState: { requirements: { requiredItems: {
  dailyCheckIn: true, hydration: true, nutrition: true, workoutOrMovement: true, recovery: false,
} } }, hydration: { target: 80, consumed: 80, remaining: 0, status: 'ready' },
nutrition: { dataStatus: 'known', calories: { percent: 50 }, protein: { percent: 0 }, carbs: { percent: 0 }, fats: { percent: 0 } },
assessments: { dailyCompleted: true }, execution: { workoutComplete: false, nutritionLogged: true, recoveryComplete: true, workoutInProgress: true },
workout: { assigned: true }, workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Saved training is available.' },
capacityStatus: { status: 'moderate_capacity' }, symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing recovery guidance.' } })
const actions = (current, state) => { const next = buildDailyRecommendation(current, state);return [next.primary, ...next.supporting] }
const visible = (current, state) => presentTodayActivities(current, state)
const pace = (now, consumed = 1000) => calculateTodayNutritionPacing({ client, target: 2000, consumed, hasLoggedIntake: true, now: new Date(now) })

test('Today movement stays below the original nine-set half threshold and disappears at five confirmed sets', () => {
  const current = logic(), state = schedule()
  for (const [counts, completedSets, done] of [[[3, 1, 0], 4, false], [[3, 1, 1], 5, true]]) {
    const logs = logsFor(counts), before = structuredClone(logs)
    const summary = workoutCompletion(logs, plan)
    assert.deepEqual([summary.totalSets, summary.requiredSets, summary.completedSets, summary.completed], [9, 5, completedSets, done])
    current.execution.workoutComplete = workoutRecordComplete({ workout_source: 'recommended', planned_exercises: plan, exercise_logs: logs, completed: !done })
    const canonical = buildTodayActivities(current, state).activities.find(item => item.id === 'workout')
    assert.equal(canonical.status, done ? 'completed' : 'in_progress')
    assert.equal(visible(current, state).some(item => item.id === 'workout'), !done)
    assert.equal(actions(current, state).some(item => item.id === 'workout'), !done)
    assert.deepEqual(logs, before, 'Presentation does not mutate confirmed workout history.')
  }
})

test('duplicate snapshots, duplicate set slots, invalid actuals and skips cannot hide an unfinished Today workout', () => {
  const logs = logsFor([3, 1, 0])
  logs[0].set_logs.push(structuredClone(logs[0].set_logs[0]), set(4))
  logs[1].set_logs.push(set(2, { reps: 0 }), set(2, { skipped: true }), set(3, { status: 'skipped' }))
  logs[2].skipped = true
  logs.push(structuredClone(logs[0]))
  const counts = workoutCompletion(logs, plan)
  assert.deepEqual([counts.totalSets, counts.requiredSets, counts.completedSets, counts.completed], [9, 5, 4, false])
  const current = logic();current.execution.workoutComplete = workoutRecordComplete({ workout_source: 'recommended', planned_exercises: plan, exercise_logs: logs, completed: true })
  assert.equal(visible(current, schedule()).some(item => item.id === 'workout'), true)
})

test('editing desired or displayed set counts does not shrink the saved original prescribed denominator', () => {
  const original = structuredClone(plan), logs = logsFor([3, 1, 0]).map(log => ({ ...log, sets: 1, planned_sets: 1, user_intent: { desired_set_count: 1 } }))
  const saved = { workout_source: 'recommended', planned_exercises: original, exercise_logs: logs, completed: true }
  assert.equal(workoutRecordComplete(saved), false)
  assert.deepEqual([workoutCompletion(logs, original).totalSets, workoutCompletion(logs, original).requiredSets], [9, 5])
  const current = logic();current.execution.workoutComplete = workoutRecordComplete(saved)
  assert.equal(visible(current, schedule()).some(item => item.id === 'workout'), true)
  assert.deepEqual(original, plan)
})

test('minutes and seconds remain cardio duration rather than strength sets or a substitute for confirmed strength work', () => {
  const secondPlan = createManualCardioExercise('walking', 'seconds', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  const minutePlan = createManualCardioExercise('cycling', 'minutes', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  const seconds = { ...secondPlan, completed: true, skipped: false, actual_duration: 120, confirmed_at: stamp, set_logs: [] }
  const minutes = { ...minutePlan, completed: true, skipped: false, actual_duration: 2, confirmed_at: stamp, set_logs: [] }
  for (const log of [seconds, minutes]) {
    assert.equal(activityDose(log).kind, 'cardio')
    assert.equal(summarizeActivityUnits([log], true).sets, 0)
    assert.equal(summarizeActivityUnits([log], true).reps, 0)
    assert.equal(summarizeActivityUnits([log], true).minutes, 2)
    assert.deepEqual([workoutCompletion([log]).totalSets, workoutCompletion([log]).completedSets], [1, 1], 'A confirmed duration is one activity, regardless of minute/second amount.')
    const strength = workoutCompletion([...logsFor([3, 1, 0]), log], plan)
    assert.deepEqual([strength.totalSets, strength.completedSets, strength.completed], [9, 4, false])
  }
  assert.equal(activityDose({ exercise: 'Walking Lunge', exercise_category: 'strength', sets: 3 }).kind, 'strength')
})

test('existing calories-only pace hides at equality, returns at the exact crossing and drives the same next step', () => {
  const current = logic();current.execution.workoutComplete = true
  const equality = schedule('2026-11-02T18:00:00Z')
  current.nutrition.pacing = pace(equality.now)
  assert.equal(current.nutrition.pacing.state, 'on_pace')
  assert.equal(visible(current, equality).some(item => item.id === 'nutrition'), false)
  assert.equal(actions(current, equality).some(item => item.category === 'nutrition'), false)
  const after = schedule(current.nutrition.pacing.nextRefreshAt)
  current.nutrition.pacing = pace(after.now)
  assert.equal(current.nutrition.pacing.state, 'behind')
  assert.equal(visible(current, after).find(item => item.id === 'nutrition').status, 'in_progress')
  assert.equal(actions(current, after).some(item => item.category === 'nutrition'), true)
  assert.equal(buildTodayActivities(current, after).activities.find(item => item.id === 'nutrition').status, 'completed', 'Canonical logged progress is retained while presentation becomes due again.')
})

test('full existing daily calories suppress nutrition prompts even when every macro remains low', () => {
  const current = logic(), state = schedule('2026-11-02T22:00:00Z')
  current.execution.workoutComplete = true
  current.nutrition.calories.percent = 100
  current.nutrition.pacing = pace(state.now, 2000)
  assert.equal(current.nutrition.pacing.state, 'complete')
  assert.deepEqual([current.nutrition.protein.percent, current.nutrition.carbs.percent, current.nutrition.fats.percent], [0, 0, 0])
  assert.equal(visible(current, state).some(item => item.id === 'nutrition'), false)
  assert.equal(actions(current, state).some(item => item.category === 'nutrition'), false)
})
