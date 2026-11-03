import { activityDose, isValidCompletedSet, prescribedSetCount } from './activity'

export type ManualSaveEvidence = { workoutLogId: string; exerciseId: string; dayName: string; signature: string }
export type ManualSavedExercise = {
  id: string; name: string; signature: string; kind: 'strength' | 'cardio' | 'breathing' | 'mobility'; completed: boolean; plannedSets: number
  setLogs: Array<{ setNumber: number; reps: number; weight: number; unit: 'lb' | 'kg'; completedAt: string }>
  duration: number | null; durationUnit: 'minutes' | 'seconds' | 'breaths' | null
}
export type ManualSavedSession = { id: string; dayName: string; updatedAt: string; completed: boolean
  progress: { completedSets: number; totalSets: number; requiredSets: number }; exercises: ManualSavedExercise[] }
export type ManualWorkoutSummary = { version: 1; clientId: string; authUserId: string; program: string; date: string
  sessions: ManualSavedSession[]; completed: boolean }

export function manualExerciseIdentity(log: any, index = 0) {
  return String(log?.id || log?.session_key || `legacy:${String(log?.exercise || log?.name || 'Exercise')}:${index}`)
}

// This is an exact comparison of saved actuals, not a signed grant or a new
// completion rule. It lets Finish detect an older/ambiguous save response.
export function manualExerciseSignature(log: any): string | null {
  if (!log || typeof log !== 'object' || Array.isArray(log)) return null
  const sets = Array.isArray(log.set_logs) ? log.set_logs : []
  if (sets.length > 100) return null
  const confirmed = sets.filter(isValidCompletedSet).map((set: any, index: number) => ({
    id: typeof set.id === 'string' ? set.id : null, number: Number(set.set_number || index + 1),
    reps: Number(set.reps), weight: Number(set.weight), unit: set.weight_unit || 'lb', at: set.completed_at,
  }))
  const strength = activityDose(log).kind === 'strength'
  return JSON.stringify({ id: log.id || log.session_key || null, variant: log.selected_variant_id || null,
    plannedSets: strength ? prescribedSetCount(log) : null, sets: confirmed,
    duration: strength ? null : Number(log.actual_duration || log.actual_breaths || 0),
    unit: strength ? null : log.duration_unit || (activityDose(log).metric === 'breaths' ? 'breaths' : null),
    confirmedAt: strength ? null : log.confirmed_at || null, completed: log.completed === true, skipped: log.skipped === true })
}

export function confirmedManualSummary(value: any, expected: { clientId: string; authUserId: string; program: string; date: string }): value is ManualWorkoutSummary {
  if (!value || value.version !== 1 || Object.entries(expected).some(([key, item]) => value[key] !== item) ||
    !Array.isArray(value.sessions) || value.sessions.length > 100 || typeof value.completed !== 'boolean') return false
  return value.sessions.every((session: any) => typeof session.id === 'string' && session.id && typeof session.dayName === 'string' &&
    typeof session.updatedAt === 'string' && Number.isFinite(Date.parse(session.updatedAt)) && typeof session.completed === 'boolean' &&
    session.progress && ['completedSets', 'totalSets', 'requiredSets'].every(key => Number.isSafeInteger(session.progress[key]) && session.progress[key] >= 0) &&
    Array.isArray(session.exercises) && session.exercises.length <= 100 && session.exercises.every((exercise: any) =>
      typeof exercise.id === 'string' && typeof exercise.name === 'string' && typeof exercise.signature === 'string' &&
      ['strength', 'cardio', 'breathing', 'mobility'].includes(exercise.kind) && typeof exercise.completed === 'boolean' &&
      Number.isSafeInteger(exercise.plannedSets) && exercise.plannedSets >= 0 && Array.isArray(exercise.setLogs) && exercise.setLogs.length <= 100 &&
      exercise.setLogs.every((set: any) => Number.isSafeInteger(set.setNumber) && set.setNumber > 0 && Number.isSafeInteger(set.reps) && set.reps > 0 &&
        typeof set.weight === 'number' && Number.isFinite(set.weight) && set.weight >= 0 && ['lb', 'kg'].includes(set.unit) && Number.isFinite(Date.parse(set.completedAt))) &&
      (exercise.duration === null || typeof exercise.duration === 'number' && Number.isFinite(exercise.duration) && exercise.duration >= 0) &&
      (exercise.durationUnit === null || ['minutes', 'seconds', 'breaths'].includes(exercise.durationUnit)))) &&
    value.completed === value.sessions.some((session: ManualSavedSession) => session.completed)
}

export function summaryContainsSavedExercises(summary: ManualWorkoutSummary, exercises: Array<{ id: string; saveEvidence?: ManualSaveEvidence }>) {
  return exercises.every(exercise => summary.sessions.some(session => {
    const saved = session.exercises.find(item => item.id === exercise.id)
    if (!saved) return false
    const proof = exercise.saveEvidence
    // Older local summaries lack receipts. Show only the actual server record
    // with that exact occurrence ID; local completion labels never earn credit.
    return !proof || proof.exerciseId === exercise.id && proof.workoutLogId === session.id && proof.dayName === session.dayName && proof.signature === saved.signature
  }))
}
