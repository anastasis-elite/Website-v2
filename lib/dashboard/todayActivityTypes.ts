export const TODAY_ACTIVITY_IDS = ['check-in', 'water', 'schedule', 'nutrition', 'workout', 'recovery'] as const
export type TodayActivityId = typeof TODAY_ACTIVITY_IDS[number] | `assessment:${string}`
export type TodayActivityStatus = 'available' | 'upcoming' | 'in_progress' | 'completed' | 'deferred' | 'skipped'
export type DailyGuidePreference = { status: 'deferred' | 'skipped' | 'reviewed'; until?: string }
export type DailyGuideState = { date: string; activities: Partial<Record<TodayActivityId, DailyGuidePreference>> }
export type TodayActivity = {
  id: TodayActivityId
  category: string
  title: string
  detail: string
  href: string
  status: TodayActivityStatus
  countsTowardProgress: boolean
  canSkip: boolean
  canDefer: boolean
  canResume: boolean
  deferredUntil?: string
}
export type TodayActivities = { activities: TodayActivity[]; completed: number; total: number }
