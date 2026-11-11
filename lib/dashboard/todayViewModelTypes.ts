import type { ProgramTier } from './logic/types'
import type { RecoveryRewardSuggestion } from '@/lib/recovery/rewardSuggestion'
import type { TodayActivities, TodayActivity } from './todayActivityTypes'
import type { DailyRecommendation } from './dailyRecommendationTypes'
import type { StreakRequirementProgress } from './logic/streakRequirementProgressTypes'
import type { TodayDaySections } from './todayDaySections'

/** Serializable server-owned Today decisions. Client controls may request a
 * refresh or save an intent; they do not recalculate this snapshot. */
export type TodayViewModel = {
  version: 1
  date: string
  timezone: string
  generatedAt: string
  clientId: string
  tier: ProgramTier
  today: TodayActivities
  presentedActivities: TodayActivity[]
  daySections?: TodayDaySections
  recommendation: DailyRecommendation
  streakProgress: StreakRequirementProgress
  nextRefreshAt: string | null
  deferredReturnAt: string | null
  quiet: boolean
  workout: { state: string | null; inactive: boolean; title: string; reason: string; inProgress: boolean }
  macroReminder: string | null
  recoveryRewardSuggestion?: RecoveryRewardSuggestion
}
