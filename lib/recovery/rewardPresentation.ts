import 'server-only'

import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { TodayActivity } from '@/lib/dashboard/todayActivityTypes'
import { presentTodayActivities } from '@/lib/dashboard/todayActivities'
import { getTierCapabilities } from '@/lib/entitlements'
import { localDateKey } from '@/lib/timezone'
import { getRecoveryPresentation } from './todayCompletion'
import type { RecoveryRewardSuggestion } from './rewardSuggestion'

type RewardSchedule = Pick<DailyScheduleState, 'date' | 'timezone' | 'now' | 'events' | 'dailyGuide' | 'unavailableSources'>

/** Both surfaces use the existing saved completion, intent and window rules.
 * Safety is already validated by the logic pipeline; this adapter neither
 * interprets health notes nor creates a new safety or training decision. */
export function getRecoveryRewardForPresentation({ logic, schedule, presentedActivities }: {
  logic: ProgramLogicOutput
  schedule: RewardSchedule
  presentedActivities?: TodayActivity[]
}): RecoveryRewardSuggestion | undefined {
  const suggestion = logic.recoveryRewardSuggestion
  if (suggestion?.version !== 1 || suggestion.clientId !== logic.client.id ||
    suggestion.date !== schedule.date || suggestion.timezone !== schedule.timezone ||
    logic.client.timezone && logic.client.timezone !== schedule.timezone) return undefined
  const now = new Date(schedule.now)
  try { if (!Number.isFinite(now.getTime()) || localDateKey(now, schedule.timezone) !== schedule.date) return undefined }
  catch { return undefined }
  // A validated safety message is not an optional activity or a completion
  // prompt, so it survives held/completed recovery and tier restrictions.
  if (suggestion.kind === 'safety') return suggestion
  if (suggestion.kind !== 'reward' || !getTierCapabilities(logic.program).recoveryRecommendation) return undefined
  const state = logic.workoutDecision.assignedWorkout?.workout_state
  if (logic.symptoms.redFlag || logic.recoveryStatus.status === 'full_recovery_or_red_flag' ||
    logic.workoutDecision.adjustmentLevel === 'level_4_rest_or_red_flag' ||
    logic.workoutDecision.canTrain === false && !['rest', 'unavailable'].includes(state || '')) return undefined
  const evidence = logic.execution.recoveryEvidence
  if (!evidence?.available || !evidence.ownerUserId || evidence.clientId !== logic.client.id || evidence.date !== schedule.date) return undefined
  // A foreign or malformed recovery event is unknown, never proof that this
  // member has an unscheduled recovery moment available.
  if (schedule.events.some(event => event.event_type === 'recovery' && event.status !== 'cancelled' &&
    (event.user_id !== evidence.ownerUserId || event.client_id !== evidence.clientId || event.schedule_date && event.schedule_date !== evidence.date))) return undefined
  const recovery = getRecoveryPresentation({ evidence, schedule })
  if (recovery.state !== 'due' && recovery.state !== 'no_event') return undefined
  const activities = presentedActivities || presentTodayActivities(logic, schedule)
  const activity = activities.find(item => item.id === 'recovery')
  return activity && ['available', 'in_progress'].includes(activity.status) ? suggestion : undefined
}
