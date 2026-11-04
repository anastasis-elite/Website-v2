import 'server-only'
import { createHash } from 'node:crypto'
import { membershipCan } from '@/lib/membership/policy'
import { addLocalDays, getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { loadWorkoutHistory, workoutLocalDate } from '@/lib/workout/history'
import { recoveryCompletionEvidence } from '@/lib/recovery/todayCompletion'
import { progressRange, type ProgressRange } from './progressOverview'

const DISPLAY_LIMIT = 500
export const recoveryProgressFields = [
  { key: 'energy', label: 'Energy', unit: '/10', column: 'energy_level', minimum: 1, maximum: 10 },
  { key: 'stress', label: 'Stress', unit: '/10', column: 'stress_level', minimum: 1, maximum: 10 },
  { key: 'sleepHours', label: 'Check-in sleep duration', unit: 'hr', column: 'sleep_hours', minimum: 0, maximum: 24 },
  { key: 'sleepQuality', label: 'Check-in sleep quality', unit: '/10', column: 'sleep_quality', minimum: 1, maximum: 10 },
  { key: 'soreness', label: 'Soreness', unit: '/10', column: 'soreness_level', minimum: 1, maximum: 10 },
  { key: 'mood', label: 'Mood', unit: '/10', column: 'mood_level', minimum: 1, maximum: 10 },
  { key: 'hunger', label: 'Hunger', unit: '/10', column: 'hunger_level', minimum: 1, maximum: 10 },
] as const
export type RecoveryFieldKey = typeof recoveryProgressFields[number]['key']
export type RecoveryHistoryValue = { status: 'recorded' | 'missing' | 'invalid'; value: number | null }
export type RecoveryCheckinRecord = { key: string; date: string; completed: boolean; values: Record<RecoveryFieldKey, RecoveryHistoryValue> }
export type RecoverySleepRecord = { key: string; date: string; duration: RecoveryHistoryValue; quality: RecoveryHistoryValue }
export type RecoveryActivityRecord = {
  key: string; date: string; label: string; duration: RecoveryHistoryValue
  durationSource: 'saved_minutes' | 'manual_details' | 'none'; ambiguous: boolean; completed: boolean
}
export type RecoveryWorkoutRecord = { key: string; date: string; title: string; completed: boolean }
export type RecoveryHistorySource<T> = {
  unavailable: boolean; capped: boolean; invalidCount: number; ambiguousDates: string[]; records: T[]
}
export type RecoveryProgressHistoryData = {
  range: ProgressRange; periodLabel: string; today: string; timeZone: string; includeWorkouts: boolean
  fields: typeof recoveryProgressFields
  checkins: RecoveryHistorySource<RecoveryCheckinRecord>; sleep: RecoveryHistorySource<RecoverySleepRecord>
  activities: RecoveryHistorySource<RecoveryActivityRecord>; workouts: RecoveryHistorySource<RecoveryWorkoutRecord>
}
export type RecoveryProgressSummary = {
  daysCompleted: number | null; recordedMinutes: number | null; checkinDays: number | null
  activitiesCapped: boolean; checkinsCapped: boolean; minutesIncomplete: boolean; excludedActivityCount: number
}

function source<T>(): RecoveryHistorySource<T> { return { unavailable: false, capped: false, invalidCount: 0, ambiguousDates: [], records: [] } }
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24) }
function text(value: unknown, limit = 200): string { return typeof value === 'string' ? value.trim().slice(0, limit) : '' }
function civilDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : ''
}
function savedValue(value: unknown, minimum: number, maximum: number, integer = false): RecoveryHistoryValue {
  if (value === null || value === undefined || typeof value === 'string' && !value.trim()) return { status: 'missing', value: null }
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))) return { status: 'invalid', value: null }
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum && (!integer || Number.isInteger(numeric))
    ? { status: 'recorded', value: numeric } : { status: 'invalid', value: null }
}
function timestamp(value: unknown): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : ''
}
function ownerMatches(rows: any[], clientId: string, owner: string, ownerColumn: string): boolean {
  return rows.every(row => row && typeof row === 'object' && row.client_id === clientId && row[ownerColumn] === owner)
}
function duplicateDates(rows: Array<{ date: string }>): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.date, (counts.get(row.date) || 0) + 1)
  return [...counts].filter(([, count]) => count > 1).map(([date]) => date).sort().reverse()
}
function ordered<T extends { date: string; updated: string; digest: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated) || a.digest.localeCompare(b.digest))
}
function keyed<T extends { date: string; updated: string; digest: string }>(rows: T[]) {
  const occurrences = new Map<string, number>()
  return rows.slice(0, DISPLAY_LIMIT).map(({ updated: _updated, digest, ...row }) => {
    void _updated // Sorting metadata is deliberately omitted from the display record.
    const occurrence = (occurrences.get(digest) || 0) + 1
    occurrences.set(digest, occurrence)
    return { ...row, key: `${digest}-${occurrence}` }
  })
}

