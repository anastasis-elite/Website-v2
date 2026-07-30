import type { Equipment, SyntheticPersona, SyntheticScenario } from '../personas/persona.types'

export type PlatformRouteCheck = {
  route: string
  available: boolean
  status?: number
  message?: string
}

export type PlatformActionResult = {
  action: string
  completed: boolean
  responseShapeValid: boolean
  persisted: boolean
  message?: string
}

export type RecoveryModel = {
  targetMuscleRecovery?: Record<string, number>
  compensatoryMusclesConsidered?: string[]
}

export type ExperienceEvidence = {
  requiredDecisions: number
  requiredActions: number
  unclearLabels: string[]
  hasConfirmation: boolean
  missingExplanations: string[]
  deadEnds: string[]
  contradictoryInstructions: string[]
  fieldsInLargestForm: number
  repeatedDataRequests: string[]
  unavailableNextActions: string[]
  interruptsActiveWorkflow: boolean
}

export type PlatformOutcome = {
  scenarioId: string
  recommendedExerciseCount?: number
  includesRecoveryComponent?: boolean
  requiredEquipment?: Equipment[]
  triggeredInterventions?: string[]
  nutritionGuidance?: string[]
  nextActions?: string[]
  completedAction?: boolean
  visibleFeedback?: boolean
  recoveryModel?: RecoveryModel
  experienceEvidence?: ExperienceEvidence
  raw?: Record<string, unknown>
}

export type PlatformAdapterCapabilities = {
  functionalChecks: boolean
  logicOutcomes: boolean
  experienceEvidence: boolean
}

export type PlatformAdapter = {
  name: string
  capabilities: PlatformAdapterCapabilities
  checkRoutes(routes: string[]): Promise<PlatformRouteCheck[]>
  performAction(action: string, scenario: SyntheticScenario, persona: SyntheticPersona): Promise<PlatformActionResult>
  getScenarioOutcome(scenario: SyntheticScenario, persona: SyntheticPersona): Promise<PlatformOutcome>
}
