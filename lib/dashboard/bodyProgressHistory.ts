import 'server-only'
import { createHash } from 'node:crypto'
import { getProgressPhotoComparison, type PhotoComparison } from '@/lib/assessment/photoComparison'
import { membershipCan } from '@/lib/membership/policy'
import { addLocalDays, getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { progressRange, type ProgressRange } from './progressOverview'

// This is the saved measurement form's allowlist. Units describe recorded values;
// history never estimates body fat or converts one measurement into another.
export const bodyMeasurementFields = [
  { key: 'weight', label: 'Measured Body Weight', unit: 'lb' },
  { key: 'bust_chest', label: 'Bust / Chest', unit: 'in' },
  { key: 'underbust', label: 'Underbust', unit: 'in' },
  { key: 'left_upper_arm', label: 'Left Upper Arm', unit: 'in' },
  { key: 'right_upper_arm', label: 'Right Upper Arm', unit: 'in' },
  { key: 'left_forearm', label: 'Left Forearm', unit: 'in' },
  { key: 'right_forearm', label: 'Right Forearm', unit: 'in' },
  { key: 'shoulders', label: 'Shoulders', unit: 'in' },
  { key: 'neck', label: 'Neck', unit: 'in' },
  { key: 'waist', label: 'Waist', unit: 'in' },
  { key: 'hips_glutes', label: 'Hips / Glutes', unit: 'in' },
  { key: 'left_thigh', label: 'Left Thigh', unit: 'in' },
  { key: 'right_thigh', label: 'Right Thigh', unit: 'in' },
  { key: 'left_calf', label: 'Left Calf', unit: 'in' },
  { key: 'right_calf', label: 'Right Calf', unit: 'in' },
  { key: 'lower_waist', label: 'Lower Waist / Lower Abdomen', unit: 'in' },
  { key: 'high_hip', label: 'High Hip', unit: 'in' },
  { key: 'left_triceps_skinfold_mm', label: 'Left Triceps Skinfold', unit: 'mm' },
  { key: 'right_triceps_skinfold_mm', label: 'Right Triceps Skinfold', unit: 'mm' },
  { key: 'left_biceps_skinfold_mm', label: 'Left Biceps Skinfold', unit: 'mm' },
  { key: 'right_biceps_skinfold_mm', label: 'Right Biceps Skinfold', unit: 'mm' },
  { key: 'abdominal_skinfold_mm', label: 'Abdominal Skinfold', unit: 'mm' },
  { key: 'suprailiac_skinfold_mm', label: 'Suprailiac Skinfold', unit: 'mm' },
  { key: 'left_thigh_skinfold_mm', label: 'Left Thigh Skinfold', unit: 'mm' },
  { key: 'right_thigh_skinfold_mm', label: 'Right Thigh Skinfold', unit: 'mm' },
  { key: 'left_calf_skinfold_mm', label: 'Left Calf Skinfold', unit: 'mm' },
  { key: 'right_calf_skinfold_mm', label: 'Right Calf Skinfold', unit: 'mm' },
  { key: 'left_quad_sweep', label: 'Left Quad Sweep', unit: 'in' },
  { key: 'right_quad_sweep', label: 'Right Quad Sweep', unit: 'in' },
  { key: 'left_glute_fold', label: 'Left Glute Fold', unit: 'in' },
  { key: 'right_glute_fold', label: 'Right Glute Fold', unit: 'in' },
  { key: 'height', label: 'Height', unit: 'in' },
  { key: 'left_shoulder_to_elbow', label: 'Left Shoulder to Elbow', unit: 'in' },
  { key: 'right_shoulder_to_elbow', label: 'Right Shoulder to Elbow', unit: 'in' },
  { key: 'left_elbow_to_wrist', label: 'Left Elbow to Wrist', unit: 'in' },
  { key: 'right_elbow_to_wrist', label: 'Right Elbow to Wrist', unit: 'in' },
  { key: 'left_hip_to_knee', label: 'Left Hip to Knee', unit: 'in' },
  { key: 'right_hip_to_knee', label: 'Right Hip to Knee', unit: 'in' },
  { key: 'left_knee_to_ankle', label: 'Left Knee to Ankle', unit: 'in' },
  { key: 'right_knee_to_ankle', label: 'Right Knee to Ankle', unit: 'in' },
  { key: 'ribcage', label: 'Ribcage', unit: 'in' },
  { key: 'torso_length', label: 'Torso Length', unit: 'in' },
  { key: 'inseam', label: 'Inseam', unit: 'in' },
] as const

export type BodyMeasurementKey = typeof bodyMeasurementFields[number]['key']
export type BodyMeasurementValue = { status: 'recorded' | 'missing' | 'invalid'; value: number | null }
export type BodyHistoryRow = { key: string; date: string; values: Record<BodyMeasurementKey, BodyMeasurementValue> }
export type BodyProgressHistoryData = {
  range: ProgressRange; periodLabel: string; today: string; timeZone: string
  unavailable: boolean; capped: boolean; invalidCount: number; ambiguousDateCount: number; ambiguousDates: string[]
  fields: typeof bodyMeasurementFields; rows: BodyHistoryRow[]
  comparison: PhotoComparison | null; photosAllowed: boolean
}
export class BodyProgressAccessError extends Error {
  readonly status = 403
  constructor() { super('Measurement history is unavailable for this account.'); this.name = 'BodyProgressAccessError' }
}

const displayLimit = 500
function civilDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const instant = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value ? value : ''
}
function measurementValue(value: unknown): BodyMeasurementValue {
  if (value === undefined || value === null || typeof value === 'string' && !value.trim()) return { status: 'missing', value: null }
  // JSON numeric values and ordinary numeric input strings are supported. Object,
  // boolean, hexadecimal and unit-bearing strings are never recorded numbers.
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))) return { status: 'invalid', value: null }
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? { status: 'recorded', value: numeric } : { status: 'invalid', value: null }
}

