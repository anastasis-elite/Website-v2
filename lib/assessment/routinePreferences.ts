import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'
import type { ScheduleStructureAnswers } from './validateScheduleStructure'
import { mergeCommitmentWeekdays, scheduleStructureProfileFields } from './commitmentWeekdays'

export type RoutinePreferences = {
  revision: number
  savedAt: string
  answers: ScheduleStructureAnswers
}

class RoutinePreferencesConflict extends Error {}

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
      merge: current => {
        const previous = current.routinePreferences && typeof current.routinePreferences === 'object' && !Array.isArray(current.routinePreferences)
          ? current.routinePreferences : {}
        const revision = previous.revision ?? 0
        if (revision !== expectedRevision) throw new RoutinePreferencesConflict()
        const savedAt = new Date(Math.max(Date.now(), (Date.parse(previous.savedAt || '') || 0) + 1)).toISOString()
        return { ...mergeCommitmentWeekdays(current, answers), routinePreferences: { ...previous, revision: expectedRevision + 1, savedAt, answers } }
      },
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
