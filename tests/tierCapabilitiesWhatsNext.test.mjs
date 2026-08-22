import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
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

const { getTierCapabilities, normalizeProgramTier } = await importTypescriptModule('lib/entitlements.ts')
const { buildWhatsNextState } = await importTypescriptModule('lib/dashboard/whatsNext.ts')

function logic(program = 'ignite') {
  return {
    program,
    nutrition: {
      protein: { remaining: 42 },
      carbs: { remaining: 55 },
      fats: { remaining: 18 },
      mealSuggestions: ['Build the next meal around what remains.'],
    },
    hydration: { prompt: 'Drink water.', remaining: 20, target: 100 },
    recoveryActions: [{ id: 'mobility', label: 'Mobility', duration: { minutes: 10 } }],
    recoveryStatus: { reasoning: 'Recovery inputs support the planned session.' },
    workout: { title: 'Lower Body Strength', durationMinutes: 45 },
    workoutDecision: {
      assignedWorkout: {
        exercises: [
          { name: 'Goblet squat' },
          { name: 'Romanian deadlift' },
          { name: 'Step-up' },
          { name: 'Carry' },
        ],
      },
    },
    flameState: {
      requirements: {
        requiredItems: { recovery: false },
        completedItems: { recovery: false },
      },
    },
    progress: { weight: null, weightChange: null, photoUrls: [], photosDue: true },
    assessments: { completionPercent: 20, monthlyDueCount: 0 },
    trends: [],
  }
}

function schedule(category, overrides = {}) {
  return {
    date: '2026-08-20',
    timezone: 'America/Chicago',
    now: '2026-08-20T17:00:00.000Z',
    events: [],
    completedEvents: [],
    upcomingEvents: [],
    overdueEvents: [],
    fixedEvents: [],
    flexibleEvents: [],
    approvalRequiredEvents: [],
    openWindows: [],
    nextEvent: null,
    nextActionableEvent: null,
    nextAction: {
      id: category,
      title: category,
      category,
      start_at: '2026-08-20T17:00:00.000Z',
      urgency: 'now',
      reason: 'Next action.',
      action_route: category === 'workout' ? '/dashboard/program/ignite/workout' : null,
      overdue: false,
      automatically_adjusted: false,
      can_complete: false,
      can_defer: false,
      short_reason: 'Next action.',
      ...overrides,
    },
  }
}

test('tier capabilities normalize casing and expose predictable matrix', () => {
  assert.equal(normalizeProgramTier('Phoenix'), 'phoenix')
  assert.equal(normalizeProgramTier('bad-value'), 'ignite')

  const ember = getTierCapabilities('EMBER')
  assert.equal(ember.nutritionMacroEntry, true)
  assert.equal(ember.nutritionMealLogging, false)
  assert.equal(ember.nutritionRecommendedMeal, false)
  assert.equal(ember.workoutDisplay, true)
  assert.equal(ember.recoveryBasic, true)
  assert.equal(ember.recoveryRecommendation, false)
  assert.equal(ember.assessmentPhotoUpload, true)
  assert.equal(ember.postureAssessment, false)

  const ignite = getTierCapabilities('ignite')
  assert.equal(ignite.nutritionMealLogging, true)
  assert.equal(ignite.recoveryRecommendation, true)
  assert.equal(ignite.recoveryDirectedNextAction, false)
  assert.equal(ignite.assessmentPhotoUpload, true)
  assert.equal(ignite.postureAssessment, true)

  const phoenix = getTierCapabilities('phoenix')
  assert.equal(phoenix.nutritionRecommendedMeal, true)
  assert.equal(phoenix.recoveryDirectedNextAction, true)
  assert.equal(phoenix.workoutDisplay, true)
  assert.equal(phoenix.assessmentPhotoUpload, true)
  assert.equal(phoenix.postureAssessment, true)
})

test('nutrition What’s Next respects Ember, Ignite, and Phoenix render modes', () => {
  const ember = buildWhatsNextState({
    tier: 'ember',
    capabilities: getTierCapabilities('ember'),
    logic: logic('ember'),
    schedule: schedule('meal'),
  })
  assert.equal(ember.title, 'Add Macros')
  assert.equal(ember.data.mode, 'macro_entry')
  assert.equal(ember.primaryAction.label, 'Add Macros')

  const ignite = buildWhatsNextState({
    tier: 'ignite',
    capabilities: getTierCapabilities('ignite'),
    logic: logic('ignite'),
    schedule: schedule('meal'),
  })
  assert.equal(ignite.title, 'Add Meal')
  assert.equal(ignite.data.mode, 'meal_logging')
  assert.equal(ignite.primaryAction.label, 'Add Meal')

  const phoenix = buildWhatsNextState({
    tier: 'phoenix',
    capabilities: getTierCapabilities('phoenix'),
    logic: logic('phoenix'),
    schedule: schedule('meal'),
    recipes: [{
      id: 'bowl',
      title: 'Chicken rice bowl',
      reason: 'Fits today.',
      macros: { protein: 42, carbs: 55, fats: 18, calories: 550 },
      prepMinutes: 12,
      ingredients: [],
      steps: [],
    }],
  })
  assert.equal(phoenix.title, 'Chicken rice bowl')
  assert.equal(phoenix.data.mode, 'recommended_meal')
  assert.equal(phoenix.primaryAction.label, 'Log Meal')
})

test('workout is visible for all tiers with a condensed exercise preview', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const state = buildWhatsNextState({
      tier,
      capabilities: getTierCapabilities(tier),
      logic: logic(tier),
      schedule: schedule('workout', { action_route: `/dashboard/program/${tier}/workout` }),
    })
    assert.equal(state.type, 'workout')
    assert.equal(state.title, 'Lower Body Strength')
    assert.equal(state.data.exerciseCount, 4)
    assert.deepEqual(state.data.exercises, ['Goblet squat', 'Romanian deadlift', 'Step-up'])
    assert.equal(state.primaryAction.label, 'Start Workout')
  }
})

test('recovery language and data mode differs by tier', () => {
  const ember = buildWhatsNextState({
    tier: 'ember',
    capabilities: getTierCapabilities('ember'),
    logic: logic('ember'),
    schedule: schedule('recovery'),
  })
  assert.equal(ember.title, 'Recovery')
  assert.equal(ember.data.mode, 'basic')

  const ignite = buildWhatsNextState({
    tier: 'ignite',
    capabilities: getTierCapabilities('ignite'),
    logic: logic('ignite'),
    schedule: schedule('recovery'),
  })
  assert.equal(ignite.title, 'Recommended: Mobility')
  assert.equal(ignite.data.mode, 'recommended')

  const phoenix = buildWhatsNextState({
    tier: 'phoenix',
    capabilities: getTierCapabilities('phoenix'),
    logic: logic('phoenix'),
    schedule: schedule('recovery'),
  })
  assert.equal(phoenix.title, 'Next: Mobility')
  assert.equal(phoenix.data.mode, 'directed')
})
