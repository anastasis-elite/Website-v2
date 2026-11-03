import 'server-only'

import { createHash } from 'node:crypto'
import { membershipCan } from '@/lib/membership/policy'
import { addLocalDays, getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { activityDose, isBodyweightExercise, isValidCompletedSet } from '@/lib/workout/activity'
import { loadWorkoutHistory, workoutLocalDate } from '@/lib/workout/history'
import { progressRange, type ProgressPoint, type ProgressRange } from './progressOverview'

const SOURCE_LIMIT = 500
const EXERCISE_LIMIT = 100
const SET_LIMIT = 100
const TOTAL_SET_LIMIT = 10000
const ENTRY_LIMIT = 2000
const SERIES_LIMIT = 200

export type StrengthHistorySeries = {
  id: string; label: string; unit: 'lb' | 'kg'; variant: string; equipment: string; loadType: string
  sourceKind: 'confirmed_sets' | 'legacy_summary'; points: ProgressPoint[]
}
export type StrengthHistorySession = {
  id: string; date: string; title: string; completed: boolean
  entries: Array<{ id: string; label: string; detail: string }>
}
export type StrengthProgressHistory = {
  range: ProgressRange; periodLabel: string; today: string; timeZone: string
  unavailable: boolean; capped: boolean; detailCapped: boolean; invalidCount: number
  series: StrengthHistorySeries[]; sessions: StrengthHistorySession[]
}

function text(value: unknown, maximum = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}
function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string' || typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
function civilDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
function context(exercise: any) {
  return {
    variant: text(exercise.selected_variant_name) || text(exercise.selected_variant_id),
    equipment: text(exercise.selected_equipment) || (typeof exercise.equipment === 'string' ? text(exercise.equipment) : ''),
    loadType: text(exercise.load_type),
  }
}
function contextLabel(loadType: string) {
  return ({ per_hand: 'per hand', single_side: 'one side', total_load: 'total load', bodyweight: 'bodyweight' } as Record<string, string>)[loadType] || 'load type not recorded'
}
function loadKind(exercise: any) {
  if (isBodyweightExercise(exercise)) return 'bodyweight'
  if (/assist|counterweight/i.test(`${text(exercise.load_type)} ${text(exercise.selected_variant_name)}`)) return 'assistance'
  return 'recorded'
}

export function assertStrengthProgressAccess(user: any, client: any, now = new Date()) {
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id ||
    !membershipCan(client, 'generatedCoaching', now) || !membershipCan(client, 'progressView', now) || !membershipCan(client, 'workoutLogging', now)) {
    throw new Error('Recorded workout progress is not available for this account.')
  }
}

/** Saved workout history only. No recommendation, prescription or denominator
 * is changed, and the canonical history helper retains recorded completion. */
