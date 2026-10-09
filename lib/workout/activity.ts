export type ActivityKind = 'strength' | 'cardio' | 'breathing' | 'mobility'
export type ActivityDose = { kind: ActivityKind; metric: 'reps' | 'breaths' | 'minutes' | 'seconds'; prescribed: number; sets: number; weight: number; increment: number; unit: 'lb' | 'kg'; loadLabel: string }
export function activityDose(exercise: any, preferredUnit: 'lb' | 'kg' = 'lb'): ActivityDose {
  const name = String(exercise.display_name || exercise.name || exercise.exercise || '').toLowerCase()
  const metadata = `${exercise.exercise_category || exercise.category || ''} ${exercise.movement_type || exercise.type || ''}`.toLowerCase()
  const text = `${metadata} ${name}`
  const kind: ActivityKind = /breath/.test(text) ? 'breathing' : /cardio|walking|walk|cycling|easy bike|swim|running|treadmill/.test(text) ? 'cardio' : /mobility|stretch|yoga|recovery_flow/.test(text) ? 'mobility' : 'strength'
  const label = String(exercise.duration_label || exercise.reps || '')
  const duration = Number(exercise.duration_minutes || exercise.duration_seconds || 0)
  const timeMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:-\s*\d+\s*)?(min|sec|breath)/i)
  const metric = kind === 'strength' ? 'reps' : timeMatch?.[2]?.startsWith('breath') ? 'breaths' : exercise.duration_seconds || timeMatch?.[2]?.startsWith('sec') ? 'seconds' : duration || timeMatch || kind === 'cardio' ? 'minutes' : kind === 'breathing' ? 'breaths' : 'reps'
  const prescribed = metric === 'reps' || metric === 'breaths' ? Number(exercise.recommended_reps ?? exercise.reps ?? exercise.target_reps ?? timeMatch?.[1] ?? 0) : duration || Number(timeMatch?.[1] || 0)
  const unit = preferredUnit
  const sourceUnit = exercise.weight_unit === 'kg' ? 'kg' : 'lb'
  const factor = unit === sourceUnit ? 1 : unit === 'kg' ? 1/2.2046226218 : 2.2046226218
  const weightLb = Number(exercise.recommended_weight ?? exercise.cycle_adjusted_weight ?? exercise.calculated_weight ?? 0)
  const weight = Math.round(weightLb * factor * 10)/10
  const explicitIncrement = Number(exercise.weight_increment ?? exercise.equipment_increment)
  const increment = explicitIncrement > 0 ? Math.round(explicitIncrement * factor * 1000)/1000 : unit === 'kg' ? 0.5 : weight < 5 ? 0.5 : weight < 20 ? 1 : 5
  return { kind, metric, prescribed: Number.isFinite(prescribed) ? prescribed : Number(timeMatch?.[1] || 0), sets: kind === 'strength' ? Math.max(1, Number(exercise.sets || 1)) : 1,
    weight: kind === 'strength' ? weight : 0, increment, unit, loadLabel: exercise.load_type === 'per_hand' ? 'per hand' : exercise.load_type === 'single_side' ? 'one side' : 'total weight' }
}
export function workoutCompletion(logs: any[]) {
  const complete = logs.filter(log => log.completed === true).length
  const skipped = logs.filter(log => log.skipped === true).length
  const partial = logs.filter(log => !log.completed && !log.skipped && (log.set_logs?.length || Number(log.actual_duration || log.actual_reps) > 0)).length
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