export async function loadBodyProgressHistory({ supabase, userId, client, range: requestedRange, now = new Date() }: {
  supabase: any; userId: string; client: any; range: ProgressRange; now?: Date
}): Promise<BodyProgressHistoryData> {
  if (!userId || !client?.client_id || client.auth_user_id !== userId || !Number.isFinite(now.getTime())
    || !['generatedCoaching', 'progressView', 'assessmentsView'].every(capability => membershipCan(client, capability as 'generatedCoaching' | 'progressView' | 'assessmentsView', now))) throw new BodyProgressAccessError()
  const range = progressRange(requestedRange), today = getClientLocalDate(client, now), timeZone = getClientTimeZone(client)
  const start = range === 'all' ? null : addLocalDays(today, range === '12w' ? -83 : -27)
  const photosAllowed = membershipCan(client, 'assessmentPhotoUpload', now)
  const readMeasurements = async () => {
    try {
      let query = supabase.from('measurement_logs').select('client_id,auth_user_id,log_date,measurements,updated_at')
        .eq('client_id', client.client_id).eq('auth_user_id', userId).lte('log_date', today)
        .order('log_date', { ascending: false }).order('updated_at', { ascending: false }).limit(displayLimit + 1)
      if (start) query = query.gte('log_date', start)
      const result = await query
      return result.error || !Array.isArray(result.data) ? { data: [], unavailable: true } : { data: result.data, unavailable: false }
    } catch { return { data: [], unavailable: true } }
  }
  const [measurements, comparison] = await Promise.all([
    readMeasurements(), photosAllowed ? getProgressPhotoComparison(supabase, client, now) : Promise.resolve(null),
  ])
  const result: BodyProgressHistoryData = {
    range, periodLabel: range === 'all' ? 'All-time range' : `Last ${range === '12w' ? 12 : 4} weeks`, today, timeZone,
    unavailable: measurements.unavailable, capped: measurements.data.length > displayLimit, invalidCount: 0, ambiguousDateCount: 0, ambiguousDates: [],
    fields: bodyMeasurementFields, rows: [], comparison, photosAllowed,
  }
  // The canonical-owner filters are also verified after the read. A mismatched
  // source response is unavailable rather than a partial cross-account history.
  if (measurements.data.some((row: any) => row?.client_id !== client.client_id || row?.auth_user_id !== userId)) {
    return { ...result, unavailable: true, invalidCount: 1 }
  }
  const prepared: Array<BodyHistoryRow & { updated: string; digest: string }> = []
  for (const row of measurements.data.slice(0, displayLimit + 1)) {
    const date = civilDate(row.log_date)
    if (!date || date > today) { result.invalidCount++; continue }
    if (start && date < start) continue
    const validMap = row.measurements !== null && typeof row.measurements === 'object' && !Array.isArray(row.measurements)
    const values = Object.fromEntries(bodyMeasurementFields.map(field => {
      const value = validMap ? measurementValue(row.measurements[field.key]) : { status: 'invalid' as const, value: null }
      if (value.status === 'invalid') result.invalidCount++
      return [field.key, value]
    })) as BodyHistoryRow['values']
    const updated = typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at)) ? new Date(row.updated_at).toISOString() : ''
    if (!updated) result.invalidCount++
    // Opaque per-record tokens contain no owner IDs, notes or arbitrary metadata.
    const digest = createHash('sha256').update(JSON.stringify([date, updated, values])).digest('hex').slice(0, 24)
    prepared.push({ key: '', date, values, updated, digest })
  }
  prepared.sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated) || a.digest.localeCompare(b.digest))
  const dateCounts = new Map<string, number>(), tokenCounts = new Map<string, number>()
  for (const row of prepared) dateCounts.set(row.date, (dateCounts.get(row.date) || 0) + 1)
  // Include the sentinel when identifying ambiguous dates. A displayed boundary
  // row must not look unique merely because its conflicting row is beyond 500.
  result.ambiguousDates = [...dateCounts].filter(([, count]) => count > 1).map(([date]) => date)
  result.ambiguousDateCount = result.ambiguousDates.length
  result.rows = prepared.slice(0, displayLimit).map(({ date, values, digest }) => {
    const occurrence = (tokenCounts.get(digest) || 0) + 1
    tokenCounts.set(digest, occurrence)
    return { key: `${digest}-${occurrence}`, date, values }
  })
  return result
}
