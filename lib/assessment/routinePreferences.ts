import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'
import type { ScheduleStructureAnswers } from './validateScheduleStructure'
import { COMMITMENT_DAY_FIELDS, getCommitmentWeekdays, mergeCommitmentWeekdays, scheduleStructureProfileFields } from './commitmentWeekdays'

export type RoutinePreferences = {
  revision: number
  savedAt: string
  answers: ScheduleStructureAnswers
}

export class RoutinePreferencesConflict extends Error {}

function routinePreferences(onboardingData: any): Record<string, any> {
  const value = onboardingData?.routinePreferences
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function getRoutinePreferencesRevision(onboardingData: any): number {
  return routinePreferences(onboardingData).revision ?? 0
}

/** Both preference writers share this revision; assessment evidence stays separate. */
export function mergeRoutinePreferences(current: Record<string, any>, expectedRevision: number, answers: ScheduleStructureAnswers): Record<string, any> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER ||
    getRoutinePreferencesRevision(current) !== expectedRevision) throw new RoutinePreferencesConflict()
  const previous = routinePreferences(current)
  const savedAt = new Date(Math.max(Date.now(), (Date.parse(previous.savedAt || '') || 0) + 1)).toISOString()
  const next = mergeCommitmentWeekdays(current, answers)
  // Legacy submissions omit weekdays without clearing them. The mutable snapshot
  // reflects those retained choices, while immutable proof keeps submitted answers.
  const latestAnswers = { ...answers }
  for (const field of COMMITMENT_DAY_FIELDS) {
    const days = getCommitmentWeekdays({ onboarding_data: next }, field)
    if (days !== undefined) latestAnswers[field] = days
  }
  return { ...next, routinePreferences: { ...previous, revision: expectedRevision + 1, savedAt, answers: latestAnswers } }
}

/** Intentional routine edits are separate from immutable assessment evidence. */
export async function saveRoutinePreferences({
  supabase, userId, clientId, expectedRevision, answers,
}: {
  supabase: any
  userId: string
  clientId: string
  expectedRevision: number
  answers: ScheduleStructureAnswers
}): Promise<{ saved: true; routine: RoutinePreferences } | { saved: false; status: number }> {
  try {
    const result = await updateOwnedOnboardingData({
      supabase, userId, clientId,
      merge: current => mergeRoutinePreferences(current, expectedRevision, answers),
      // One owner-scoped update commits the confirmed profile preferences and
      // their revision together. Assessment proof and reviewed-at stay intact.
      fields: scheduleStructureProfileFields(answers),
    })
    if (!result.saved) return result
    return { saved: true, routine: result.onboardingData.routinePreferences }
  } catch (error) {
    if (error instanceof RoutinePreferencesConflict) return { saved: false, status: 409 }
    throw error
  }
}
