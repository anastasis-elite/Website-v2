import type { TutorialDefinition, TutorialId } from '@/lib/tutorial/types'
import { onboardingJourney } from '@/lib/tutorial/onboarding-journey'
import { getTierCapabilities, normalizeProgramTier, type ProgramTier } from '@/lib/entitlements'

export const CORE_ONBOARDING_TUTORIAL_ID = 'core-onboarding-v1'
const welcomeJourneyStep = onboardingJourney.find((step) => step.id === 'welcome')

export function buildCoreOnboardingTutorial(tierValue: unknown = 'ignite'): TutorialDefinition {
  const tier = normalizeProgramTier(tierValue)
  const capabilities = getTierCapabilities(tier)
  const nutritionCopy: Record<ProgramTier, { title: string; description: string }> = {
    ember: {
      title: 'Macro logging',
      description: 'Record protein, carbs, fats and calories as macro totals in EMBER. Food and meal logging are not included.',
    },
    ignite: {
      title: 'Meal logging',
      description: 'Record foods with manual entry or barcode lookup, review recurring food options, and track macros and micronutrients in IGNITE.',
    },
    phoenix: {
      title: 'Recipe suggestions',
      description: 'PHOENIX adds recipe suggestions based on your remaining nutrition priorities. Open a recipe for context, then review and log the foods you ate. Photo estimation is currently unavailable.',
    },
  }
  const recoveryCopy: Record<ProgramTier, string> = {
    ember: 'Record recovery activities and review guidance based on your available inputs.',
    ignite: 'Recovery can include recommendations such as a mobility, breathing, or gentle movement option.',
    phoenix: 'Recovery can become a directed next action when the available signals show what should happen next.',
  }
  const assessmentDescription = capabilities.postureAssessment
    ? 'Upload progress photos, or use posture photos when you want Anastasis to estimate body landmarks. You can correct the points before they become part of your assessment history.'
    : 'Upload progress and assessment photos for private comparison and history. Posture landmark assessment is available in higher-guidance tiers.'

  return {
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
      description: 'Dashboard is where you see your day and overall state. Use the highlighted control to continue.',
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
      stepId: 'dashboard-workout-access',
      kind: 'reveal',
      title: 'Workout',
      description: 'Open your assigned movement in Your day at a glance, or find Workout in You. A day without assigned training does not add an extra activity.',
      revealTarget: { tutorialTargetId: 'dashboard-navigation' },
    },
    {
      stepId: 'dashboard-daily-insight',
      kind: 'reveal',
      title: 'Your next step',
      description:
        'This short explanation uses the context Anastasis actually has for today. Start here, or open any activity in Your day at a glance.',
      revealTarget: { tutorialTargetId: 'dashboard-daily-insight' },
    },
    {
      stepId: 'dashboard-calendar',
      kind: 'reveal',
      title: 'Calendar views',
      description:
        'Use Day, Week, and Month to see scheduled items and suggested openings. Day also has Morning, Midday, and Evening views for the plan.',
      revealTarget: { tutorialTargetId: 'dashboard-calendar' },
    },
    {
      stepId: 'dashboard-whats-next',
      kind: 'reveal',
      title: 'What’s Next',
      description:
        'What’s Next shows the current or next relevant action Anastasis can identify from today’s context.',
      revealTarget: { tutorialTargetId: 'dashboard-whats-next' },
    },
    {
      stepId: 'dashboard-water-quick-add',
      kind: 'reveal',
      title: 'Log water',
      description:
        'Open Hydration to add the water you have had. Your saved intake updates Today when you return.',
      revealTarget: { tutorialTargetId: 'dashboard-water-progress' },
    },
    {
      stepId: 'dashboard-nutrition-quick-add',
      kind: 'reveal',
      title: nutritionCopy[tier].title,
      description: nutritionCopy[tier].description,
      revealTarget: { tutorialTargetId: 'dashboard-nutrition-progress' },
    },
    {
      stepId: 'dashboard-food-log',
      kind: 'reveal',
      title: tier === 'ember' ? 'Open macro entry' : tier === 'phoenix' ? 'Open nutrition recommendations' : 'Open the full food log',
      description: tier === 'ember'
        ? 'Tap Nutrition to open macro entry and review today’s targets.'
        : tier === 'phoenix'
          ? 'Tap Nutrition to review recipe suggestions, record the foods you ate, and review the day’s intake.'
          : 'Tap Nutrition to open the full food log. Quick Add is for speed; the Nutrition page is where you can log and review the full day.',
      revealTarget: { tutorialTargetId: 'dashboard-nav-nutrition' },
    },
    {
      stepId: 'dashboard-recovery',
      kind: 'reveal',
      title: 'Recovery',
      description: recoveryCopy[tier],
      revealTarget: { tutorialTargetId: 'dashboard-nav-recovery' },
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
      title: 'Progress, Assessments, and Trends',
      description:
        'Today counts saved applicable essentials. Open Progress in the bottom navigation for recorded history, assessment tools, photos, measurements, and trends.',
      revealTarget: { tutorialTargetId: 'dashboard-progress-area' },
    },
    {
      stepId: 'progress-photos',
      kind: 'reveal',
      title: capabilities.postureAssessment ? 'Progress and posture photos' : 'Progress photos',
      description: `Open Progress, then expand Assessments and requirements for photos. ${assessmentDescription}`,
      revealTarget: { tutorialTargetId: 'dashboard-progress-navigation' },
    },
    {
      stepId: 'progress-measurements',
      kind: 'reveal',
      title: 'Measurements',
      description:
        'Open Progress, then expand Assessments and requirements to find Body Assessment. Your saved measurements remain available there over time.',
      revealTarget: { tutorialTargetId: 'dashboard-progress-navigation' },
    },
    {
      stepId: 'progress-strength',
      kind: 'reveal',
      title: 'Strength assessments',
      description:
        'Open Progress, then expand Assessments and requirements to find Strength Assessment. It records functional and performance progress alongside your other history.',
      revealTarget: { tutorialTargetId: 'dashboard-progress-navigation' },
    },
  ],
  }
}

export const coreOnboardingTutorial: TutorialDefinition = buildCoreOnboardingTutorial()

const tutorialRegistry: Record<TutorialId, TutorialDefinition> = {
  [coreOnboardingTutorial.tutorialId]: coreOnboardingTutorial,
}

export function getTutorialDefinition(tutorialId: TutorialId) {
  return tutorialRegistry[tutorialId] ?? null
}

export function getTierAwareTutorialDefinition(tutorialId: TutorialId, tier: unknown) {
  if (tutorialId === CORE_ONBOARDING_TUTORIAL_ID) return buildCoreOnboardingTutorial(tier)
  return getTutorialDefinition(tutorialId)
}

export function getTutorialDefinitions() {
  return Object.values(tutorialRegistry)
}

export function hasTutorialDefinition(tutorialId: TutorialId) {
  return tutorialId in tutorialRegistry
}
