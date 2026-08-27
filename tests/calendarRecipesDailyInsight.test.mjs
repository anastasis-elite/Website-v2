import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

async function importTypescriptModule(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

function loadCommonJsTypescript(path, localModules = {}) {
  const source = readFileSync(path, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  const require = (id) => localModules[id] || {}
  vm.runInNewContext(compiled, { exports: module.exports, module, require })
  return module.exports
}

const calendar = await importTypescriptModule('lib/calendar/view.ts')
const resilience = loadCommonJsTypescript('lib/dashboard/resilienceEngine.ts')
const insight = loadCommonJsTypescript('lib/dashboard/dailyInsight.ts', {
  './resilienceEngine': resilience,
})
const recipes = await importTypescriptModule('lib/nutrition/recipes/catalog.ts')

function scheduleEvent(overrides = {}) {
  return {
    id: overrides.id || 'event-1',
    user_id: 'user-a',
    client_id: 'client-a',
    title: overrides.title || 'Workout',
    description: null,
    event_type: overrides.event_type || 'workout',
    source: overrides.source || 'program',
    start_at: overrides.start_at || '2026-08-24T15:00:00.000Z',
    end_at: overrides.end_at || '2026-08-24T15:45:00.000Z',
    timezone: 'America/Chicago',
    all_day: false,
    status: overrides.status || 'scheduled',
    completed_at: null,
    flexibility_type: overrides.flexibility_type || 'flexible',
    priority: overrides.priority || 'medium',
    required: Boolean(overrides.required),
    movable: true,
    approval_required: false,
    earliest_start_at: null,
    latest_end_at: null,
    preferred_time: null,
    estimated_duration_minutes: 45,
    external_provider_name: null,
    external_contact_type: null,
    external_contact_value: null,
    external_event_id: overrides.external_event_id || null,
    external_calendar_source: overrides.external_calendar_source || null,
    reschedule_allowed: false,
    reschedule_requires_approval: true,
    last_reschedule_requested_at: null,
    delegation_status: null,
    delegation_notes: null,
    adaptive_reason: null,
    adjusted_start_at: null,
    adjusted_end_at: null,
    adjusted_duration_minutes: null,
    virtual: false,
    action_route: null,
  }
}

function dailySchedule(overrides = {}) {
  return {
    date: '2026-08-24',
    timezone: 'America/Chicago',
    now: '2026-08-24T13:00:00.000Z',
    events: overrides.events || [],
    completedEvents: overrides.completedEvents || [],
    upcomingEvents: overrides.upcomingEvents || [],
    overdueEvents: [],
    fixedEvents: [],
    flexibleEvents: [],
    approvalRequiredEvents: [],
    openWindows: overrides.openWindows || [],
    adjustments: [],
    nextEvent: null,
    nextActionableEvent: null,
    nextAction: {
      id: 'next',
      title: 'Next',
      category: overrides.category || 'workout',
      start_at: null,
      urgency: 'soon',
      reason: 'Next action.',
      action_route: null,
      overdue: false,
      automatically_adjusted: false,
      can_complete: false,
      can_defer: false,
      short_reason: 'Next action.',
    },
  }
}

function logic(overrides = {}) {
  return {
    nutrition: {
      protein: { remaining: overrides.proteinRemaining ?? 20 },
      carbs: { remaining: 20 },
      fats: { remaining: 10 },
    },
    recoveryCheck: {
      energy: overrides.energy ?? null,
      stress: overrides.stress ?? null,
      soreness: overrides.soreness ?? null,
      sleepQuality: overrides.sleepQuality ?? null,
    },
    recoveryStatus: {
      status: overrides.recoveryStatus ?? 'normal_training_day',
    },
    fuelReadiness: {
      status: overrides.fuelStatus ?? 'well_fueled',
    },
    hydration: {
      status: overrides.hydrationStatus ?? 'ready',
      percent: overrides.hydrationPercent ?? 90,
    },
    flameState: {
      requirements: {
        missedDayCount: overrides.missedDayCount ?? 0,
        requiredItems: { recovery: Boolean(overrides.recoveryRequired) },
        completedItems: { recovery: false },
      },
    },
    workoutDecision: {
      completed: Boolean(overrides.workoutComplete),
      canTrain: overrides.canTrain ?? true,
      adjustmentLevel: overrides.workoutAdjustmentLevel ?? 'level_0_full_plan',
      allowLoadProgression: Boolean(overrides.allowLoadProgression),
      allowEnduranceProgression: Boolean(overrides.allowEnduranceProgression),
    },
    workout: { completed: Boolean(overrides.workoutComplete) },
    sleep: {
      hours: overrides.sleepHours ?? null,
      quality: overrides.sleepQuality ?? null,
    },
    symptoms: {
      severity: overrides.symptomSeverity ?? 'none',
      redFlag: Boolean(overrides.symptomRedFlag),
    },
    passiveHealth: {
      sleepDurationHours: overrides.passiveSleepHours ?? null,
      steps: overrides.steps ?? null,
      activeEnergy: overrides.activeEnergy ?? null,
      workoutMinutes: overrides.workoutMinutes ?? null,
      hrv: overrides.hrv ?? null,
      restingHeartRate: overrides.restingHeartRate ?? null,
      respiratoryRate: null,
      bodyTemperature: null,
      weight: null,
      bodyFat: null,
      sources: [],
    },
    execution: {
      workoutComplete: Boolean(overrides.workoutComplete),
    },
  }
}

test('month view model renders a traditional six-week calendar grid with indicators', () => {
  const items = calendar.buildCalendarItems([
    scheduleEvent({ id: 'external', title: 'Meeting', source: 'external_calendar', external_event_id: 'g-1' }),
  ], [
    { start_at: '2026-08-24T18:00:00.000Z', end_at: '2026-08-24T18:45:00.000Z', minutes: 45 },
  ])

  const grid = calendar.buildMonthGrid({ selectedDate: '2026-08-24', items, today: '2026-08-24' })

  assert.equal(grid.length, 42)
  const selected = grid.find((cell) => cell.date === '2026-08-24')
  assert.equal(selected.isSelected, true)
  assert.equal(selected.items.length, 2)
  assert.equal(selected.items.some((item) => item.source === 'external_calendar'), true)
  assert.equal(selected.items.some((item) => item.source === 'suggestion'), true)
})

test('date selection contract supports month and week drilldown into day view', () => {
  assert.equal(calendar.addDays('2026-08-24', 3), '2026-08-27')
  assert.equal(calendar.addMonths('2026-08-24', 1), '2026-09-24')

  const week = calendar.buildWeekDays('2026-08-27', [])
  assert.equal(week.length, 7)
  assert.deepEqual(week.map((day) => day.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  assert.equal(week[0].date, '2026-08-24')
})

test('recipe catalog retrieves reusable recipes and scales macros by serving count', () => {
  const catalog = recipes.getSeedRecipes()
  assert.equal(catalog.length >= 4, true)
  assert.equal(catalog.some((recipe) => recipe.meal_type === 'breakfast'), true)
  assert.equal(catalog.some((recipe) => recipe.meal_type === 'snack'), true)

  const bowl = catalog.find((recipe) => recipe.id === 'chicken-rice-lunch-bowl')
  const scaled = recipes.scaleRecipe(bowl, 2)
  assert.equal(scaled.protein_g, bowl.protein_g * 2)
  assert.equal(scaled.calories, bowl.calories * 2)
})

test('daily insight uses available context and does not fabricate missing inputs', () => {
  const fallback = insight.buildDailyInsight({
    tier: 'ember',
    logic: logic(),
    schedule: dailySchedule({ category: 'none' }),
  })
  assert.equal(fallback.category, 'general')
  assert.match(fallback.reason, /Fallback/)

  const recovery = insight.buildDailyInsight({
    tier: 'phoenix',
    logic: logic({ energy: 2 }),
    schedule: dailySchedule(),
  })
  assert.equal(recovery.category, 'recovery')
  assert.equal(recovery.action.target, '/dashboard/recovery')
})

test('daily insight selects schedule, workout, nutrition, and tier-aware CTAs', () => {
  const packedEvents = Array.from({ length: 8 }, (_, index) => scheduleEvent({
    id: `event-${index}`,
    start_at: `2026-08-24T${String(12 + index).padStart(2, '0')}:00:00.000Z`,
    end_at: `2026-08-24T${String(12 + index).padStart(2, '0')}:30:00.000Z`,
  }))
  const packed = insight.buildDailyInsight({
    tier: 'ignite',
    logic: logic(),
    schedule: dailySchedule({ events: packedEvents, openWindows: [{ start_at: '2026-08-24T20:00:00.000Z', end_at: '2026-08-24T20:45:00.000Z', minutes: 45 }] }),
  })
  assert.equal(packed.category, 'schedule')
  assert.equal(packed.action.type, 'view_day')

  const workout = insight.buildDailyInsight({
    tier: 'phoenix',
    logic: logic(),
    schedule: dailySchedule({ category: 'workout', openWindows: [{ start_at: '2026-08-24T15:00:00.000Z', end_at: '2026-08-24T15:45:00.000Z', minutes: 45 }] }),
  })
  assert.equal(workout.category, 'workout')
  assert.equal(workout.action.target, '/dashboard/program/phoenix/workout')

  const nutrition = insight.buildDailyInsight({
    tier: 'ember',
    logic: logic({ proteinRemaining: 45 }),
    schedule: dailySchedule({ category: 'meal' }),
  })
  assert.equal(nutrition.category, 'nutrition')
  assert.equal(nutrition.action.label, 'Add macros')
})

test('daily insight consumes resilience evaluation before task availability', () => {
  const overreaching = insight.buildDailyInsight({
    tier: 'phoenix',
    logic: logic({
      sleepHours: 5,
      hrv: 28,
      soreness: 8,
      workoutMinutes: 85,
      recoveryStatus: 'modify_workout',
    }),
    schedule: dailySchedule({ category: 'workout', openWindows: [{ start_at: '2026-08-24T15:00:00.000Z', end_at: '2026-08-24T16:00:00.000Z', minutes: 60 }] }),
  })
  assert.equal(overreaching.category, 'recovery')
  assert.doesNotMatch(overreaching.message, /Starting is the highest-value/)

  const ready = insight.buildDailyInsight({
    tier: 'phoenix',
    logic: logic({
      sleepHours: 8,
      hrv: 60,
      soreness: 2,
      energy: 8,
      steps: 1200,
      workoutMinutes: 0,
    }),
    schedule: dailySchedule({ category: 'workout', openWindows: [{ start_at: '2026-08-24T15:00:00.000Z', end_at: '2026-08-24T16:00:00.000Z', minutes: 60 }] }),
  })
  assert.equal(ready.category, 'workout')
  assert.match(ready.message, /ready for more stimulus/)

  const missed = insight.buildDailyInsight({
    tier: 'ignite',
    logic: logic({
      sleepHours: 7.5,
      hrv: 55,
      soreness: 2,
      energy: 7,
      missedDayCount: 1,
    }),
    schedule: dailySchedule({ category: 'workout', openWindows: [{ start_at: '2026-08-24T15:00:00.000Z', end_at: '2026-08-24T16:00:00.000Z', minutes: 60 }] }),
  })
  assert.equal(missed.category, 'consistency')
  assert.match(missed.message, /does not need to be compensated/)
})
