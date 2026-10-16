export const STRENGTH_LIFTS = ['shoulder_press', 'squat', 'bench_press', 'close_grip_press', 'romanian_deadlift', 'seated_row', 'bicep_curl', 'lateral_raise'] as const
export const STRENGTH_FIELDS = ['birthdate', 'height_in', 'weight', 'weight_goal', 'training_environment', ...STRENGTH_LIFTS.flatMap(lift => [`${lift}_weight`, `${lift}_reps`]), 'plank_time', 'notes'] as const
export type StrengthValues = Record<string, string>
export type SavedStrengthAssessment = { status: 'draft' | 'completed'; period: string; values: StrengthValues; revision: number; savedAt: string; completedAt: string | null; assessmentDate: string | null; assessmentId: string | null }

// Preserve incomplete strings in drafts. Trusted identity fields come from auth.
export function strengthValues(input: unknown): StrengthValues | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const result: StrengthValues = {}, values = input as Record<string, unknown>
  for (const field of STRENGTH_FIELDS) {
    const value = values[field]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string' && typeof value !== 'number') return null
    if (typeof value === 'number' && !Number.isFinite(value)) return null
    result[field] = String(value)
    if (result[field].length > (field === 'notes' ? 5000 : 100)) return null
  }
  return result
}

export function validateStrengthCompletion(values: StrengthValues): string | null {
  if (!values.weight?.trim() || !values.height_in?.trim() || !Number.isFinite(Number(values.weight)) || Number(values.weight) <= 0 || Number(values.weight) > 1500 || !Number.isFinite(Number(values.height_in)) || Number(values.height_in) <= 0 || Number(values.height_in) > 120) return 'Enter your current weight in pounds and height in inches before completing your assessment.'
  for (const lift of STRENGTH_LIFTS) {
    const weight = values[`${lift}_weight`]?.trim() || '', reps = values[`${lift}_reps`]?.trim() || ''
    if ((weight || reps) && (!weight || !reps || !Number.isFinite(Number(weight)) || Number(weight) < 0 || Number(weight) > 3000 || !Number.isInteger(Number(reps)) || Number(reps) < 1 || Number(reps) > 100)) return 'For each strength test you record, enter a nonnegative load and a whole-number repetition count from 1 to 100. Leave untested movements blank.'
  }
  if (values.plank_time?.trim() && (!Number.isFinite(Number(values.plank_time)) || Number(values.plank_time) < 0 || Number(values.plank_time) > 86400)) return 'Enter a valid nonnegative plank time in seconds, or leave it blank.'
  return null
}

export function savedStrengthSession(row: any): SavedStrengthAssessment {
  return { status: row.status, period: row.period, values: strengthValues(row.values) || {}, revision: Number(row.revision), savedAt: row.saved_at, completedAt: row.completed_at, assessmentDate: row.completed_at, assessmentId: row.assessment_id || null }
}

export function savedLegacyStrength(row: any, period: string): SavedStrengthAssessment {
  return { status: 'completed', period, values: strengthValues(row.data) || {}, revision: 0, savedAt: row.submitted_at, completedAt: row.submitted_at, assessmentDate: row.submitted_at, assessmentId: row.id }
}
