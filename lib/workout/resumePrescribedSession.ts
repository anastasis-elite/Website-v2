import { activityDose, prescribedSetCount } from '@/lib/workout/activity'
import { matchingWorkoutPlan, workoutSessionKeys } from '@/lib/workout/session'

const suppliedNumber = (value: unknown) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value))

function hasRecordedWork(log: any) {
  return log?.completed === true || Array.isArray(log?.set_logs) && log.set_logs.some((set: any) =>
    suppliedNumber(set?.reps) && Number(set.reps) > 0 && suppliedNumber(set?.weight) && Number(set.weight) >= 0) ||
    ['actual_reps', 'actual_duration', 'actual_breaths'].some(field => suppliedNumber(log?.[field]) && Number(log[field]) > 0) ||
    log?.activity_completed === true && typeof log.confirmed_at === 'string' && Number.isFinite(Date.parse(log.confirmed_at))
}

function hasRecordedDose(exercise: any) {
  if (!exercise || ![exercise.exercise, exercise.name, exercise.display_name].some(name => typeof name === 'string' && name.trim())) return false
  const dose = activityDose(exercise)
  if (dose.kind === 'strength') {
    return prescribedSetCount(exercise) > 0 && suppliedNumber(exercise.sets) && Number(exercise.sets) > 0 &&
      Number.isSafeInteger(dose.prescribed) && dose.prescribed > 0
  }
  return dose.metric === 'completion' || Number.isFinite(dose.prescribed) && dose.prescribed > 0
}

/** Inspect retained browser input before any refreshed plan can be merged into
 * it. An incomplete original prescription must never inherit today's dose. */
export function inspectRetainedLocalPrescription({ keys, stored }: { keys: string[]; stored: any }):
  | { status: 'none' | 'incomplete' }
  | { status: 'coherent'; plan: any[] } {
  const local = Array.isArray(stored) ? { logs: stored } : stored
  if (local === null || local === undefined) return { status: 'none' }
  if (typeof local !== 'object') return { status: 'incomplete' }
  const logs = local.logs
  const record = (value: any) => value && typeof value === 'object' && !Array.isArray(value)
  if (logs !== undefined && (!Array.isArray(logs) || logs.some((log: any) => !record(log))) ||
    local.plannedExercises !== undefined && (!Array.isArray(local.plannedExercises) || local.plannedExercises.some((exercise: any) => !record(exercise)))) {
    return { status: 'incomplete' }
  }
  const retainedWork = Array.isArray(logs) && logs.some((log: any) => log && (
    log.completed || log.skipped || Array.isArray(log.set_logs) && log.set_logs.length > 0 ||
    ['actual_weight', 'actual_reps', 'actual_duration', 'actual_breaths'].some(field => Number(log[field]) > 0) ||
    log.activity_completed || log.confirmed_at
  ))
  const originalPlan = local.plannedExercises === undefined ? logs : local.plannedExercises
  const retainedEdit = Array.isArray(local.draft) && local.draft.some((entry: any, index: number) =>
    entry?.weightEdited === true || entry?.amountEdited === true ||
    // Legacy rep inputs had no edit marker. A departure from the saved dose
    // is user input, even after Save / pause cleared the dirty flag.
    suppliedNumber(entry?.amount) && originalPlan?.[index] &&
      Number(entry.amount) !== activityDose(originalPlan[index]).prescribed)

  if (local.dirty !== true && local.completed !== true && !retainedWork && !retainedEdit) return { status: 'none' }
  const plan = local.plannedExercises === undefined ? logs : local.plannedExercises
  if (!keys.length || new Set(keys).size !== keys.length || !matchingWorkoutPlan(logs, keys) ||
    !matchingWorkoutPlan(plan, keys) || !plan.every(hasRecordedDose)) return { status: 'incomplete' }
  return { status: 'coherent', plan }
}

/** Select only an already-started saved prescription. No current load is used
 * as a fallback when an old draft cannot prove its original set denominator.
 * Unknown load guidance is retained as unknown; actual load is entered in UI. */
export function selectResumablePrescriptionSnapshot({ keys, stored, session }: { keys: string[]; stored: any; session: any }): { plan: any[]; source: 'local' | 'server' } | null {
  if (!keys.length || new Set(keys).size !== keys.length) return null
  const server = matchingWorkoutPlan(session?.exercise_logs, keys) ? session : null
  const localCandidate = Array.isArray(stored) ? { logs: stored } : stored
  const local = matchingWorkoutPlan(localCandidate?.logs, keys) ? localCandidate : null
  const newerLocal = local?.dirty === true && Number.isFinite(Date.parse(local.modifiedAt)) &&
    Date.parse(local.modifiedAt) > Date.parse(server?.updated_at || '1970-01-01')
  const useLocal = Boolean(local && (!server || newerLocal))
  const chosen = useLocal ? local : server
  if (!chosen) return null
  const logs = useLocal ? chosen.logs : chosen.exercise_logs
  if (!logs.some(hasRecordedWork)) return null
  const savedPlan = useLocal ? chosen.plannedExercises : chosen.planned_exercises
  // Earlier browser drafts retained the prescription on each log instead of a
  // separate plan. It is usable only when every original dose is still explicit.
  const plan = savedPlan === undefined ? logs : savedPlan
  if (!matchingWorkoutPlan(plan, keys) || !plan.every(hasRecordedDose) ||
    !matchingWorkoutPlan(logs, workoutSessionKeys(plan))) return null
  return { plan, source: useLocal ? 'local' : 'server' }
}

/** A reduced session may have retained its own title and subset of exercises.
 * Recover that identity only when one coherent same-day recommended draft
 * exists in this exact member/program storage scope. */
export function discoverResumableLocalPrescription({ storage, clientId, program, date }: {
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>; clientId: string; program: string; date: string
}): { storageKey: string; dayName: string; keys: string[]; stored: any; plan: any[] } | null {
  const prefix = `anastasis-session:${clientId}:${program}:`, marker = `:${date}:recommended:`
  const candidates = []
  for (let index = 0; index < storage.length; index++) {
    const storageKey = storage.key(index)
    if (!storageKey?.startsWith(prefix)) continue
    const suffix = storageKey.slice(prefix.length), boundary = suffix.lastIndexOf(marker)
    if (boundary <= 0) continue
    try {
      const dayName = suffix.slice(0, boundary), keys = JSON.parse(suffix.slice(boundary + marker.length))
      if (!dayName.trim() || !Array.isArray(keys) || !keys.length || !keys.every(key => typeof key === 'string')) continue
      const rawStored = JSON.parse(storage.getItem(storageKey) || 'null')
      const stored = Array.isArray(rawStored) ? { logs: rawStored } : rawStored
      const snapshot = selectResumablePrescriptionSnapshot({ keys, stored, session: null })
      if (snapshot) candidates.push({ storageKey, dayName, keys, stored, plan: snapshot.plan })
    } catch { /* A malformed draft is retained for review, never rewritten. */ }
  }
  return candidates.length === 1 ? candidates[0] : null
}
