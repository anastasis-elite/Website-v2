import type { TutorialProgress } from '@/lib/tutorial/types'

export type TutorialHydrationDecision = 'start' | 'resume' | 'skip'

export function getTutorialHydrationDecision(
  progress: Pick<TutorialProgress, 'status'> | null
): TutorialHydrationDecision {
  if (progress?.status === 'completed') return 'skip'
  if (progress?.status === 'in_progress') return 'resume'
  return 'start'
}