export function assertRecoveryProgressAccess(user: any, client: any, includeWorkouts = false, now = new Date()): void {
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id || !Number.isFinite(now.getTime()) ||
    !membershipCan(client, 'generatedCoaching', now) || !membershipCan(client, 'progressView', now) ||
    !membershipCan(client, 'trendsView', now) || !membershipCan(client, 'recoveryBasic', now) ||
    includeWorkouts && !membershipCan(client, 'workoutLogging', now)) {
    throw new Error('Recorded check-in and recovery history is not available for this account.')
  }
}

/** Read saved, owner-scoped records only. Sleep/check-in copies remain separate;
 * no historical readiness score, causal conclusion or recovery-minute proxy is created. */
export async function loadRecoveryProgressHistory({ supabase, user, client, range: requestedRange, includeWorkouts = false, includeSleep = true, now = new Date() }: {
  supabase: any; user: any; client: any; range: ProgressRange; includeWorkouts?: boolean; includeSleep?: boolean; now?: Date
}): Promise<RecoveryProgressHistoryData> {
  assertRecoveryProgressAccess(user, client, includeWorkouts, now)
  const range = progressRange(requestedRange), today = getClientLocalDate(client, now), timeZone = getClientTimeZone(client)
  const start = range === 'all' ? '' : addLocalDays(today, range === '12w' ? -83 : -27)
  const inRange = (date: string) => Boolean(date) && date >= start && date <= today
  const hasCompletionTimestamp = (value: unknown) => {
    // log_date is the local day persisted when the owned record was saved.
    // No historical timezone is stored: a later profile change must not
    // reinterpret that day. Still require a valid, nonfuture timestamp.
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false
    if (!civilDate(value.slice(0, 10))) return false
    const at = new Date(value)
    return Number.isFinite(at.getTime()) && at <= now
  }
  const result: RecoveryProgressHistoryData = {
    range, periodLabel: range === 'all' ? 'All-time range' : `Last ${range === '12w' ? 12 : 4} weeks`, today, timeZone, includeWorkouts,
    fields: recoveryProgressFields, checkins: source(), sleep: source(), activities: source(), workouts: source(),
  }
  async function read(table: string, columns: string, ownerColumn: string, lastOrder: string) {
    try {
      let query = supabase.from(table).select(columns).eq('client_id', client.client_id).eq(ownerColumn, user.id)
        .lte('log_date', today).order('log_date', { ascending: false }).order(lastOrder, { ascending: false }).limit(DISPLAY_LIMIT + 1)
      if (table !== 'recovery_logs') query = query.order('id', { ascending: false })
      if (start) query = query.gte('log_date', start)
      const response = await query
      if (response.error || !Array.isArray(response.data) || !ownerMatches(response.data, client.client_id, user.id, ownerColumn)) return { data: [], unavailable: true }
      return { data: response.data.slice(0, DISPLAY_LIMIT + 1), unavailable: false }
    } catch { return { data: [], unavailable: true } }
  }
  const [checkins, sleep, activities, workouts] = await Promise.all([
    read('recovery_logs', 'client_id,auth_user_id,log_date,updated_at,check_in_completed_at,sleep_hours,sleep_quality,stress_level,soreness_level,energy_level,mood_level,hunger_level', 'auth_user_id', 'updated_at'),
    includeSleep ? read('sleep_logs', 'id,client_id,user_id,log_date,updated_at,duration_hours,quality', 'user_id', 'updated_at') : Promise.resolve({ data: [], unavailable: false }),
    read('recovery_activity_logs', 'id,client_id,user_id,log_date,created_at,activity_type,duration_minutes,activity_details,request_id', 'user_id', 'created_at'),
    includeWorkouts ? (async () => {
      try {
        const response = await loadWorkoutHistory({ supabase, client, authUserId: user.id, startDate: start || today,
          endDateExclusive: addLocalDays(today, 1), allHistory: range === 'all', limit: DISPLAY_LIMIT + 1, sourceLimit: DISPLAY_LIMIT + 1 })
        if (response.error || !Array.isArray(response.data) || !ownerMatches(response.data, client.client_id, user.id, 'auth_user_id')) return { data: [], unavailable: true, capped: false }
        return { data: response.data, unavailable: false, capped: Boolean('sourceCapped' in response && response.sourceCapped) }
      } catch { return { data: [], unavailable: true, capped: false } }
    })() : Promise.resolve({ data: [], unavailable: false, capped: false }),
  ])
  for (const [target, raw] of [[result.checkins, checkins], [result.sleep, sleep], [result.activities, activities], [result.workouts, workouts]] as const) {
    target.unavailable = raw.unavailable; target.capped = raw.data.length > DISPLAY_LIMIT
  }
  result.workouts.capped ||= workouts.capped
  const checkinRows: Array<Omit<RecoveryCheckinRecord, 'key'> & { updated: string; digest: string }> = []
  for (const row of checkins.data) {
    const date = civilDate(row.log_date)
    if (!date) { result.checkins.invalidCount++; continue }
    if (!inRange(date)) continue
    const values = Object.fromEntries(recoveryProgressFields.map(field => {
      const value = savedValue(row[field.column], field.minimum, field.maximum)
      if (value.status === 'invalid') result.checkins.invalidCount++
      return [field.key, value]
    })) as RecoveryCheckinRecord['values']
    const updated = timestamp(row.updated_at), digest = hash([date, updated, values])
    // The current form explicitly marks completion and requires energy only.
    // Mirrored sleep, optional answers, and timestamps on their own are not a
    // completed check-in. Never combine separate partial rows into completion.
    const completed = hasCompletionTimestamp(row.check_in_completed_at) && values.energy.status === 'recorded'
    checkinRows.push({ date, values, completed, updated, digest })
  }
  result.checkins.ambiguousDates = duplicateDates(checkinRows)
  result.checkins.records = keyed(ordered(checkinRows))
  const sleepRows: Array<Omit<RecoverySleepRecord, 'key'> & { updated: string; digest: string }> = []
  for (const row of sleep.data) {
    const date = civilDate(row.log_date)
    if (!date) { result.sleep.invalidCount++; continue }
    if (!inRange(date)) continue
    const duration = savedValue(row.duration_hours, 0, 24), quality = savedValue(row.quality, 1, 10)
    result.sleep.invalidCount += Number(duration.status === 'invalid') + Number(quality.status === 'invalid')
    const updated = timestamp(row.updated_at), digest = hash([date, updated, duration, quality])
    sleepRows.push({ date, duration, quality, updated, digest })
  }
  result.sleep.ambiguousDates = duplicateDates(sleepRows)
  result.sleep.records = keyed(ordered(sleepRows))

  type PreparedActivity = Omit<RecoveryActivityRecord, 'key'> & { updated: string; digest: string; id: string; request: string }
  const activityRows: PreparedActivity[] = []
  const activitiesByDate = new Map<string, any[]>()
  for (const row of activities.data) {
    const date = civilDate(row.log_date)
    if (inRange(date)) activitiesByDate.set(date, [...(activitiesByDate.get(date) || []), row])
  }
  const completionByDate = new Map([...activitiesByDate].map(([date, rows]) => [date,
    recoveryCompletionEvidence({ userId: user.id, clientId: client.client_id, date, rows, available: !activities.unavailable })]))
  for (const row of activities.data) {
    const date = civilDate(row.log_date), id = text(row.id)
    if (!date || !id) { result.activities.invalidCount++; continue }
    if (!inRange(date)) continue
    const label = text(row.activity_type) || 'Saved recovery activity'
    let duration = savedValue(row.duration_minutes, 0, 1440, true)
    let durationSource: RecoveryActivityRecord['durationSource'] = duration.status === 'recorded' ? 'saved_minutes' : 'none'
    const details = row.activity_details
    if (details && typeof details === 'object' && !Array.isArray(details) && ['slow_walk', 'warm_soak', 'sauna'].includes(details.kind)) {
      const expected = { slow_walk: 'Gentle walk', warm_soak: 'Warm soak', sauna: 'Sauna' }[details.kind as 'slow_walk' | 'warm_soak' | 'sauna']
      const actual = savedValue(details.durationMinutes, Number.MIN_VALUE, 1440)
      if (details.source !== 'manual' || label !== expected || typeof details.durationMinutes !== 'number' || actual.status !== 'recorded' || duration.status !== 'recorded' || Math.floor(actual.value!) !== duration.value) {
        duration = { status: 'invalid', value: null }; durationSource = 'none'
      } else { duration = actual; durationSource = 'manual_details' }
    }
    if (duration.status === 'invalid') result.activities.invalidCount++
    const updated = timestamp(row.created_at)
    const request = typeof row.request_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.request_id) ? row.request_id.toLowerCase() : ''
    // Compare only the saved activity's displayed identity and dose. Metadata,
    // hold timings, rounds, HR and device readings never become minutes.
    const digest = hash([date, label, duration, durationSource])
    const evidence = completionByDate.get(date)
    const completed = Boolean(text(row.activity_type)) && Boolean(evidence?.available && evidence.completedAt.includes(row.created_at)) && hasCompletionTimestamp(row.created_at)
    activityRows.push({ id, request, date, label, duration, durationSource, completed, ambiguous: false, updated, digest })
  }
  const parents = activityRows.map((_, index) => index), ids = new Map<string, number>(), requests = new Map<string, number>()
  function find(index: number): number { if (parents[index] !== index) parents[index] = find(parents[index]); return parents[index] }
  function join(left: number, right: number) { parents[find(right)] = find(left) }
  activityRows.forEach((row, index) => {
    if (ids.has(row.id)) join(index, ids.get(row.id)!); else ids.set(row.id, index)
    if (row.request) { if (requests.has(row.request)) join(index, requests.get(row.request)!); else requests.set(row.request, index) }
  })
  const groups = new Map<number, PreparedActivity[]>()
  activityRows.forEach((row, index) => { const group = find(index); groups.set(group, [...(groups.get(group) || []), row]) })
  const deduped: Array<Omit<RecoveryActivityRecord, 'key'> & { updated: string; digest: string }> = []
  const ambiguousActivityDates = new Set<string>()
  for (const group of groups.values()) {
    const versions = new Map<string, PreparedActivity>()
    for (const row of ordered(group)) if (!versions.has(row.digest)) versions.set(row.digest, row)
    const ambiguous = versions.size > 1
    const identity = [...new Set(group.map(row => row.request || row.id))].sort()
    for (const row of versions.values()) {
      if (ambiguous) ambiguousActivityDates.add(row.date)
      deduped.push({ date: row.date, label: row.label, duration: row.duration, durationSource: row.durationSource,
        completed: group.some(version => version.digest === row.digest && version.completed),
        ambiguous, updated: row.updated, digest: hash([identity, row.digest]) })
    }
  }
  result.activities.ambiguousDates = [...ambiguousActivityDates].sort().reverse()
  result.activities.records = keyed(ordered(deduped))
  for (const row of workouts.data.slice(0, DISPLAY_LIMIT)) {
    let date = ''
    try { date = civilDate(workoutLocalDate(row, timeZone)) } catch { /* No invented historical time. */ }
    if (!date || !text(row.id)) { result.workouts.invalidCount++; continue }
    if (!inRange(date)) continue
    result.workouts.records.push({ key: hash(['saved-workout', row.id]), date, title: text(row.day_name) || 'Saved workout', completed: row.completed === true })
  }
  return result
}

