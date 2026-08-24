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
      description: 'This shows nutrition progress. Ember uses macro entry, so you can record protein, carbs, fats, and calories without opening the meal logger.',
    },
    ignite: {
      title: 'Meal logging',
      description: 'This shows nutrition progress. Ignite uses meal logging and quick foods so Anastasis can give clearer nutrition guidance.',
    },
    phoenix: {
      title: 'Recommended meals',
      description: 'This shows nutrition progress. Phoenix surfaces recommended meals when nutrition is the next useful action, then lets you log or adjust them.',
    },
  }
  const recoveryCopy: Record<ProgramTier, string> = {
    ember: 'Recovery stays available as a place to record support without Anastasis choosing a specific modality for you.',
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
      description: 'Workout is direct access to today’s training experience.',
      revealTarget: { tutorialTargetId: 'dashboard-nav-workout' },
    },
    {
      stepId: 'dashboard-daily-insight',
      kind: 'reveal',
      title: 'Daily Insight',
      description:
        'Daily Insight changes with the context Anastasis actually has for today, such as schedule load, recovery, nutrition, and the next useful action.',
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
          ? 'Tap Nutrition to review reusable recipes, recommended meals when they fit today, food logging, and the full day.'
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
        'Use these tabs for current progress, assessment tools, progress photos, measurements, and weekly trend history.',
      revealTarget: { tutorialTargetId: 'dashboard-progress-area' },
    },
    {
      stepId: 'progress-photos',
      kind: 'reveal',
      title: capabilities.postureAssessment ? 'Progress and posture photos' : 'Progress photos',
      description: assessmentDescription,
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
