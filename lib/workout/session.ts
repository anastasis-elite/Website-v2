export function workoutSessionKeys(exercises: any[]): string[] {
  return exercises.map((exercise, index) => String(exercise.session_key || `${exercise.id || exercise.exercise || exercise.name}:${index}`))
}

export function initialWorkoutLogs(exercises: any[]) {
  const keys = workoutSessionKeys(exercises)
  return exercises.map((exercise, index) => ({ ...exercise, session_key: keys[index], completed: false, skipped: false, actual_weight: 0, actual_reps: 0, actual_duration: 0, set_logs: [] as any[] }))
}

export function matchingWorkoutPlan(logs: unknown, keys: string[]) {
  return Array.isArray(logs) && logs.length === keys.length && workoutSessionKeys(logs).every((key, index) => key === keys[index])
}

// Draft timestamps distinguish unsaved work from a stale browser copy. A server
// session always wins over a saved/legacy browser copy; a newer unsaved draft is retained.
export function resumeWorkoutSession(initial: any[], stored: any, session: any) {
  const keys = workoutSessionKeys(initial)
  const server = matchingWorkoutPlan(session?.exercise_logs, keys) ? session : null
  const local = matchingWorkoutPlan(stored?.logs, keys) ? stored : null
  const localIsNewer = local?.dirty === true && Number.isFinite(Date.parse(local.modifiedAt)) && Date.parse(local.modifiedAt) > Date.parse(server?.updated_at || '1970-01-01')
  const chosen = local && (!server || localIsNewer) ? local.logs : server?.exercise_logs || initial
  return {
    logs: chosen.map((log: any, index: number) => {
      const hasRecordedWork = log.completed || log.skipped || log.set_logs?.length || Number(log.actual_reps || log.actual_duration || log.actual_breaths) > 0
      // Unstarted activities follow refreshed prescriptions. Work already begun
      // retains its saved prescription and actuals for an accurate history.
      return { ...initial[index], ...(hasRecordedWork ? log : {}), set_logs: Array.isArray(log.set_logs) ? log.set_logs : [] }
    }),
    draft: local && (!server || localIsNewer) && Array.isArray(local.draft) && local.draft.length === initial.length ? local.draft : null,
    dirty: Boolean(local && (!server || localIsNewer) && local.dirty !== false),
    modifiedAt: localIsNewer ? local.modifiedAt : server?.updated_at || null,
  }
}
