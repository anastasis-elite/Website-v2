import type { ConstitutionRule } from './constitution.types'

export const experienceRules: ConstitutionRule[] = [
  {
    id: 'EXPERIENCE-001',
    domain: 'experience',
    title: 'No dead end after completed action',
    description: 'A user must not be left at a dead end after completing an action.',
    severity: 'critical',
    enabled: true,
    provisional: false,
    inputs: ['actualOutcome.completedAction', 'actualOutcome.nextActions'],
    expectedBehavior: 'Completed actions expose at least one available next action.',
    rationale: 'Dead ends block continuation and recovery from user uncertainty.',
    evaluate({ actualOutcome }) {
      if (!actualOutcome?.completedAction) {
        return { passed: true, expected: 'No completed action to evaluate', actual: actualOutcome?.completedAction }
      }

      const nextActions = actualOutcome.nextActions ?? []

      return nextActions.length > 0
        ? { passed: true, expected: 'At least one next action', actual: nextActions }
        : {
            passed: false,
            expected: 'At least one next action',
            actual: nextActions,
            message: 'Completed action ended without an available next action.',
          }
    },
  },
  {
    id: 'EXPERIENCE-002',
    domain: 'experience',
    title: 'Completed actions provide feedback',
    description: 'Completed actions should provide visible feedback.',
    severity: 'high',
    enabled: true,
    provisional: false,
    inputs: ['actualOutcome.completedAction', 'actualOutcome.visibleFeedback'],
    expectedBehavior: 'Completed actions return visible feedback.',
    rationale: 'Users need confirmation that their action succeeded.',
    evaluate({ actualOutcome }) {
      if (!actualOutcome?.completedAction) {
        return { passed: true, expected: 'No completed action to evaluate', actual: actualOutcome?.completedAction }
      }

      return actualOutcome.visibleFeedback
        ? { passed: true, expected: true, actual: actualOutcome.visibleFeedback }
        : {
            passed: false,
            expected: true,
            actual: actualOutcome.visibleFeedback,
            message: 'Completed action did not provide visible feedback.',
          }
    },
  },
]
