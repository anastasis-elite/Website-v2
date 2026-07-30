import type { ConstitutionRule } from './constitution.types'

export const recoveryRules: ConstitutionRule[] = [
  {
    id: 'RECOVERY-001',
    domain: 'recovery',
    title: 'High soreness requires intervention',
    description:
      'A user with soreness greater than 5 must trigger an additional soreness assessment or intervention flow.',
    severity: 'high',
    enabled: true,
    provisional: true,
    inputs: ['persona.soreness', 'actualOutcome.triggeredInterventions'],
    expectedBehavior: 'Soreness above 5 triggers soreness-assessment or recovery-intervention.',
    rationale: 'High soreness should not be ignored before training guidance is shown.',
    evaluate({ persona, actualOutcome }) {
      if (persona.soreness <= 5) {
        return { passed: true, expected: 'No high-soreness intervention required', actual: persona.soreness }
      }

      const interventions = actualOutcome?.triggeredInterventions ?? []
      const passed =
        interventions.includes('soreness-assessment') || interventions.includes('recovery-intervention')

      return passed
        ? { passed: true, expected: ['soreness-assessment', 'recovery-intervention'], actual: interventions }
        : {
            passed: false,
            expected: 'soreness-assessment or recovery-intervention',
            actual: interventions,
            message: 'High soreness did not trigger a soreness assessment or recovery intervention.',
          }
    },
  },
  {
    id: 'RECOVERY-002',
    domain: 'recovery',
    title: 'Compensation tracked separately from target recovery',
    description:
      'Compensation information must be considered separately from target-muscle recovery.',
    severity: 'medium',
    enabled: true,
    provisional: true,
    inputs: ['persona.muscleRecovery', 'persona.compensatoryMuscles', 'actualOutcome.recoveryModel'],
    expectedBehavior:
      'The outcome exposes separate targetMuscleRecovery and compensatoryMusclesConsidered fields.',
    rationale: 'Compensatory loading is a different signal from target muscle readiness.',
    evaluate({ actualOutcome }) {
      const model = actualOutcome?.recoveryModel
      const passed = Boolean(model?.targetMuscleRecovery) && Array.isArray(model?.compensatoryMusclesConsidered)

      return passed
        ? { passed: true, expected: 'Separate recovery model fields', actual: model }
        : {
            passed: false,
            expected: {
              targetMuscleRecovery: 'present',
              compensatoryMusclesConsidered: 'array',
            },
            actual: model,
            message: 'Recovery model did not separate target recovery from compensation information.',
          }
    },
  },
]
