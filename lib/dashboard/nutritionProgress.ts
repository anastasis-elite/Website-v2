import 'server-only'
import { membershipCan } from '@/lib/membership/policy'
import { calculateRecordedNutrition, type RecordedMacroTotals } from '@/lib/nutrition/progress'
import { addLocalDays, getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { progressRange, type ProgressRange, type ProgressSeries } from './progressOverview'

const LOG_LIMIT = 500
const BATCH_SIZE = 50
const SOURCE_LIMIT = 500
type ReadResult = { data: any[] | null; error?: unknown; capped?: boolean }
type NutritionMetric = 'hydration' | keyof RecordedMacroTotals
export type NutritionProgressData = {
  range: ProgressRange; today: string; timeZone: string; periodLabel: string
  coverageStart: string | null; coverageEnd: string | null; capped: boolean; ambiguousDays: number
  series: Record<NutritionMetric, ProgressSeries>
}

function civilDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : ''
}
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'string' && !value.trim() || !['number', 'string'].includes(typeof value)) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}
function recordedHydration(row: any): number | null {
  const water = numeric(row.water_consumed_oz)
  // Target preparation also initializes this column to zero. A zero needs a
  // committed drink receipt before it can be treated as a recorded actual.
  const receipt = Array.isArray(row.water_submission_ids) && row.water_submission_ids.some((id: unknown) =>
    typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  return water !== null && (water > 0 || receipt) ? water : null
}
const fields = {
  calories: ['calories_eaten', 'calories'], protein: ['protein_eaten_g', 'protein_g'],
  carbs: ['carbs_eaten_g', 'carbs_g'], fats: ['fat_eaten_g', 'fat_g'],
} as const
const macroKeys = Object.keys(fields) as Array<keyof RecordedMacroTotals>

export function assertNutritionProgressAccess(user: any, client: any, now = new Date()): void {
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id || !Number.isFinite(now.getTime()) ||
    !membershipCan(client, 'generatedCoaching', now) || !membershipCan(client, 'progressView', now) ||
    !membershipCan(client, 'trendsView', now) || !membershipCan(client, 'nutritionTracking', now)) {
    throw new Error('Recorded nutrition trends are not available for this account.')
  }
}

/** Daily actuals only. A prepared target row is not evidence of food intake.
 * Conflicting copies and truncated source batches never become partial daily totals. */
export function buildNutritionProgress({ range, today, timeZone, logs, meals, macros, incompleteLogIds = [] }: {
  range: ProgressRange; today: string; timeZone: string; logs: ReadResult; meals: ReadResult; macros: ReadResult; incompleteLogIds?: string[]
}): NutritionProgressData {
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const validDay = (value: unknown) => { const day = civilDate(value); return day && day >= start && day <= today ? day : '' }
  const unavailable = (source: ReadResult) => Boolean(source.error) || !Array.isArray(source.data)
  const logsUnavailable = unavailable(logs), macrosUnavailable = logsUnavailable || unavailable(meals) || unavailable(macros)
  const capped = Boolean(logs.capped || meals.capped || macros.capped)
  const metric = (label: string, unit: string, hydration = false): ProgressSeries => ({
    label, unit, points: [], unavailable: hydration ? logsUnavailable : macrosUnavailable, capped: hydration ? Boolean(logs.capped) : capped,
  })
  const series: NutritionProgressData['series'] = {
    hydration: metric('Hydration', 'oz', true), calories: metric('Calories', 'kcal'),
    protein: metric('Protein', 'g'), carbs: metric('Carbohydrates', 'g'), fats: metric('Fats', 'g'),
  }
  const byId = new Map<string, any>(), ambiguous = new Set<string>(), incomplete = new Set(incompleteLogIds)
  for (const row of logsUnavailable ? [] : logs.data!) {
    const day = validDay(row?.log_date)
    if (!day || typeof row.id !== 'string' || !row.id) continue
    const previous = byId.get(row.id)
    if (previous && (previous.log_date !== row.log_date || recordedHydration(previous) !== recordedHydration(row))) {
      ambiguous.add(day); ambiguous.add(previous.log_date)
    } else byId.set(row.id, row)
  }
  const dates = new Map<string, any[]>()
  for (const row of byId.values()) dates.set(row.log_date, [...dates.get(row.log_date) || [], row])
  for (const [day, rows] of dates) if (rows.length > 1) ambiguous.add(day)

  // Meal view rows are unique per log/block; manual entry IDs identify replayed
  // copies. Equal amounts with different IDs are separate recorded entries.
  function unique(source: ReadResult, kind: 'meal' | 'macro') {
    const result = new Map<string, any>()
    if (unavailable(source)) return []
    for (const row of source.data!) {
      if (!row || !byId.has(row.nutrition_log_id)) continue
      const key = kind === 'meal' ? JSON.stringify([row.nutrition_log_id, row.day_block || 'other']) : row.id
      if (!key || typeof key !== 'string') { incomplete.add(row.nutrition_log_id); continue }
      const previous = result.get(key)
      const columns = macroKeys.map(metric => fields[metric][kind === 'meal' ? 0 : 1])
      if (previous && (previous.nutrition_log_id !== row.nutrition_log_id || columns.some(column => numeric(previous[column]) !== numeric(row[column])))) {
        incomplete.add(row.nutrition_log_id); incomplete.add(previous.nutrition_log_id)
      } else result.set(key, row)
    }
    return [...result.values()]
  }
  const mealRows = unique(meals, 'meal'), macroRows = unique(macros, 'macro')
  for (const [day, rows] of dates) {
    if (ambiguous.has(day)) continue
    const row = rows[0], water = recordedHydration(row)
    if (!logsUnavailable && water !== null) series.hydration.points.push({ date: day, value: water })
    if (macrosUnavailable || incomplete.has(row.id)) continue
    const dailyMeals = mealRows.filter(entry => entry.nutrition_log_id === row.id), dailyMacros = macroRows.filter(entry => entry.nutrition_log_id === row.id)
    if (!dailyMeals.length && !dailyMacros.length) continue
    const recorded = calculateRecordedNutrition(dailyMeals, dailyMacros)
    for (const key of macroKeys) {
      // Do not turn an unknown nutrient into zero, or chart a known subtotal as
      // the day's total when another confirmed entry has an unknown value.
      if (dailyMeals.every(entry => numeric(entry[fields[key][0]]) !== null) && dailyMacros.every(entry => numeric(entry[fields[key][1]]) !== null)) {
        series[key].points.push({ date: day, value: recorded.total[key] })
      }
    }
  }
  for (const metric of Object.values(series)) metric.points.sort((a, b) => a.date.localeCompare(b.date))
  const coveredDates = [...dates.keys()].sort()
  return { range, today, timeZone, periodLabel: range === 'all' ? 'All-time range' : `Last ${range === '12w' ? 12 : 4} weeks`,
    coverageStart: coveredDates[0] || null, coverageEnd: coveredDates.at(-1) || null, capped,
    ambiguousDays: new Set([...ambiguous, ...[...incomplete].map(id => byId.get(id)?.log_date).filter(Boolean)]).size, series }
}

