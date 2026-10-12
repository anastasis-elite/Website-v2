export function exerciseOccurrenceLabel(exercises: any[], index: number): string {
  const nameOf = (exercise: any) => String(exercise.selected_variant_name || exercise.display_name || exercise.exercise || exercise.name || 'Exercise')
  const name = nameOf(exercises[index])
  const matches = exercises.map(nameOf).filter(value => value.toLowerCase() === name.toLowerCase()).length
  if (matches < 2) return name
  const occurrence = exercises.slice(0, index + 1).map(nameOf).filter(value => value.toLowerCase() === name.toLowerCase()).length
  return `${name} · ${occurrence} of ${matches}`
}

export function parseStrengthSetInput(weight: string | number, reps: string | number) {
  const parsedWeight = typeof weight === 'string' && !weight.trim() ? NaN : Number(weight)
  const parsedReps = typeof reps === 'string' && !reps.trim() ? NaN : Number(reps)
  if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || !Number.isInteger(parsedReps) || parsedReps <= 0) return null
  return { weight: parsedWeight, reps: parsedReps }
}

export function manualSetStorageKey(clientId: string, program: string, exercise: any, date: string) {
  return `aos-manual-sets:v2:${clientId}:${program}:${exercise.id || exercise.exercise || exercise.name}:${exercise.selected_variant_id || 'prescribed'}:${date}`
}

export function formatWorkoutHistoryDate(value: string | undefined, timezone = 'America/Chicago') {
  if (!value) return 'Workout'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value)
  if (!Number.isFinite(date.getTime())) return 'Workout'
  return date.toLocaleDateString('en-US', { timeZone: dateOnly ? 'UTC' : timezone, month: 'short', day: 'numeric' })
}
