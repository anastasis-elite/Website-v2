import { differenceInDays } from 'date-fns'

export async function getAdaptiveDashboard(client: any) {
  const onboardingDate = client?.onboarding_completed_at

  const daysSinceOnboarding = onboardingDate
    ? differenceInDays(new Date(), new Date(onboardingDate))
    : 0

  let phase = 1
  let phaseName = 'Stabilization'

  if (daysSinceOnboarding > 3) {
    phase = 2
    phaseName = 'Rhythm'
  }

  if (
    client?.consistency_score >= 60 &&
    daysSinceOnboarding > 14
  ) {
    phase = 3
    phaseName = 'Awareness'
  }

  if (
    client?.consistency_score >= 80 &&
    daysSinceOnboarding > 45
  ) {
    phase = 4
    phaseName = 'Optimization'
  }

  let todayFocus = [
    'Hydration',
    'Nourishment',
    'Gentle movement',
  ]

  let adaptiveMessage =
    'Today is focused on stabilization and rebuilding capacity.'

  if (phase === 2) {
    todayFocus = [
      'Hydration',
      'Movement',
      'Recovery rhythm',
    ]

    adaptiveMessage =
      'Your system is beginning to build consistency and rhythm.'
  }

  if (phase === 3) {
    todayFocus = [
      'Training',
      'Recovery',
      'Awareness',
    ]

    adaptiveMessage =
      'Your dashboard is beginning to adapt more deeply to your patterns.'
  }

  if (phase === 4) {
    todayFocus = [
      'Performance',
      'Recovery optimization',
      'Adaptive insights',
    ]

    adaptiveMessage =
      'Your dashboard is operating in advanced adaptive mode.'
  }

  const flameScore = client?.flame_score || 10

  return {
    phase,
    phaseName,
    flameScore,
    todayFocus,
    adaptiveMessage,
  }
}
