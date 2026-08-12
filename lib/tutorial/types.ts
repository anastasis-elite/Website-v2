export type TutorialId = string
export type TutorialStepId = string

export type TutorialStepKind = 'information' | 'action' | 'reveal'

export type TutorialStatus = 'not_started' | 'in_progress' | 'completed'

export interface TutorialStepTarget {
  tutorialTargetId: string
}

export interface TutorialActionRequirement {
  actionType: string
  target?: TutorialStepTarget
}

export interface BaseTutorialStep {
  stepId: TutorialStepId
  kind: TutorialStepKind
  title: string
  description?: string
  target?: TutorialStepTarget
}

export interface InformationTutorialStep extends BaseTutorialStep {
  kind: 'information'
}

export interface ActionTutorialStep extends BaseTutorialStep {
  kind: 'action'
  requiredAction: TutorialActionRequirement
}

export interface RevealTutorialStep extends BaseTutorialStep {
  kind: 'reveal'
  revealTarget: TutorialStepTarget
}

export type TutorialStep =
  | InformationTutorialStep
  | ActionTutorialStep
  | RevealTutorialStep

export interface TutorialDefinition {
  tutorialId: TutorialId
  title: string
  description?: string
  steps: TutorialStep[]
}

export interface TutorialProgress {
  tutorialId: TutorialId
  status: TutorialStatus
  currentStepId: TutorialStepId | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}