/** Summary of saved evidence, never sleep/check-in rows as activity proxies.
 * Capped values describe only the displayed source records; callers must label
 * that coverage rather than present an all-time total. */
export function buildRecoveryProgressSummary(data: RecoveryProgressHistoryData): RecoveryProgressSummary {
  const completed = data.activities.records.filter(row => row.completed && !row.ambiguous)
  const timed = completed.filter(row => row.duration.status === 'recorded')
  const excludedActivityCount = data.activities.records.length - completed.length
  const minutesIncomplete = data.activities.capped || data.activities.invalidCount > 0 || excludedActivityCount > 0 ||
    completed.some(row => row.duration.status !== 'recorded' && row.label !== 'Full rest')
  return {
    daysCompleted: data.activities.unavailable ? null : new Set(completed.map(row => row.date)).size,
    recordedMinutes: data.activities.unavailable ? null : timed.length ? timed.reduce((sum, row) => sum + row.duration.value!, 0)
      : data.activities.records.length || data.activities.invalidCount ? null : 0,
    checkinDays: data.checkins.unavailable ? null : new Set(data.checkins.records.filter(row => row.completed).map(row => row.date)).size,
    activitiesCapped: data.activities.capped, checkinsCapped: data.checkins.capped,
    minutesIncomplete, excludedActivityCount,
  }
}

export async function loadRecoveryProgressSummary(options: {
  supabase: any; user: any; client: any; range: ProgressRange; now?: Date
}): Promise<RecoveryProgressSummary> {
  return buildRecoveryProgressSummary(await loadRecoveryProgressHistory({ ...options, includeSleep: false, includeWorkouts: false }))
}
