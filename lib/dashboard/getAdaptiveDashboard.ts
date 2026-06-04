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

  const flameScore = Number(client?.flame_score || 10)
  const consistencyScore = Number(client?.consistency_score || 0)
  const overwhelmScore = Number(client?.overwhelm_score || 0)

  let phase = 1
  let phaseName = 'Stabilization'

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
    phaseName = 'Stabilization'
  }

  const isPhoenix = client?.program === 'phoenix'

  const showDailyCarousel = phase >= 2
  const showSymptoms = phase >= 3
  const showStatusDock = phase >= 2
  const showAdaptiveNutrition = phase >= 4 && isPhoenix
  const showPosture = phase >= 3
  const showAdvancedInsights = phase >= 4

  let todayFocus = ['Hydration', 'Nourishment', 'Gentle movement']

  let adaptiveMessage =
    'Today is focused on stabilization. You do not need to fix everything today. We are protecting the flame first.'

  if (phase === 2) {
    todayFocus = ['Hydration', 'Meal rhythm', 'Movement rhythm']
    adaptiveMessage =
      'Your dashboard is beginning to build rhythm around the life you actually live.'
  }

  if (phase === 3) {
    todayFocus = ['Training', 'Recovery', 'Body awareness']
    adaptiveMessage =
      'Your system has enough rhythm to begin showing deeper patterns without overwhelming you.'
  }

  if (phase === 4) {
    todayFocus = ['Performance', 'Recovery optimization', 'Adaptive insights']
    adaptiveMessage =
      'Your dashboard is now ready for deeper adaptive intelligence and advanced support.'
  }

  let recommendedStep = {
    title: 'Complete your Daily Structure Assessment',
    description:
      'Help the dashboard learn the rhythm your life can realistically hold.',
    href: '/dashboard/assessment/daily-structure',
  }

  if (monthlyAssessmentsDueCount > 0 && phase >= 2) {
    recommendedStep = {
      title: 'Complete your monthly check-in',
      description:
        'This helps your system adjust without assuming last month still fits this month.',
      href: '/dashboard/assessment/start',
    }
  }

  if (phase === 1) {
    recommendedStep = {
      title: 'Start with one small win',
      description:
        'Today is not about doing everything. Choose hydration, nourishment, or a few minutes of movement.',
      href: '/dashboard/nutrition',
    }
  }

  return {
    phase,
    phaseName,
    flameScore,
    todayFocus,
    adaptiveMessage,
    recommendedStep,
    showDailyCarousel,
    showSymptoms,
    showStatusDock,
    showAdaptiveNutrition,
    showPosture,
    showAdvancedInsights,
  }
}