export async function loadStrengthProgressHistory({ supabase, user, client, range: requestedRange, now = new Date() }: {
  supabase: any; user: any; client: any; range: ProgressRange; now?: Date
}): Promise<StrengthProgressHistory> {
  assertStrengthProgressAccess(user, client, now)
  const range = progressRange(requestedRange), today = getClientLocalDate(client, now), timeZone = getClientTimeZone(client)
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const empty: StrengthProgressHistory = { range, periodLabel: range === 'all' ? 'All-time range' : `Last ${range === '12w' ? 12 : 4} weeks`,
    today, timeZone, unavailable: false, capped: false, detailCapped: false, invalidCount: 0, series: [], sessions: [] }
  let history
  try {
    history = await loadWorkoutHistory({ supabase, client, authUserId: user.id, startDate: start || today,
      endDateExclusive: addLocalDays(today, 1), allHistory: range === 'all', limit: SOURCE_LIMIT + 1, sourceLimit: SOURCE_LIMIT + 1 })
  } catch { return { ...empty, unavailable: true } }
  if (history.error || !Array.isArray(history.data)) return { ...empty, unavailable: true }
  // Defense in depth against a mismatched reader/result. Ownership is never
  // inferred from labels, a request client id, or an email match.
  if (history.data.some((row: any) => row.client_id !== client.client_id || row.auth_user_id !== user.id)) return { ...empty, unavailable: true }
  const result: StrengthProgressHistory = { ...empty, capped: Boolean('sourceCapped' in history && history.sourceCapped) || history.data.length > SOURCE_LIMIT }
  const groups = new Map<string, StrengthHistorySeries & { dates: Map<string, number> }>()
  let entries = 0, sets = 0
  function addPoint(exercise: any, label: string, unit: 'lb' | 'kg', day: string, weight: number, sourceKind: StrengthHistorySeries['sourceKind']) {
    const extra = context(exercise)
    // Occurrence ids include session UUIDs. Only an explicit catalog identity
    // participates in the exercise group, alongside the recorded exact name.
    const identity = JSON.stringify([text(exercise.catalogExerciseId) || text(exercise.catalog_exercise_id) || text(exercise.prescription_verification?.catalog_exercise_id) || text(exercise.exercise_id), label, unit,
      text(exercise.selected_variant_id) || extra.variant, extra.equipment, extra.loadType, sourceKind])
    let group = groups.get(identity)
    if (!group) {
      if (groups.size >= SERIES_LIMIT) { result.detailCapped = true; return }
      group = { id: createHash('sha256').update(identity).digest('hex').slice(0, 24), label, unit, ...extra, sourceKind, points: [], dates: new Map() }
      groups.set(identity, group)
    }
    // Same daily maximum convention as the existing recorded-load overview.
    // Legacy aggregates have a separate identity and cannot replace a set load.
    group.dates.set(day, Math.max(weight, group.dates.get(day) ?? weight))
  }
  for (const row of history.data.slice(0, SOURCE_LIMIT)) {
    let day = ''
    try { day = workoutLocalDate(row, timeZone) } catch { /* Invalid saved dates are not assigned invented times. */ }
    if (!civilDate(day)) { result.invalidCount++; continue }
    if (day < start || day > today) continue
    if (typeof row.id !== 'string' || !row.id) { result.invalidCount++; continue }
    const session: StrengthHistorySession = { id: text(row.id, 500), date: day, title: text(row.day_name) || 'Saved workout', completed: row.completed === true, entries: [] }
    if (!Array.isArray(row.exercise_logs)) {
      result.invalidCount++
      session.entries.push({ id: 'unavailable', label: 'Workout details', detail: 'Exercise details are unavailable in this saved record.' })
      result.sessions.push(session)
      continue
    }
    if (row.exercise_logs.length > EXERCISE_LIMIT) result.detailCapped = true
    for (const [index, exercise] of row.exercise_logs.slice(0, EXERCISE_LIMIT).entries()) {
      if (entries >= ENTRY_LIMIT) {
        result.detailCapped = true
        session.entries.push({ id: 'detail-limit', label: 'Recorded exercises', detail: 'Additional saved exercise details are outside this view’s detail limit. Your saved record is unchanged.' })
        break
      }
      if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) { result.invalidCount++; continue }
      const label = text(exercise.display_name) || text(exercise.exercise) || text(exercise.name)
      if (!label) { result.invalidCount++; continue }
      const extra = context(exercise), id = `${index}:${text(exercise.id, 500) || label}`
      const append = (detail: string) => { entries++; session.entries.push({ id, label, detail }) }
      if (exercise.skipped === true) { append('Saved as skipped; no performed load is plotted.'); continue }
      const inspected = { ...exercise, available_variants: Array.isArray(exercise.available_variants) ? exercise.available_variants.filter((variant: any) => variant && typeof variant === 'object') : undefined }
      const kind = activityDose(inspected).kind
      if (kind !== 'strength') {
        const amount = numeric(kind === 'breathing' ? exercise.actual_breaths ?? exercise.actual_reps : exercise.actual_duration)
        const unit = kind === 'breathing' ? 'breaths' : ['minutes', 'seconds'].includes(exercise.duration_unit) ? exercise.duration_unit : null
        const confirmed = exercise.completed === true && typeof exercise.confirmed_at === 'string' && Number.isFinite(Date.parse(exercise.confirmed_at))
        append(amount !== null && amount >= 0 && unit ? `Recorded duration: ${amount} ${unit}${confirmed ? '' : ' · completion not confirmed'}.` : 'Saved activity; actual duration was not recorded.')
        continue
      }
      const classification = loadKind(inspected), actualSets = Array.isArray(exercise.set_logs) ? exercise.set_logs : []
      if (actualSets.length > SET_LIMIT) result.detailCapped = true
      const details: string[] = []
      const seen = new Set<string>()
      for (const [position, set] of actualSets.slice(0, SET_LIMIT).entries()) {
        if (sets >= TOTAL_SET_LIMIT) { result.detailCapped = true; break }
        if (!isValidCompletedSet(set)) { result.invalidCount++; continue }
        // An explicit recorded unit is required for a trend. A missing unit is
        // unknown, even where older logging code used a display default.
        const unit = set.weight_unit
        const weight = numeric(set.weight), reps = numeric(set.reps)
        if (!['lb', 'kg'].includes(unit) || weight === null || reps === null) { result.invalidCount++; continue }
        const identity = text(set.id, 500) || `slot:${set.set_number ?? position + 1}`
        if (seen.has(identity)) continue
        seen.add(identity); sets++
        const ordinal = Number.isSafeInteger(Number(set.set_number)) && Number(set.set_number) > 0 ? Number(set.set_number) : position + 1
        details.push(`Set ${ordinal}: ${reps} reps · ${weight} ${unit}${classification === 'recorded' ? ` · ${contextLabel(extra.loadType)}` : ` · ${classification} record, not an external-load trend`}`)
        if (classification === 'recorded') addPoint(exercise, label, unit, day, weight, 'confirmed_sets')
      }
      if (details.length) { append(details.join('; ')); continue }
      if (actualSets.length && (sets >= TOTAL_SET_LIMIT || actualSets.length > SET_LIMIT)) {
        append('Recorded set details are outside this view’s detail limit. Your saved record is unchanged.')
        continue
      }
      // Old aggregate actuals are retained explicitly, without fabricating
      // individual sets or mixing averaged legacy loads into confirmed sets.
      if (!Array.isArray(exercise.set_logs) && exercise.completed === true) {
        const weight = numeric(exercise.actual_weight), reps = numeric(exercise.actual_reps), unit = exercise.actual_weight_unit
        if (weight !== null && weight >= 0 && reps !== null && reps > 0 && ['lb', 'kg'].includes(unit)) {
          append(`Legacy recorded summary: ${reps} reps · ${weight} ${unit} · ${classification === 'recorded' ? contextLabel(extra.loadType) : classification}. Individual set details are unavailable.`)
          if (classification === 'recorded') addPoint(exercise, label, unit, day, weight, 'legacy_summary')
          continue
        }
      }
      append('No confirmed set load is available in this saved entry.')
    }
    result.sessions.push(session)
  }
  result.series = [...groups.values()].map(({ dates, ...group }) => ({ ...group,
    points: [...dates].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.unit.localeCompare(b.unit) || a.id.localeCompare(b.id))
  return result
}
