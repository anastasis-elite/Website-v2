import type { ConstitutionRule } from './constitution.types'

export const workoutRules: ConstitutionRule[] = [
  {
    id: 'WORKOUT-001',
    domain: 'workout',
    title: 'Standard training day exercise count',
    description:
      'Provisional rule: a standard training day should include 12 exercises plus a recovery component unless intentionally marked as recovery.',
    severity: 'medium',
    enabled: true,
    provisional: true,
    inputs: ['scenario.trainingDayType', 'actualOutcome.recommendedExerciseCount', 'actualOutcome.includesRecoveryComponent'],
    expectedBehavior:
      'Standard training days target exactly 12 exercises and include a recovery component.',
    rationale: 'This encodes the current QA expectation while final program logic is still being validated.',
    evaluate({ scenario, actualOutcome }) {
      if (scenario.trainingDayType === 'recovery') {
        return { passed: true, expected: 'Recovery day exempt from 12-exercise target', actual: scenario.trainingDayType }
      }

      const actual = {
        recommendedExerciseCount: actualOutcome?.recommendedExerciseCount,
        includesRecoveryComponent: actualOutcome?.includesRecoveryComponent,
      }
      const passed = actual.recommendedExerciseCount === 12 && actual.includesRecoveryComponent === true

      return passed
        ? { passed: true, expected: { recommendedExerciseCount: 12, includesRecoveryComponent: true }, actual }
        : {
            passed: false,
            expected: { recommendedExerciseCount: 12, includesRecoveryComponent: true },
            actual,
            message: 'Standard training day did not return the provisional exercise target and recovery component.',
          }
    },
  },
  {
    id: 'WORKOUT-002',
    domain: 'workout',
    title: 'Exercise recommendations respect equipment',
    description:
      'Recommended exercises must not require equipment that is unavailable to the synthetic client.',
    severity: 'high',
    enabled: true,
    provisional: false,
    inputs: ['persona.availableEquipment', 'actualOutcome.requiredEquipment'],
    expectedBehavior: 'Required equipment is a subset of the persona available equipment.',
    rationale: 'Unavailable equipment makes a recommendation unusable.',
    evaluate({ persona, actualOutcome }) {
      const available = new Set(persona.availableEquipment)
      const required = actualOutcome?.requiredEquipment ?? []
      const unavailable = required.filter((equipment) => !available.has(equipment))

      return unavailable.length === 0
        ? { passed: true, expected: Array.from(available), actual: required }
        : {
            passed: false,
            expected: Array.from(available),
            actual: required,
            message: `Recommendation requires unavailable equipment: ${unavailable.join(', ')}.`,
          }
    },
  },
]
