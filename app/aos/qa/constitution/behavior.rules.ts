import type { ConstitutionRule } from './constitution.types'

export const behaviorRules: ConstitutionRule[] = [
  {
    id: 'BEHAVIOR-001',
    domain: 'behavior',
    title: 'Adherence risk receives simplified next step',
    description:
      'Provisional rule: a low-adherence client should receive one simplified next action instead of a dense task list.',
    severity: 'medium',
    enabled: true,
    provisional: true,
    inputs: ['persona.adherenceHistory', 'actualOutcome.nextActions'],
    expectedBehavior: 'Low adherence produces exactly one primary next action.',
    rationale: 'Lowering activation energy is a product hypothesis requiring validation.',
    evaluate({ persona, actualOutcome }) {
      if (persona.adherenceHistory !== 'low') {
        return { passed: true, expected: 'No simplified adherence next step required', actual: persona.adherenceHistory }
      }

      const nextActions = actualOutcome?.nextActions ?? []

      return nextActions.length === 1
        ? { passed: true, expected: 1, actual: nextActions.length }
        : {
            passed: false,
            expected: 1,
            actual: nextActions.length,
            message: 'Low-adherence scenario did not receive exactly one primary next action.',
          }
    },
  },
]
