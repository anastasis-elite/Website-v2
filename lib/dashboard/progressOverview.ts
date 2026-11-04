import 'server-only'
import { membershipCan } from '@/lib/membership/policy'
import { isValidCompletedSet } from '@/lib/workout/activity'
import { addLocalDays, getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { loadWorkoutHistory, workoutLocalDate } from '@/lib/workout/history'

export type ProgressRange = '4w' | '12w' | 'all'
export type ProgressPoint = { date: string; value: number }
type ReadResult = { data: any[] | null; error?: unknown; sourceCapped?: boolean }
export type ProgressSeries = { label: string; unit: string; points: ProgressPoint[]; unavailable: boolean; capped: boolean }
export type ProgressOverviewData = {
  range: ProgressRange; periodLabel: string; completedSessions: number | null; workoutsCapped: boolean
  strength: ProgressSeries; body: ProgressSeries; energy: ProgressSeries
  consistency: Array<{ label: string; start: string; end: string; count: number }>
}
const limit = 500
export function progressRange(value: unknown): ProgressRange { return value === '12w' || value === 'all' ? value : '4w' }
function number(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))) return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
function date(value: unknown) {
  const day = typeof value === 'string' ? value.slice(0, 10) : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day ? day : ''
}
function ordered(points: ProgressPoint[]) { return points.sort((a, b) => a.date.localeCompare(b.date)) }
function dailyPoints(points: ProgressPoint[]) {
  const dates = new Map<string, Set<number>>()
  for (const point of points) { const values = dates.get(point.date) || new Set<number>(); values.add(point.value); dates.set(point.date, values) }
  // Repeated identical snapshots are harmless. Conflicting saved values on one
  // day have no uniquely supported daily value and remain in their drill-down.
  return [...dates].filter(([, values]) => values.size === 1).map(([date, values]) => ({ date, value: [...values][0] }))
}
function workoutDate(row: any, timeZone: string) { try { return date(workoutLocalDate(row, timeZone)) } catch { return '' } }
function capped(result: ReadResult) { return Boolean(result.sourceCapped) || (result.data?.length || 0) > limit }
function rows(result: ReadResult): any[] { return !result.error && Array.isArray(result.data) ? result.data.slice(0, limit) : [] }
function series(result: ReadResult, label: string, unit: string, points: ProgressPoint[]): ProgressSeries {
  return { label, unit, points: ordered(points), unavailable: Boolean(result.error) || !Array.isArray(result.data), capped: capped(result) }
}
function uniqueWorkouts(records: any[]) {
  const saved = new Map<string, any>(), withoutId: any[] = []
  for (const row of records) {
    if (!row || typeof row !== 'object') continue
    // Different sessions on the same date remain separate. Repeated snapshots
    // of a saved session count once, using its latest recorded update.
    if (typeof row.id !== 'string' || !row.id) { withoutId.push(row); continue }
    const previous = saved.get(row.id)
    if (!previous || String(row.updated_at || '') > String(previous.updated_at || '')) saved.set(row.id, row)
  }
  return [...saved.values(), ...withoutId]
}

