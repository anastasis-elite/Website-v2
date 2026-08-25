import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function importMuscleReadiness() {
  let source = readFileSync('lib/workout/muscleReadiness.ts', 'utf8')
  source = source
    .replace(
      "import { getTierCapabilities } from '@/lib/entitlements'\n",
      "function getTierCapabilities(tier) { return { recoveryRecommendation: String(tier).toLowerCase() !== 'ember' } }\n",
    )
    .replace(/^import type .*$/gm, '')

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const {
  MUSCLE_REGIONS,
  buildMuscleReadiness,
  getMuscleIdsForExercise,
  normalizeExerciseMuscles,
} = await importMuscleReadiness()

test('individual muscle ids are stable and more granular than broad regions', () => {
  const ids = MUSCLE_REGIONS.map((region) => region.id)

  assert.ok(ids.includes('left_anterior_deltoid'))
  assert.ok(ids.includes('right_quadriceps'))
  assert.ok(ids.includes('left_glute_max'))
  assert.ok(ids.includes('rectus_abdominis'))
  assert.equal(ids.includes('lower_body'), false)
})

test('exercise-to-muscle mapping uses existing fields and name inference fallback', () => {
  assert.deepEqual(
    normalizeExerciseMuscles({ primary_muscles: ['quads'], secondary_muscles: ['glutes'] }).sort(),
    ['glutes', 'quads'],
  )

  const inferred = getMuscleIdsForExercise({ exercise: 'Romanian deadlift', sets: 3, reps: 8 })

  assert.ok(inferred.includes('left_hamstrings'))
  assert.ok(inferred.includes('right_glute_max'))
  assert.ok(inferred.includes('erector_spinae_region'))
})

test('readiness renders unknown fallback and graded recovery states from current data', () => {
  const readiness = buildMuscleReadiness({
    tier: 'phoenix',
    todaysExercises: [{ exercise: 'Goblet squat', sets: 3, reps: 8 }],
    workoutHistory: [
      {
        workout_date: '2026-08-24T12:00:00.000Z',
        completed: true,
        exercise_logs: [{ exercise: 'Romanian deadlift', sets: 4, reps: 10 }],
      },
    ],
    recoverySignals: [
      {
        log_date: '2026-08-25',
        soreness_level: 8,
        soreness_regions: ['hamstrings'],
      },
    ],
    now: new Date('2026-08-25T12:00:00.000Z'),
  })

  const hamstrings = readiness.find((item) => item.muscleId === 'left_hamstrings')
  const quads = readiness.find((item) => item.muscleId === 'left_quadriceps')
  const biceps = readiness.find((item) => item.muscleId === 'left_biceps')

  assert.equal(hamstrings.state, 'rest')
  assert.equal(hamstrings.soreness, 8)
  assert.equal(quads.exercisesToday.includes('Goblet squat'), true)
  assert.equal(biceps.state, 'unknown')
})

test('ember receives tracking-level muscle data without detailed recovery intelligence', () => {
  const readiness = buildMuscleReadiness({
    tier: 'ember',
    todaysExercises: [{ exercise: 'Bench press', sets: 3, reps: 10 }],
    workoutHistory: [
      {
        workout_date: '2026-08-24T12:00:00.000Z',
        completed: true,
        exercise_logs: [{ exercise: 'Bench press', sets: 5, reps: 10 }],
      },
    ],
    recoverySignals: [],
    now: new Date('2026-08-25T12:00:00.000Z'),
  })

  const chest = readiness.find((item) => item.muscleId === 'left_pectoralis_major')

  assert.equal(chest.state, 'available')
  assert.equal(chest.lastTrainedAt, undefined)
  assert.equal(chest.recentTrainingLoad, undefined)
  assert.equal(chest.reasons[0], 'Included in today’s workout.')
})
