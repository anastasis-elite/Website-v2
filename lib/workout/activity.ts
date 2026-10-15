export type ActivityKind = 'strength' | 'cardio' | 'breathing' | 'mobility'
export type ActivityDose = { kind: ActivityKind; metric: 'reps' | 'breaths' | 'minutes' | 'seconds' | 'completion'; prescribed: number; sets: number; weight: number; increment: number; unit: 'lb' | 'kg'; loadLabel: string }
export function isBodyweightExercise(exercise: any) {
  const selected = exercise.available_variants?.find((variant: any) => variant.id === exercise.selected_variant_id)
  return selected ? selected.load_type === 'bodyweight' || selected.equipment === 'bodyweight' : exercise.load_type === 'bodyweight' || exercise.selected_equipment === 'bodyweight'
}
export function activityDose(exercise: any, preferredUnit: 'lb' | 'kg' = 'lb'): ActivityDose {
  const name = String(exercise.selected_variant_name || exercise.display_name || exercise.name || exercise.exercise || '').toLowerCase()
  const metadata = `${exercise.exercise_category || exercise.category || ''} ${exercise.movement_type || exercise.type || ''}`.toLowerCase()
  const text = `${metadata} ${name}`
  const kind: ActivityKind = /breath/.test(text) ? 'breathing' : /strength|resistance/.test(metadata) ? 'strength' : /cardio|\bwalking\b|\bwalk\b|cycling|easy bike|swim|\brunning\b|treadmill/.test(text) && !/lunge|farmer/.test(name) ? 'cardio' : /mobility|stretch|yoga|recovery|warm.?up|cool.?down|cat.?cow|thoracic rotation|foam roll/.test(text) ? 'mobility' : 'strength'
  const label = String(exercise.duration_label || exercise.reps || '')
  const durationMinutes = Number(exercise.duration_minutes || 0), durationSeconds = Number(exercise.duration_seconds || 0)
  const timeMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:[-–]\s*\d+(?:\.\d+)?\s*)?(?:(?:slow|deep|controlled)\s+)?(min|sec|breath)/i)
  const metric: ActivityDose['metric'] = kind === 'strength' ? 'reps' : durationMinutes > 0 ? 'minutes' : durationSeconds > 0 ? 'seconds' : timeMatch?.[2]?.startsWith('sec') ? 'seconds' : timeMatch?.[2]?.startsWith('min') ? 'minutes' : kind === 'breathing' ? 'breaths' : kind === 'cardio' ? 'minutes' : 'completion'
  const rawReps = exercise.recommended_reps ?? exercise.reps ?? exercise.target_reps
  const prescribed = metric === 'completion' ? 1 : metric === 'reps' || metric === 'breaths' ? Number(rawReps ?? timeMatch?.[1] ?? 0) : metric === 'minutes' ? durationMinutes || Number(timeMatch?.[1] || 0) : durationSeconds || Number(timeMatch?.[1] || 0)
  const unit = preferredUnit
  const sourceUnit = exercise.weight_unit === 'kg' ? 'kg' : 'lb'
  const factor = unit === sourceUnit ? 1 : unit === 'kg' ? 1/2.2046226218 : 2.2046226218
  const weightLb = Number(exercise.recommended_weight ?? exercise.cycle_adjusted_weight ?? exercise.calculated_weight ?? exercise.baseline_weight ?? 0)
  const weight = isBodyweightExercise(exercise) || !Number.isFinite(weightLb) ? 0 : Math.max(0, Math.round(weightLb * factor * 10)/10)
  const explicitIncrement = Number(exercise.weight_increment ?? exercise.equipment_increment)
  const increment = explicitIncrement > 0 ? Math.round(explicitIncrement * factor * 1000)/1000 : unit === 'kg' ? 0.5 : weight < 5 ? 0.5 : weight < 20 ? 1 : 5
  return { kind, metric, prescribed: Number.isFinite(prescribed) ? prescribed : Number(timeMatch?.[1] || 0), sets: kind === 'strength' ? Math.max(1, Number(exercise.sets || 1)) : 1,
    weight: kind === 'strength' ? weight : 0, increment, unit, loadLabel: exercise.load_type === 'per_hand' ? 'per hand' : exercise.load_type === 'single_side' ? 'one side' : 'total weight' }
}

export function summarizeActivityUnits(exercises: any[], actual = false) {
  return exercises.reduce((total, exercise) => {
    const dose = activityDose(exercise)
    if (actual && !exercise.completed && !exercise.set_logs?.length) return total
    if (dose.kind === 'strength') {
      const sets = actual ? (exercise.set_logs || []) : null
      total.sets += actual ? sets.length : dose.sets
      total.reps += actual ? sets.reduce((sum: number, set: any) => sum + Number(set.reps || 0), 0) : dose.prescribed * dose.sets
    } else if (dose.metric === 'minutes' || dose.metric === 'seconds') {
      // Old records keep their stored unit; never reinterpret minutes as reps.
      const unit = actual ? exercise.duration_unit || dose.metric : dose.metric
      total.minutes += Number(actual ? exercise.actual_duration || 0 : dose.prescribed) / (unit === 'seconds' ? 60 : 1)
    } else if (dose.metric === 'breaths') total.breaths += Number(actual ? exercise.actual_breaths ?? exercise.actual_reps ?? 0 : dose.prescribed)
    else total.activities += actual ? Number(exercise.completed === true) : 1
    return total
  }, { sets: 0, reps: 0, minutes: 0, breaths: 0, activities: 0 })
}

export function isConfirmedActivity(log: any) {
  if (!log || log.skipped || !log.completed) return false
  const dose = activityDose(log)
  if (dose.kind === 'strength') return Array.isArray(log.set_logs) && log.set_logs.length >= dose.sets && log.set_logs.every((set: any) => Number.isInteger(Number(set.reps)) && Number(set.reps) > 0 && Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0 && Number.isFinite(new Date(set.completed_at).getTime()))
  if (!Number.isFinite(new Date(log.confirmed_at).getTime())) return false
  if (dose.metric === 'completion') return log.activity_completed === true
  const value = Number(dose.metric === 'breaths' ? log.actual_breaths ?? log.actual_reps : log.actual_duration)
  return value > 0 && Number.isFinite(value) && (dose.metric !== 'breaths' || Number.isInteger(value)) && (dose.metric === 'breaths' || log.duration_unit === dose.metric)
}
export function workoutCompletion(logs: any[]) {
  const complete = logs.filter(log => log.completed === true).length
  const skipped = logs.filter(log => log.skipped === true).length
  const partial = logs.filter(log => !log.completed && !log.skipped && (log.set_logs?.length || Number(log.actual_duration || log.actual_breaths || log.actual_reps) > 0)).length
  return { complete, skipped, partial, total: logs.length, completed: logs.length > 0 && complete === logs.length }
}
// Existing readiness reads reps per set and pounds. Keep that contract while
// retaining each confirmed set and its original unit for performance history.
export function summarizeStrengthSets(sets: Array<{reps: number; weight: number; weight_unit?: string}>) {
  const totalReps = sets.reduce((sum, set) => sum + Number(set.reps), 0)
  return {
    actual_reps: sets.length ? totalReps / sets.length : 0,
    actual_total_reps: totalReps,
    actual_weight: sets.length ? sets.reduce((sum, set) => sum + Number(set.weight) * (set.weight_unit === 'kg' ? 2.2046226218 : 1), 0) / sets.length : 0,
    actual_weight_unit: 'lb',
  }
}
