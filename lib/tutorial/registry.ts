import type { TutorialDefinition, TutorialId } from '@/lib/tutorial/types'

export const CORE_ONBOARDING_TUTORIAL_ID = 'core-onboarding-v1'

export const coreOnboardingTutorial: TutorialDefinition = {
  tutorialId: CORE_ONBOARDING_TUTORIAL_ID,
  title: 'Core Onboarding',
  description: 'Foundational guided onboarding for the authenticated dashboard.',
  steps: [
    {
      stepId: 'welcome',
      kind: 'information',
      title: 'Welcome to Anastasis',
      description: 'Placeholder introduction step for validating tutorial state.',
    },
    {
      stepId: 'open-dashboard',
      kind: 'action',
      title: 'Open the dashboard',
      description: 'Placeholder action step for future validated walkthrough behavior.',
      target: { tutorialTargetId: 'client-dashboard-home' },
      requiredAction: {
        actionType: 'navigate',
        target: { tutorialTargetId: 'client-dashboard-home' },
      },
    },
    {
      stepId: 'reveal-daily-flow',
      kind: 'reveal',
      title: 'Daily flow revealed',
      description: 'Placeholder reveal step for future spotlight behavior.',
      revealTarget: { tutorialTargetId: 'daily-flow' },
    },
  ],
}

const tutorialRegistry: Record<TutorialId, TutorialDefinition> = {
  [coreOnboardingTutorial.tutorialId]: coreOnboardingTutorial,
}

export function getTutorialDefinition(tutorialId: TutorialId) {
  return tutorialRegistry[tutorialId] ?? null
}

export function getTutorialDefinitions() {
  return Object.values(tutorialRegistry)
}

export function hasTutorialDefinition(tutorialId: TutorialId) {
  return tutorialId in tutorialRegistry
}
