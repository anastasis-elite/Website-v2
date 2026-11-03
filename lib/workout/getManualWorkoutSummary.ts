import 'server-only'

import { activityDose, isValidCompletedSet, manualWorkoutPlan, prescribedSetCount, workoutCompletion, workoutRecordComplete } from './activity'
import { loadWorkoutHistory, workoutLocalDate } from './history'
import { MANUAL_CARDIO_DAY_NAME } from './manualCardio'
import { manualExerciseIdentity, manualExerciseSignature, type ManualSavedExercise, type ManualSavedSession, type ManualWorkoutSummary } from './manualFinish'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'

const MANUAL_DAY_NAMES = ['Manual Workout', MANUAL_CARDIO_DAY_NAME] as const
const MAX_SESSIONS = 100
const MAX_EXERCISES = 200
const MAX_SETS = 10000
const MAX_RESPONSE_BYTES = 2_000_000
const unavailable = () => new Error('Your saved manual workout could not be verified. Retry or review workout history.')

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function savedExercise(log: any, index: number): ManualSavedExercise {
  if (!log || typeof log !== 'object' || Array.isArray(log)) throw unavailable()
  const id = manualExerciseIdentity(log, index)
  const name = log.display_name || log.exercise || log.name
  const signature = manualExerciseSignature(log)
  if (!id || id.length > 500 || typeof name !== 'string' || !name.trim() || name.length > 500 || !signature) throw unavailable()
  if (log.set_logs !== undefined && (!Array.isArray(log.set_logs) || log.set_logs.length > 100)) throw unavailable()
  const sets: any[] = Array.isArray(log.set_logs) ? log.set_logs : []
  // Retain skipped work as skipped evidence, but never display it as performed.
  if (sets.some(set => !isValidCompletedSet(set) && !set?.skipped && set?.status !== 'skipped')) throw unavailable()
  const dose = activityDose(log)
  const durationUnit = log.duration_unit === 'minutes' || log.duration_unit === 'seconds' || log.duration_unit === 'breaths'
    ? log.duration_unit : dose.metric === 'breaths' ? 'breaths' : null
  const rawDuration = dose.metric === 'breaths' ? log.actual_breaths ?? log.actual_reps : log.actual_duration
  const duration = dose.kind !== 'strength' && rawDuration !== undefined && rawDuration !== null
    ? Number(rawDuration) : null
  if (duration !== null && (!Number.isFinite(duration) || duration < 0)) throw unavailable()
  return {
    id, name, signature, kind: dose.kind, completed: log.completed === true,
    plannedSets: dose.kind === 'strength' ? prescribedSetCount(log) : 0,
    setLogs: sets.filter(isValidCompletedSet).map((set, position) => ({
      setNumber: Number.isSafeInteger(Number(set.set_number)) && Number(set.set_number) > 0 ? Number(set.set_number) : position + 1,
      reps: Number(set.reps), weight: Number(set.weight), unit: set.weight_unit === 'kg' ? 'kg' : 'lb', completedAt: set.completed_at,
    })),
    duration, durationUnit,
  }
}

/** Read-only proof of this account's saved manual work. Finishing never rewrites
 * a client snapshot or creates a second workout/session authority. */
export async function getManualWorkoutSummary({ supabase, user, client, date }: {
  supabase: any; user: { id: string }; client: any; date: string
}): Promise<ManualWorkoutSummary> {
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id || getClientLocalDate(client) !== date) throw unavailable()
  const zone = getClientTimeZone(client)
  const results = await Promise.all(MANUAL_DAY_NAMES.map(dayName => loadWorkoutHistory({
    supabase, client, authUserId: user.id, startDate: date, source: 'manual', dayName, limit: MAX_SESSIONS + 1,
  })))
  if (results.some(result => result.error)) throw unavailable()
  const rows = new Map<string, any>()
  for (const result of results) for (const row of result.data || []) {
    if (row.client_id !== client.client_id || row.auth_user_id !== user.id || row.workout_source !== 'manual' ||
      !MANUAL_DAY_NAMES.includes(row.day_name) || workoutLocalDate(row, zone) !== date) continue
    // Unknown program provenance cannot become verified work for the current
    // builder. Known other-program history remains untouched in history.
    if (row.program === undefined || row.program === null || row.program === '') throw unavailable()
    if (row.program !== client.program) continue
    if (typeof row.id !== 'string' || !row.id || row.id.length > 200 || !validTimestamp(row.updated_at) ||
      !Array.isArray(row.exercise_logs) || row.exercise_logs.length < 1 || row.exercise_logs.length > 100) throw unavailable()
    rows.set(row.id, row)
  }
  if (rows.size > MAX_SESSIONS) throw unavailable()
  let exerciseCount = 0, setCount = 0
  const sessions: ManualSavedSession[] = [...rows.values()].map(row => {
    const exercises = row.exercise_logs.map(savedExercise)
    exerciseCount += exercises.length
    setCount += exercises.reduce((total: number, exercise: ManualSavedExercise) => total + exercise.setLogs.length, 0)
    if (exerciseCount > MAX_EXERCISES || setCount > MAX_SETS) throw unavailable()
    const progress = workoutCompletion(row.exercise_logs, manualWorkoutPlan(row.exercise_logs))
    return {
      id: row.id, dayName: row.day_name, updatedAt: row.updated_at, completed: workoutRecordComplete(row),
      progress: { completedSets: progress.completedSets, totalSets: progress.totalSets, requiredSets: progress.requiredSets }, exercises,
    }
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
  const summary: ManualWorkoutSummary = {
    version: 1, clientId: client.client_id, authUserId: user.id, program: client.program, date,
    sessions, completed: sessions.some(session => session.completed),
  }
  if (new TextEncoder().encode(JSON.stringify(summary)).byteLength > MAX_RESPONSE_BYTES) throw unavailable()
  return summary
}
