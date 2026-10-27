export const strengthMovements = [
  ['shoulder_press', 'Shoulder Press', 'upper'],
  ['bench_press', 'Bench Press', 'upper'],
  ['close_grip_press', 'Close Grip Press', 'upper'],
  ['seated_row', 'Seated Row', 'upper'],
  ['bicep_curl', 'Bicep Curl', 'upper'],
  ['lateral_raise', 'Lateral Raise', 'upper'],
  ['squat', 'Squat', 'lower'],
  ['romanian_deadlift', 'Romanian Deadlift', 'lower'],
] as const

export type StrengthFormHistory = {
  completedAt: string | null
  values: Record<string, string>
  unavailable: boolean
}

function positiveNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? String(number) : ''
}

export function strengthFormDefaults(client: any, history: StrengthFormHistory) {
  // Height is a profile detail; performance always starts blank. Historical
  // height belongs to the same verified member as the completed assessment.
  const defaults: Record<string, string> = {
    program: client.program || '', email: client.email || '', fullName: client.full_name || '',
    client_id: client.client_id || '', birthdate: client.birthdate || '',
    height_in: positiveNumber(client.height_in) || positiveNumber(history.values.height_in),
    weight: '', weight_goal: '', training_environment: '', plank_time: '',
  }
  for (const [key] of strengthMovements) {
    defaults[`${key}_weight`] = ''
    defaults[`${key}_reps`] = ''
  }
  return defaults
}

export async function getStrengthFormHistory(supabase: any, client: any, now = new Date()): Promise<StrengthFormHistory> {
  const empty = { completedAt: null, values: {}, unavailable: false }
  if (!client?.client_id || !client?.auth_user_id) return { ...empty, unavailable: true }
  try {
    // The existing assessments table contains final strength submissions.
    // Draft sessions (including the unmerged draft architecture) are not read.
    const { data, error } = await supabase.from('assessments')
      .select('submitted_at,data').eq('client_id', client.client_id)
      .eq('auth_user_id', client.auth_user_id).eq('assessment_type', 'strength')
      .lte('submitted_at', now.toISOString()).order('submitted_at', { ascending: false })
      .limit(1).maybeSingle()
    if (error) return { ...empty, unavailable: true }
    if (!data) return empty
    if (!Number.isFinite(Date.parse(data.submitted_at)) || Date.parse(data.submitted_at) > now.getTime()
      || !data.data || typeof data.data !== 'object' || Array.isArray(data.data)
      || data.data.status === 'draft') return { ...empty, unavailable: true }
    const keys = ['height_in', 'plank_time', ...strengthMovements.flatMap(([key]) => [`${key}_weight`, `${key}_reps`])]
    const values: Record<string, string> = {}
    for (const key of keys) {
      const value = data.data[key]
      if (value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0) {
        values[key] = String(Number(value))
      }
    }
    return { completedAt: data.submitted_at, values, unavailable: false }
  } catch { return { ...empty, unavailable: true } }
}
