import { addLocalDays, getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { loadWorkoutHistory, workoutLocalDate } from '@/lib/workout/history'

export type ProgressRange = '4w' | '12w' | 'all'
export type ProgressPoint = { date: string; value: number }
type ReadResult = { data: any[] | null; error?: unknown }
export type ProgressSeries = { label: string; unit: string; points: ProgressPoint[]; unavailable: boolean; capped: boolean }
export type ProgressOverviewData = {
  range: ProgressRange; periodLabel: string; completedSessions: number | null; workoutsCapped: boolean
  strength: ProgressSeries; body: ProgressSeries; energy: ProgressSeries
  consistency: Array<{ label: string; start: string; end: string; count: number }>
}
const limit = 500
export function progressRange(value: unknown): ProgressRange { return value === '12w' || value === 'all' ? value : '4w' }
function number(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string' || typeof value === 'string' && !value.trim()) return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
function date(value: unknown) {
  const day = typeof value === 'string' ? value.slice(0, 10) : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day ? day : ''
}
function ordered(points: ProgressPoint[]) { return points.sort((a, b) => a.date.localeCompare(b.date)) }
function workoutDate(row: any, timeZone: string) { try { return date(workoutLocalDate(row, timeZone)) } catch { return '' } }
function series(result: ReadResult, label: string, unit: string, points: ProgressPoint[]): ProgressSeries {
  return { label, unit, points: ordered(points), unavailable: Boolean(result.error) || !Array.isArray(result.data), capped: (result.data?.length || 0) >= limit }
}

export function buildProgressOverview({ range, today, timeZone, workouts, measurements, recovery }: {
  range: ProgressRange; today: string; timeZone: string; workouts: ReadResult; measurements: ReadResult; recovery: ReadResult
}): ProgressOverviewData {
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const inRange = (day: string) => Boolean(day) && day >= start && day <= today
  const workoutRows = (workouts.error ? [] : workouts.data || []).filter(row => inRange(workoutDate(row, timeZone)))
  const completed = workoutRows.filter(row => row.completed === true)
  const loads = new Map<string, { label: string; unit: string; dates: Map<string, number> }>()
  for (const row of workoutRows) for (const exercise of Array.isArray(row.exercise_logs) ? row.exercise_logs : []) {
    const label = String(exercise.display_name || exercise.exercise || '').trim()
    if (!label) continue
    // Only recorded loads: prescriptions and suggested weights are never progress.
    const sets = Array.isArray(exercise.set_logs) && exercise.set_logs.length ? exercise.set_logs
      : exercise.completed === true ? [{ weight: exercise.actual_weight, reps: exercise.actual_reps, weight_unit: exercise.actual_weight_unit }] : []
    for (const set of sets) {
      const value = number(set.weight), reps = number(set.reps), unit = set.weight_unit || exercise.actual_weight_unit
      if (value === null || value < 0 || reps === null || reps <= 0 || !['lb', 'kg'].includes(unit)) continue
      const key = JSON.stringify([label, unit, exercise.selected_variant_id || exercise.selected_variant_name || '', exercise.selected_equipment || '', exercise.load_type || ''])
      const group = loads.get(key) || { label, unit, dates: new Map<string, number>() }
      const day = workoutDate(row, timeZone)
      group.dates.set(day, Math.max(value, group.dates.get(day) ?? value))
      loads.set(key, group)
    }
  }
  const strongestHistory = [...loads.values()].sort((a, b) => b.dates.size - a.dates.size || [...b.dates.keys()].sort().at(-1)!.localeCompare([...a.dates.keys()].sort().at(-1)!))[0]
  const strength = series(workouts, strongestHistory?.label || 'Recorded set load', strongestHistory?.unit || '', strongestHistory ? [...strongestHistory.dates].map(([day, value]) => ({ date: day, value })) : [])
  const measurementRows = (measurements.error ? [] : measurements.data || []).filter(row => inRange(date(row.log_date)))
  const bodyOptions = [['waist', 'Waist', 'in'], ['weight', 'Weight', 'lb']] as const
  const bodyHistories = bodyOptions.map(([key, label, unit]) => {
    const points = new Map<string, number>()
    for (const row of measurementRows) { const value = number(row.measurements?.[key]); if (value !== null && value > 0 && !points.has(date(row.log_date))) points.set(date(row.log_date), value) }
    return { label, unit, points: [...points].map(([day, value]) => ({ date: day, value })) }
  })
  const selectedBody = bodyHistories.find(item => item.points.length >= 2) || bodyHistories.find(item => item.points.length) || bodyHistories[0]
  const body = series(measurements, selectedBody.label, selectedBody.unit, selectedBody.points)
  const energyPoints = new Map<string, number>()
  for (const row of recovery.error ? [] : recovery.data || []) {
    const day = date(row.log_date), value = number(row.energy_level)
    if (inRange(day) && value !== null && value >= 1 && value <= 10 && !energyPoints.has(day)) energyPoints.set(day, value)
  }
  const energy = series(recovery, 'Energy', '/10', [...energyPoints].map(([day, value]) => ({ date: day, value })))
  const unavailable = Boolean(workouts.error) || !Array.isArray(workouts.data)
  const firstDay = start || completed.map(row => workoutDate(row, timeZone)).sort()[0] || today
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) / 86400000) + 1
  const buckets = range === '4w' ? 4 : range === '12w' ? 12 : Math.min(8, days)
  const consistency = unavailable ? [] : Array.from({ length: buckets }, (_, index) => {
    const from = addLocalDays(firstDay, Math.floor(index * days / buckets))
    const until = addLocalDays(firstDay, Math.floor((index + 1) * days / buckets))
    return { label: range === 'all' ? String(index + 1) : `W${index + 1}`, start: from, end: addLocalDays(until, -1), count: completed.filter(row => { const day = workoutDate(row, timeZone); return day >= from && day < until }).length }
  })
  return { range, periodLabel: range === 'all' ? 'All recorded history' : `Last ${range === '12w' ? 12 : 4} weeks`, completedSessions: unavailable ? null : completed.length, workoutsCapped: (workouts.data?.length || 0) >= limit, strength, body, energy, consistency }
}

export async function loadProgressOverview({ supabase, client, userId, range }: { supabase: any; client: any; userId: string; range: ProgressRange }) {
  const today = getClientLocalDate(client), start = range === 'all' ? null : addLocalDays(today, range === '12w' ? -83 : -27)
  const read = async (operation: () => PromiseLike<ReadResult>): Promise<ReadResult> => { try { return await operation() } catch { return { data: null, error: true } } }
  const [workouts, measurements, recovery] = await Promise.all([
    read(() => loadWorkoutHistory({ supabase, client, authUserId: userId, startDate: start || today, endDateExclusive: addLocalDays(today, 1), allHistory: range === 'all', limit })),
    read(() => { let query = supabase.from('measurement_logs').select('log_date,measurements').eq('client_id', client.client_id).lte('log_date', today); if (start) query = query.gte('log_date', start); return query.order('log_date', { ascending: false }).limit(limit) }),
    read(() => { let query = supabase.from('recovery_logs').select('log_date,energy_level').eq('client_id', client.client_id).lte('log_date', today); if (start) query = query.gte('log_date', start); return query.order('log_date', { ascending: false }).limit(limit) }),
  ])
  return buildProgressOverview({ range, today, timeZone: getClientTimeZone(client), workouts, measurements, recovery })
}