export async function loadNutritionProgress({ supabase, user, client, range: requestedRange, now = new Date() }: {
  supabase: any; user: any; client: any; range: ProgressRange; now?: Date
}): Promise<NutritionProgressData> {
  assertNutritionProgressAccess(user, client, now)
  const range = progressRange(requestedRange), today = getClientLocalDate(client, now), timeZone = getClientTimeZone(client)
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const read = async (operation: () => PromiseLike<ReadResult>): Promise<ReadResult> => {
    try { const result = await operation(); return result.error || !Array.isArray(result.data) ? { data: null, error: true } : result }
    catch { return { data: null, error: true } }
  }
  const logs = await read(() => {
    let query = supabase.from('nutrition_logs').select('id,client_id,auth_user_id,log_date,water_consumed_oz,water_submission_ids')
      .eq('client_id', client.client_id).eq('auth_user_id', user.id).lte('log_date', today)
      .order('log_date', { ascending: false }).order('id', { ascending: false }).limit(LOG_LIMIT + 1)
    if (start) query = query.gte('log_date', start)
    return query
  })
  if (logs.data?.some(row => row?.client_id !== client.client_id || row?.auth_user_id !== user.id)) { logs.data = null; logs.error = true }
  logs.capped = (logs.data?.length || 0) > LOG_LIMIT
  logs.data = logs.data?.slice(0, LOG_LIMIT) || null
  const ids = [...new Set((logs.data || []).map(row => row.id).filter(id => typeof id === 'string' && id))]
  const meals: ReadResult = { data: [] }, macros: ReadResult = { data: [] }, incompleteLogIds: string[] = []
  // A fixed daily-log window and fixed source budgets keep All Time bounded.
  // Suppress every affected day's macro total if a batch exceeds its budget.
  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    const batch = ids.slice(offset, offset + BATCH_SIZE)
    const [mealBatch, macroBatch] = await Promise.all([
      read(() => supabase.from('nutrition_log_totals_by_block').select('nutrition_log_id,day_block,calories_eaten,protein_eaten_g,carbs_eaten_g,fat_eaten_g')
        .in('nutrition_log_id', batch).order('nutrition_log_id').order('day_block').limit(SOURCE_LIMIT + 1)),
      read(() => supabase.from('macro_entries').select('id,nutrition_log_id,client_id,auth_user_id,calories,protein_g,carbs_g,fat_g,day_block')
        .eq('client_id', client.client_id).eq('auth_user_id', user.id).in('nutrition_log_id', batch)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(SOURCE_LIMIT + 1)),
    ])
    if (mealBatch.data?.some(row => !batch.includes(row?.nutrition_log_id))) mealBatch.error = true
    if (macroBatch.data?.some(row => !batch.includes(row?.nutrition_log_id) || row.client_id !== client.client_id || row.auth_user_id !== user.id)) macroBatch.error = true
    for (const [target, source] of [[meals, mealBatch], [macros, macroBatch]]) {
      if (source.error) target.error = true
      else if (source.data!.length > SOURCE_LIMIT) { target.capped = true; incompleteLogIds.push(...batch) }
      else target.data!.push(...source.data!)
    }
  }
  return buildNutritionProgress({ range, today, timeZone, logs, meals, macros, incompleteLogIds })
}
