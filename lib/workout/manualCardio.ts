// These names already use the duration-based cardio path in activityDose.
// They are logging choices, with no duration or individualized prescription.
export const MANUAL_CARDIO_OPTIONS = [
  { id: 'walking', label: 'Walking' },
  { id: 'running', label: 'Running' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'treadmill', label: 'Treadmill' },
] as const

export const MANUAL_CARDIO_DAY_NAME = 'Manual Cardio'
export type ManualCardioId = typeof MANUAL_CARDIO_OPTIONS[number]['id']
export type ManualCardioUnit = 'minutes' | 'seconds'
export type ManualCardioExercise = {
  id: string
  session_key: string
  exercise: string
  exercise_category: 'cardio'
  manual_activity: 'cardio-duration-v1'
  manual_cardio_id: ManualCardioId
  duration_unit: ManualCardioUnit
}

const occurrence = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function createManualCardioExercise(id: ManualCardioId, unit: ManualCardioUnit, occurrenceId: string): ManualCardioExercise {
  const option = MANUAL_CARDIO_OPTIONS.find(item => item.id === id)
  if (!option || !['minutes', 'seconds'].includes(unit) || !occurrence.test(occurrenceId)) throw new Error('Choose a supported cardio activity and duration unit.')
  const key = `manual-cardio:${id}:${occurrenceId}`
  return { id: key, session_key: key, exercise: option.label, exercise_category: 'cardio',
    manual_activity: 'cardio-duration-v1', manual_cardio_id: id, duration_unit: unit }
}

export function isManualCardioExercise(value: any): value is ManualCardioExercise {
  if (!value || value.manual_activity !== 'cardio-duration-v1') return false
  const option = MANUAL_CARDIO_OPTIONS.find(item => item.id === value.manual_cardio_id)
  const prefix = `manual-cardio:${option?.id}:`
  return Boolean(option && value.exercise === option.label && value.exercise_category === 'cardio' &&
    ['minutes', 'seconds'].includes(value.duration_unit) && typeof value.id === 'string' &&
    value.id.startsWith(prefix) && occurrence.test(value.id.slice(prefix.length)) && value.session_key === value.id)
}

// A manual activity cannot supply founder guidance or a strength denominator.
const guidanceFields = ['prescription', 'prescription_snapshot', 'original_prescription', 'planned_sets', 'sets', 'reps', 'target_reps',
  'recommended_reps', 'baseline_reps', 'recommended_weight', 'calculated_weight', 'baseline_weight', 'cycle_adjusted_weight',
  'selected_variant_id', 'selected_variant_name', 'catalogExerciseId', 'equipment_context', 'duration_minutes', 'duration_seconds', 'duration_label']
export function canonicalManualCardioPlan(value: any): ManualCardioExercise | null {
  if (!isManualCardioExercise(value) || guidanceFields.some(field => (value as unknown as Record<string, unknown>)[field] !== undefined)) return null
  const prefix = `manual-cardio:${value.manual_cardio_id}:`
  return createManualCardioExercise(value.manual_cardio_id, value.duration_unit, value.id.slice(prefix.length))
}

export function canonicalManualCardioLog(value: any) {
  const plan = canonicalManualCardioPlan(value)
  if (!plan || value.set_logs !== undefined && (!Array.isArray(value.set_logs) || value.set_logs.length) ||
    ['actual_weight', 'actual_reps', 'actual_breaths'].some(field => value[field] !== undefined && value[field] !== 0) ||
    value.activity_completed !== undefined && value.activity_completed !== false ||
    typeof value.completed !== 'boolean' || typeof value.skipped !== 'boolean' || value.completed && value.skipped ||
    typeof value.actual_duration !== 'number' || !Number.isFinite(value.actual_duration) || value.actual_duration < 0) return null
  if (value.completed && (!(value.actual_duration > 0) || typeof value.confirmed_at !== 'string' || !Number.isFinite(Date.parse(value.confirmed_at)))) return null
  return { ...plan, completed: value.completed, skipped: value.skipped, actual_duration: value.actual_duration,
    ...(typeof value.confirmed_at === 'string' && Number.isFinite(Date.parse(value.confirmed_at)) ? { confirmed_at: value.confirmed_at } : {}),
    set_logs: [] }
}
