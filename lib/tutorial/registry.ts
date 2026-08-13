import type { TutorialDefinition, TutorialId } from '@/lib/tutorial/types'
import { onboardingJourney } from '@/lib/tutorial/onboarding-journey'

export const CORE_ONBOARDING_TUTORIAL_ID = 'core-onboarding-v1'
const welcomeJourneyStep = onboardingJourney.find((step) => step.id === 'welcome')

export const coreOnboardingTutorial: TutorialDefinition = {
  tutorialId: CORE_ONBOARDING_TUTORIAL_ID,
  title: 'Core Onboarding',
  description: 'Foundational guided onboarding for the authenticated dashboard.',
  steps: [
    {
      stepId: 'welcome',
      kind: 'information',
      title: welcomeJourneyStep?.title ?? 'Welcome to Anastasis',
      description:
        'core-onboarding-v1 is active. This required walkthrough will guide you through the dashboard basics.',
    },
    {
      stepId: 'open-dashboard',
      kind: 'action',
      title: 'Open the dashboard',
      description: 'Use the highlighted Dashboard control to continue the walkthrough.',
      target: { tutorialTargetId: 'client-dashboard-home' },
      requiredAction: {
        actionType: 'navigate',
        target: { tutorialTargetId: 'client-dashboard-home' },
      },
    },
    {
      stepId: 'reveal-daily-flow',
      kind: 'reveal',
      title: 'Dashboard navigation revealed',
      description: 'This navigation stays available while the guided walkthrough continues across screens.',
      revealTarget: { tutorialTargetId: 'dashboard-navigation' },
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
