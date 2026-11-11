import 'server-only'

import { getClientTimeZone } from '@/lib/timezone'
import { workoutLocalDate } from './history'
import { workoutRecordComplete } from './activity'
import { matchingWorkoutPlan, workoutSessionKeys } from './session'
import { generatedOriginIdentity, isLegacyGeneratedWorkoutSession, readGeneratedWorkoutOrigin, readGeneratedWorkoutTransition } from './generatedOrigin'
import type { GeneratedWorkoutCompletionEvidence } from './occurrenceIdentity'
export { generatedWorkoutOccurrenceCompleted } from './occurrenceIdentity'
export type { GeneratedWorkoutCompletionEvidence } from './occurrenceIdentity'

/** The current generated prescription and a saved performed session must agree
 * on their full occurrence identity. Daily/weekly completion flags are not links.
 * This only reads existing logs and keeps their existing completion definition. */
export function generatedWorkoutCompletionEvidence({ userId, client, date, plannedWorkout, plannedExercises, history, now = new Date() }: {
  userId: string; client: any; date: string; plannedWorkout: any; plannedExercises: any[]; history: any[]; now?: Date
}): GeneratedWorkoutCompletionEvidence {
  const dayName = typeof plannedWorkout?.day_name === 'string' && plannedWorkout.day_name.trim() ? plannedWorkout.day_name : null
  const planKeys = Array.isArray(plannedExercises) ? workoutSessionKeys(plannedExercises) : []
  const result: GeneratedWorkoutCompletionEvidence = { ownerUserId: userId, clientId: client?.client_id || '', date,
    dayName, planKeys, sessionId: null, completedAt: null }
  if (!userId || !result.clientId || client?.auth_user_id !== userId || !client.program || !dayName ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) || !planKeys.length || new Set(planKeys).size !== planKeys.length || !Number.isFinite(now.getTime())) return result
  const timezone = getClientTimeZone(client)
  const origin = generatedOriginIdentity(plannedWorkout)
  const candidates = (Array.isArray(history) ? history : []).filter(row => {
    if (!row?.id || row.auth_user_id !== userId || row.client_id !== result.clientId || row.program !== client.program ||
      (row.workout_source || 'recommended') !== 'recommended') return false
    try {
      if (workoutLocalDate(row, timezone) !== date) return false
    } catch { return false }
    // Legacy civil dates have no exact clock time; preserve that uncertainty.
    for (const timestamp of [row.workout_started_at, row.updated_at]) {
      if (timestamp && (!Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) > now.getTime())) return false
    }
    const saved = readGeneratedWorkoutOrigin({ userId, client, date, dayName: row.day_name, plan: row.planned_exercises, now }) ||
      readGeneratedWorkoutTransition({ userId, client, date, row, now })
    if (saved) {
      if (!origin || saved.dayName !== origin.dayName || saved.fingerprint !== origin.fingerprint ||
        !matchingWorkoutPlan(row.exercise_logs, workoutSessionKeys(row.planned_exercises))) return false
    } else if (!isLegacyGeneratedWorkoutSession(row) || row.day_name !== dayName || !matchingWorkoutPlan(row.planned_exercises, planKeys) || !matchingWorkoutPlan(row.exercise_logs, planKeys)) {
      // Exact legacy prescriptions still have their existing occurrence identity.
      // An adapted legacy row without provenance stays unconfirmed.
      return false
    }
    return workoutRecordComplete(row)
  }).sort((left, right) => String(right.updated_at || right.workout_started_at || '').localeCompare(String(left.updated_at || left.workout_started_at || '')))
  const completed = candidates[0]
  return completed ? { ...result, sessionId: String(completed.id), completedAt: completed.updated_at || null } : result
}
