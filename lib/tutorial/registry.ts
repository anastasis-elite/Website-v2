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
    {
      stepId: 'dashboard-water-quick-add',
      kind: 'action',
      title: 'Quick add water from the dashboard',
      description:
        'This circle shows today’s hydration progress. Tap it any time to quickly add water without leaving the dashboard.',
      target: { tutorialTargetId: 'dashboard-water-progress' },
      requiredAction: {
        actionType: 'open-hydration-quick-add',
        target: { tutorialTargetId: 'dashboard-water-progress' },
      },
    },
    {
      stepId: 'dashboard-nutrition-quick-add',
      kind: 'reveal',
      title: 'Nutrition progress and quick foods',
      description:
        'This shows nutrition progress. After you repeatedly log the same foods in this time of day, Anastasis can surface those foods here for faster logging; until then, the full food log is always available.',
      revealTarget: { tutorialTargetId: 'dashboard-nutrition-progress' },
    },
    {
      stepId: 'dashboard-food-log',
      kind: 'reveal',
      title: 'Open the full food log',
      description:
        'Tap Nutrition to open the full food log. Quick Add is for speed; the Nutrition page is where you can log and review the full day.',
      revealTarget: { tutorialTargetId: 'dashboard-nav-nutrition' },
    },
    {
      stepId: 'dashboard-daily-checkin',
      kind: 'reveal',
      title: 'Daily Check-In',
      description:
        'Use the Daily Check-In to tell Anastasis what is happening today, so the system does not treat every day the same.',
      revealTarget: { tutorialTargetId: 'dashboard-daily-checkin' },
    },
    {
      stepId: 'dashboard-progress-area',
      kind: 'reveal',
      title: 'Progress lives together',
      description:
        'Photos, measurements, and strength assessments are grouped here because they are periodic progress tools, not daily logging tasks.',
      revealTarget: { tutorialTargetId: 'dashboard-progress-area' },
    },
    {
      stepId: 'progress-photos',
      kind: 'reveal',
      title: 'Progress photos',
      description:
        'Upload progress photos here so they become part of your longitudinal progress record. Posture photo analysis is coming soon.',
      revealTarget: { tutorialTargetId: 'dashboard-progress-photos' },
    },
    {
      stepId: 'progress-measurements',
      kind: 'reveal',
      title: 'Measurements',
      description:
        'Measurements live here. Use this area to log and review objective body measurement progress over time.',
      revealTarget: { tutorialTargetId: 'dashboard-measurements' },
    },
    {
      stepId: 'progress-strength',
      kind: 'reveal',
      title: 'Strength assessments',
      description:
        'Strength assessments live here. These track functional and performance progress separately from scale, photo, or body measurement changes.',
      revealTarget: { tutorialTargetId: 'dashboard-strength-assessment' },
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
