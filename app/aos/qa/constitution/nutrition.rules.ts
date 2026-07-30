import type { ConstitutionRule } from './constitution.types'

export const nutritionRules: ConstitutionRule[] = [
  {
    id: 'NUTRITION-001',
    domain: 'nutrition',
    title: 'Hydration deficit receives visible guidance',
    description:
      'Provisional rule: a user reporting low hydration should receive a visible hydration guidance item.',
    severity: 'low',
    enabled: true,
    provisional: true,
    inputs: ['persona.hydration', 'actualOutcome.nutritionGuidance'],
    expectedBehavior: 'Low hydration adds hydration guidance without replacing core training guidance.',
    rationale: 'Hydration is a relevant readiness signal, but the final nutrition protocol is not encoded here.',
    evaluate({ persona, actualOutcome }) {
      if (persona.hydration !== 'low') {
        return { passed: true, expected: 'No low-hydration guidance required', actual: persona.hydration }
      }

      const guidance = actualOutcome?.nutritionGuidance ?? []
      const passed = guidance.some((item) => item.toLowerCase().includes('hydration'))

      return passed
        ? { passed: true, expected: 'Hydration guidance present', actual: guidance }
        : {
            passed: false,
            expected: 'Hydration guidance present',
            actual: guidance,
            message: 'Low hydration did not produce visible hydration guidance.',
          }
    },
  },
]
