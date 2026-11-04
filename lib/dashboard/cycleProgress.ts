import 'server-only'
import { membershipCan } from '@/lib/membership/policy'
import { addLocalDays, getClientLocalDate } from '@/lib/timezone'
import { progressRange, type ProgressRange, type ProgressPoint } from './progressOverview'

const SOURCE_LIMIT = 500
export type CycleInterval = { start: string; date: string; days: number }
export type CycleProgressData = {
  range: ProgressRange; periodLabel: string; today: string; enabled: boolean
  unavailable: boolean; capped: boolean; invalidCount: number
  intervals: CycleInterval[]; points: ProgressPoint[]; coverageStart: string | null; coverageEnd: string | null
}
type ReadResult = { data: any[] | null; error?: unknown }
function civilDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : ''
}

export function assertCycleProgressAccess(user: any, client: any, now = new Date()): void {
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id || !Number.isFinite(now.getTime()) ||
    !membershipCan(client, 'generatedCoaching', now) || !membershipCan(client, 'progressView', now) || !membershipCan(client, 'trendsView', now)) {
    throw new Error('Recorded cycle history is not available for this account.')
  }
}

/** Period-start evidence only. Client prediction fields and symptom/flow records
 * are deliberately never inputs to this trend. Intervals end in the range. */
export function buildCycleProgress({ range, today, rows, preceding, clientId, userId }: {
  range: ProgressRange; today: string; rows: ReadResult; preceding?: ReadResult; clientId: string; userId: string
}): CycleProgressData {
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const result: CycleProgressData = {
    range, periodLabel: range === 'all' ? 'All-time range' : `Last ${range === '12w' ? 12 : 4} weeks`, today, enabled: true,
    unavailable: false, capped: false, invalidCount: 0, intervals: [], points: [], coverageStart: null, coverageEnd: null,
  }
  const validResponse = (response: ReadResult) => !response.error && Array.isArray(response.data) &&
    response.data.every(row => row && row.client_id === clientId && row.auth_user_id === userId)
  if (!validResponse(rows) || preceding && !validResponse(preceding)) return { ...result, unavailable: true }
  result.capped = rows.data!.length > SOURCE_LIMIT
  const selectedRows = rows.data!.slice(0, SOURCE_LIMIT)
  // When capped, the extra row is the preceding source record. Connecting to a
  // pre-range row would skip omitted starts and invent a longer interval.
  const predecessorRows = result.capped ? rows.data!.slice(SOURCE_LIMIT, SOURCE_LIMIT + 1) : preceding?.data || []
  const starts = new Set<string>(), selectedStarts = new Set<string>()
  for (const row of selectedRows) {
    const date = civilDate(row.log_date)
    if (!date || row.period_started !== true) { result.invalidCount++; continue }
    if (date < start || date > today) continue
    starts.add(date); selectedStarts.add(date)
  }
  const firstSelected = [...selectedStarts].sort()[0]
  for (const row of predecessorRows) {
    const date = civilDate(row.log_date)
    if (!date || row.period_started !== true) { result.invalidCount++; continue }
    if (firstSelected && date < firstSelected && date <= today && (result.capped || date < start)) starts.add(date)
  }
  const dates = [...starts].sort()
  for (let index = 1; index < dates.length; index++) {
    const date = dates[index], previous = dates[index - 1]
    if (!selectedStarts.has(date)) continue
    // UTC midnight arithmetic is used for calendar dates, including DST changes.
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86400000)
    result.intervals.push({ start: previous, date, days })
  }
  result.points = result.intervals.map(({ date, days }) => ({ date, value: days }))
  result.coverageStart = [...selectedStarts].sort()[0] || null
  result.coverageEnd = [...selectedStarts].sort().at(-1) || null
  return result
}

export async function loadCycleProgress({ supabase, user, client, range: requestedRange, now = new Date() }: {
  supabase: any; user: any; client: any; range: ProgressRange; now?: Date
}): Promise<CycleProgressData> {
  assertCycleProgressAccess(user, client, now)
  const range = progressRange(requestedRange), today = getClientLocalDate(client, now)
  if (client.cycle_tracking_enabled !== true || ['menopause', 'pregnant', 'not_tracking'].includes(String(client.reproductive_status || 'cycling'))) {
    return { range, today, periodLabel: range === 'all' ? 'All-time range' : `Last ${range === '12w' ? 12 : 4} weeks`, enabled: false,
      unavailable: false, capped: false, invalidCount: 0, intervals: [], points: [], coverageStart: null, coverageEnd: null }
  }
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const read = async (before: boolean): Promise<ReadResult> => {
    try {
      let query = supabase.from('cycle_logs').select('client_id,auth_user_id,log_date,period_started')
        .eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('period_started', true)
        .lte('log_date', today).order('log_date', { ascending: false })
      if (start) query = before ? query.lt('log_date', start) : query.gte('log_date', start)
      return await query.limit(before ? 1 : SOURCE_LIMIT + 1)
    } catch { return { data: null, error: true } }
  }
  const [rows, preceding] = await Promise.all([read(false), start ? read(true) : Promise.resolve(undefined)])
  return buildCycleProgress({ range, today, rows, preceding, clientId: client.client_id, userId: user.id })
}