export function buildProgressOverview({ range, today, timeZone, workouts, measurements, recovery }: {
  range: ProgressRange; today: string; timeZone: string; workouts: ReadResult; measurements: ReadResult; recovery: ReadResult
}): ProgressOverviewData {
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const inRange = (day: string) => Boolean(day) && day >= start && day <= today
  const workoutRows = uniqueWorkouts(rows(workouts)).filter(row => inRange(workoutDate(row, timeZone)))
  const completed = workoutRows.filter(row => row.completed === true)
  const loads = new Map<string, { label: string; unit: string; dates: Map<string, number> }>()
  for (const row of workoutRows) for (const exercise of Array.isArray(row.exercise_logs) ? row.exercise_logs.slice(0, 100) : []) {
    if (!exercise || typeof exercise !== 'object' || exercise.skipped === true) continue
    const label = String(exercise.display_name || exercise.exercise || '').trim()
    if (!label) continue
    // Only recorded loads: prescriptions and suggested weights are never progress.
    const confirmedSets = Array.isArray(exercise.set_logs)
    const sets = confirmedSets ? exercise.set_logs.slice(0, 100).filter(isValidCompletedSet)
      : exercise.completed === true ? [{ weight: exercise.actual_weight, reps: exercise.actual_reps, weight_unit: exercise.actual_weight_unit }] : []
    for (const set of sets) {
      const value = number(set.weight), reps = number(set.reps), unit = set.weight_unit || exercise.actual_weight_unit
      if (value === null || value < 0 || reps === null || reps <= 0 || !['lb', 'kg'].includes(unit)) continue
      const key = JSON.stringify([label, unit, exercise.selected_variant_id || exercise.selected_variant_name || '', exercise.selected_equipment || '', exercise.load_type || '', confirmedSets ? 'confirmed_sets' : 'legacy_summary'])
      const group = loads.get(key) || { label, unit, dates: new Map<string, number>() }
      const day = workoutDate(row, timeZone)
      group.dates.set(day, Math.max(value, group.dates.get(day) ?? value))
      loads.set(key, group)
    }
  }
  const strongestHistory = [...loads.values()].sort((a, b) => b.dates.size - a.dates.size || [...b.dates.keys()].sort().at(-1)!.localeCompare([...a.dates.keys()].sort().at(-1)!))[0]
  const strength = series(workouts, strongestHistory?.label || 'Recorded set load', strongestHistory?.unit || '', strongestHistory ? [...strongestHistory.dates].map(([day, value]) => ({ date: day, value })) : [])
  const measurementRows = rows(measurements).filter(row => row && inRange(date(row.log_date)))
  const bodyOptions = [['waist', 'Waist', 'in'], ['weight', 'Weight', 'lb']] as const
  const bodyHistories = bodyOptions.map(([key, label, unit]) => {
    const points: ProgressPoint[] = []
    for (const row of measurementRows) { const value = number(row.measurements?.[key]); if (value !== null && value > 0) points.push({ date: date(row.log_date), value }) }
    return { label, unit, points: dailyPoints(points) }
  })
  const selectedBody = bodyHistories.find(item => item.points.length >= 2) || bodyHistories.find(item => item.points.length) || bodyHistories[0]
  const body = series(measurements, selectedBody.label, selectedBody.unit, selectedBody.points)
  const energyPoints: ProgressPoint[] = []
  for (const row of rows(recovery)) {
    if (!row || typeof row !== 'object') continue
    const day = date(row.log_date), value = number(row.energy_level)
    if (inRange(day) && value !== null && value >= 1 && value <= 10) energyPoints.push({ date: day, value })
  }
  const energy = series(recovery, 'Energy', '/10', dailyPoints(energyPoints))
  const unavailable = Boolean(workouts.error) || !Array.isArray(workouts.data)
  const firstDay = start || completed.map(row => workoutDate(row, timeZone)).sort()[0] || today
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) / 86400000) + 1
  const buckets = range === '4w' ? 4 : range === '12w' ? 12 : Math.min(8, days)
  const consistency = unavailable ? [] : Array.from({ length: buckets }, (_, index) => {
    const from = addLocalDays(firstDay, Math.floor(index * days / buckets))
    const until = addLocalDays(firstDay, Math.floor((index + 1) * days / buckets))
    return { label: range === 'all' ? String(index + 1) : `W${index + 1}`, start: from, end: addLocalDays(until, -1), count: completed.filter(row => { const day = workoutDate(row, timeZone); return day >= from && day < until }).length }
  })
  return { range, periodLabel: range === 'all' ? 'All-time range' : `Last ${range === '12w' ? 12 : 4} weeks`, completedSessions: unavailable ? null : completed.length, workoutsCapped: capped(workouts), strength, body, energy, consistency }
}

export function assertProgressOverviewAccess(userId: string, client: any, now = new Date()) {
  if (!userId || !client?.client_id || client.auth_user_id !== userId || !Number.isFinite(now.getTime()) ||
    !membershipCan(client, 'generatedCoaching', now) || !membershipCan(client, 'progressView', now) ||
    !membershipCan(client, 'trendsView', now) || !membershipCan(client, 'workoutLogging', now)) {
    throw new Error('Recorded progress is not available for this account.')
  }
}

export async function loadProgressOverview({ supabase, client, userId, range: requestedRange, now = new Date() }: { supabase: any; client: any; userId: string; range: ProgressRange; now?: Date }) {
  assertProgressOverviewAccess(userId, client, now)
  const range = progressRange(requestedRange), today = getClientLocalDate(client, now), start = range === 'all' ? null : addLocalDays(today, range === '12w' ? -83 : -27)
  const read = async (operation: () => PromiseLike<ReadResult>): Promise<ReadResult> => {
    try {
      const result = await operation()
      if (result.error || !Array.isArray(result.data) || result.data.some(row => !row || row.client_id !== client.client_id || row.auth_user_id !== userId)) return { data: null, error: true }
      return result
    } catch { return { data: null, error: true } }
  }
  const unavailable = { data: null, error: true }
  const [workouts, measurements, recovery] = await Promise.all([
    read(() => loadWorkoutHistory({ supabase, client, authUserId: userId, startDate: start || today, endDateExclusive: addLocalDays(today, 1), allHistory: range === 'all', limit: limit + 1, sourceLimit: limit + 1 })),
    membershipCan(client, 'assessmentsView', now) ? read(() => { let query = supabase.from('measurement_logs').select('client_id,auth_user_id,log_date,measurements,updated_at').eq('client_id', client.client_id).eq('auth_user_id', userId).lte('log_date', today); if (start) query = query.gte('log_date', start); return query.order('log_date', { ascending: false }).order('updated_at', { ascending: false }).limit(limit + 1) }) : Promise.resolve(unavailable),
    membershipCan(client, 'recoveryBasic', now) ? read(() => { let query = supabase.from('recovery_logs').select('client_id,auth_user_id,log_date,energy_level,updated_at').eq('client_id', client.client_id).eq('auth_user_id', userId).lte('log_date', today); if (start) query = query.gte('log_date', start); return query.order('log_date', { ascending: false }).order('updated_at', { ascending: false }).limit(limit + 1) }) : Promise.resolve(unavailable),
  ])
  return buildProgressOverview({ range, today, timeZone: getClientTimeZone(client), workouts, measurements, recovery })
}
