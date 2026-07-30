import type {
  PlatformActionResult,
  PlatformAdapter,
  PlatformOutcome,
  PlatformRouteCheck,
} from './adapter.types'
import type { Equipment, SyntheticPersona, SyntheticScenario } from '../personas/persona.types'

export class MockPlatformAdapter implements PlatformAdapter {
  name = 'mock-platform-adapter'

  capabilities = {
    functionalChecks: true,
    logicOutcomes: true,
    experienceEvidence: true,
  }

  async checkRoutes(routes: string[]): Promise<PlatformRouteCheck[]> {
    return routes.map((route) => ({
      route,
      available: !route.includes('missing'),
      status: route.includes('missing') ? 404 : 200,
      message: route.includes('missing') ? 'Mock route intentionally unavailable.' : 'Mock route available.',
    }))
  }

  async performAction(
    action: string,
    scenario: SyntheticScenario,
    persona: SyntheticPersona,
  ): Promise<PlatformActionResult> {
    const invalidTransition = action === 'complete-workout' && scenario.requestedAction === 'complete-check-in'

    return {
      action,
      completed: !invalidTransition,
      responseShapeValid: true,
      persisted: persona.id.includes('persistence-failure') ? false : true,
      message: invalidTransition ? 'Mock invalid state transition.' : 'Mock action completed.',
    }
  }

  async getScenarioOutcome(
    scenario: SyntheticScenario,
    persona: SyntheticPersona,
  ): Promise<PlatformOutcome> {
    const isRecovery = scenario.trainingDayType === 'recovery'
    const highSoreness = persona.soreness > 5
    const lowAdherence = persona.adherenceHistory === 'low'
    const nextActions = lowAdherence ? ['Review simplified next action'] : ['Start session', 'Log readiness']

    return {
      scenarioId: scenario.id,
      recommendedExerciseCount: isRecovery ? 5 : 12,
      includesRecoveryComponent: true,
      requiredEquipment: chooseRequiredEquipment(persona),
      triggeredInterventions: highSoreness ? ['soreness-assessment'] : [],
      nutritionGuidance: persona.hydration === 'low' ? ['Hydration guidance before training'] : [],
      nextActions,
      completedAction: scenario.requestedAction === 'complete-check-in',
      visibleFeedback: true,
      recoveryModel: {
        targetMuscleRecovery: persona.muscleRecovery,
        compensatoryMusclesConsidered: persona.compensatoryMuscles,
      },
      experienceEvidence: {
        requiredDecisions: lowAdherence ? 1 : 3,
        requiredActions: scenario.requestedAction === 'adjust-session' ? 4 : 2,
        unclearLabels: [],
        hasConfirmation: true,
        missingExplanations: highSoreness ? [] : ['Why this training focus was selected'],
        deadEnds: [],
        contradictoryInstructions: [],
        fieldsInLargestForm: scenario.requestedAction === 'complete-check-in' ? 7 : 4,
        repeatedDataRequests: [],
        unavailableNextActions: [],
        interruptsActiveWorkflow: false,
      },
      raw: {
        adapter: this.name,
      },
    }
  }
}

function chooseRequiredEquipment(persona: SyntheticPersona): Equipment[] {
  if (persona.availableEquipment.includes('dumbbells')) return ['bodyweight', 'dumbbells']
  if (persona.availableEquipment.includes('bands')) return ['bodyweight', 'bands']
  return ['bodyweight']
}
