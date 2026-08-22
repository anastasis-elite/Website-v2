import { getTierCapabilities, normalizeProgramTier } from '@/lib/entitlements'

type AdaptiveDashboardInput = {
  client: any
  monthlyAssessmentsDueCount?: number
}

function getDaysSince(dateValue?: string | null) {
  if (!dateValue) return 0

  const start = new Date(dateValue)
  const now = new Date()
  const diff = now.getTime() - start.getTime()

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export async function getAdaptiveDashboard({
  client,
  monthlyAssessmentsDueCount = 0,
}: AdaptiveDashboardInput) {
  const daysSinceOnboarding = getDaysSince(client?.onboarding_completed_at)

  const program = normalizeProgramTier(client?.program || 'ember')
  const capabilities = getTierCapabilities(program)

  const isEmber = program === 'ember'
  const isIgnite = program === 'ignite'
  const isPhoenix = program === 'phoenix'

  const flameScore = Number(client?.flame_score || 10)
  const consistencyScore = Number(client?.consistency_score || 0)
  const overwhelmScore = Number(client?.overwhelm_score || 0)

  let phase = 1
  let phaseName = 'Foundation'

  if (daysSinceOnboarding > 3) {
    phase = 2
    phaseName = 'Rhythm'
  }

  if (daysSinceOnboarding > 14 && consistencyScore >= 60) {
    phase = 3
    phaseName = 'Awareness'
  }

  if (daysSinceOnboarding > 45 && consistencyScore >= 80) {
    phase = 4
    phaseName = 'Optimization'
  }

  if (overwhelmScore >= 70) {
    phase = 1
    phaseName = 'Foundation'
  }

  /**
   * EMBER = guided self-execution
   * - no schedule control
   * - no full food logging logic
   * - no micros
   * - no symptom intelligence
   * - no advanced adaptive recipes
   *
   * IGNITE = tracking + optimization
   * PHOENIX = full adaptive restoration ecosystem
   */

  const showCycle = true
  const showWorkoutProgram = true
  const showMacroTargets = true
  const showWaterTarget = true
  const showRecoveryRecommendation = true
  const showProgressPhotos = true

  const showStatusDock = isIgnite || isPhoenix
  const showDailyCarousel = isIgnite || isPhoenix
  const showFoodLogging = capabilities.nutritionMealLogging
  const showMicroTracking = isIgnite || isPhoenix
  const showGeneralInsights = isIgnite || isPhoenix
  const showFlame = isIgnite || isPhoenix

  const showSymptoms = isPhoenix
  const showAdaptiveNutrition = isPhoenix
  const showPosture = capabilities.postureAssessment
  const showAdvancedInsights = isPhoenix
  const showPsychologicalInsights = isPhoenix

  let todayFocus = [
    'Cycle-aware training',
    'Macro targets',
    'Recovery timing',
  ]

  let adaptiveMessage =
    'Your dashboard is built around your cycle, strength assessment, macro targets, water needs, and recovery timing. Ember gives you the plan — you bring the spark.'

  if (isIgnite) {
    todayFocus = [
      'Track nutrition',
      'Follow training',
      'Watch recovery',
    ]

    adaptiveMessage =
      'Ignite adds tracking and feedback so you can understand your body without obsessing over every detail.'
  }

  if (isPhoenix) {
    todayFocus = [
      'Reduce friction',
      'Personalize deeply',
      'Restore capacity',
    ]

    adaptiveMessage =
      'Phoenix adapts more deeply around your stress load, symptoms, nutrition, recovery, posture, and nervous system capacity.'
  }

  let recommendedStep = {
    title: 'Complete your foundation assessment',
    description:
      'This gives the system the information it needs to build your cycle-aware workout, macro, water, and recovery recommendations.',
    href: '/dashboard/assessment/start',
  }

  if (monthlyAssessmentsDueCount > 0) {
    recommendedStep = {
      title: 'Complete your check-in',
      description:
        'This helps your system update your workout, recovery, and progress recommendations.',
      href: '/dashboard/assessment/start',
    }
  }

  if (phase === 1 && daysSinceOnboarding <= 1) {
    recommendedStep = {
      title: 'Begin with your foundation',
      description:
        'You do not have to do everything today. Start by reviewing the plan your dashboard is building around your cycle, training, macros, water, and recovery.',
      href: '/dashboard',
    }
  }

  return {
    phase,
    phaseName,
    program,
    isEmber,
    isIgnite,
    isPhoenix,
    flameScore,
    todayFocus,
    adaptiveMessage,
    recommendedStep,

    showFlame,
    showCycle,
    showWorkoutProgram,
    showMacroTargets,
    showWaterTarget,
    showRecoveryRecommendation,
    showProgressPhotos,

    showStatusDock,
    showDailyCarousel,
    showFoodLogging,
    showMicroTracking,
    showGeneralInsights,

    showSymptoms,
    showAdaptiveNutrition,
    showPosture,
    showAdvancedInsights,
    showPsychologicalInsights,
  }
}
