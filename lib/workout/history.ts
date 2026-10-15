import { addLocalDays, getClientLocalDate, getClientTimeZone, recordLocalDate } from '@/lib/timezone'
import { getClientDayRange } from '@/lib/schedule/time'

export function workoutLocalDate(row: any, timeZone: string) {
  const value = row.workout_started_at || row.workout_date
  return value ? recordLocalDate(String(value), timeZone) : ''
}

type HistoryOptions = {
  supabase: any
  client: any
  startDate?: string
  endDateExclusive?: string
  authUserId?: string
  completed?: boolean
  dayName?: string
  source?: 'manual' | 'recommended'
  allHistory?: boolean
  limit?: number
}

// New sessions retain an actual timestamp. Legacy DATE rows retain their civil
// date; never compare that column to a timestamptz or invent historical times.
export async function loadWorkoutHistory({ supabase, client, startDate = getClientLocalDate(client), endDateExclusive = addLocalDays(startDate, 1), authUserId, completed, dayName, source, allHistory = false, limit = 100 }: HistoryOptions) {
  const start = getClientDayRange(client, startDate).start.toISOString()
  const end = getClientDayRange(client, endDateExclusive).start.toISOString()
  const timeZone = getClientTimeZone(client)
  function base() {
    let query = supabase.from('workout_logs').select('*').eq('client_id', client.client_id)
    if (authUserId) query = query.eq('auth_user_id', authUserId)
    if (completed !== undefined) query = query.eq('completed', completed)
    if (dayName !== undefined) query = query.eq('day_name', dayName)
    return query
  }
  const [timed, dated] = await Promise.all([
    (allHistory ? base() : base().gte('workout_started_at', start).lt('workout_started_at', end)).order('workout_started_at', { ascending: false }).limit(limit),
    (allHistory ? base() : base().gte('workout_date', startDate).lt('workout_date', endDateExclusive)).order('workout_date', { ascending: false }),
  ])
  const missingTimestamp = timed.error && ['42703', 'PGRST204'].includes(timed.error.code) && String(timed.error.message).includes('workout_started_at')
  if (dated.error || (timed.error && !missingTimestamp)) return { data: null, error: dated.error || timed.error }
  const byId = new Map<string, any>()
  for (const row of [...(timed.data || []), ...(dated.data || []).filter((row: any) => !row.workout_started_at)]) {
    const date = workoutLocalDate(row, timeZone)
    if ((!allHistory && (date < startDate || date >= endDateExclusive)) || (source && (row.workout_source || 'recommended') !== source)) continue
    byId.set(String(row.id), row)
  }
  const data = [...byId.values()].sort((a, b) => {
    const aDate = workoutLocalDate(a, timeZone), bDate = workoutLocalDate(b, timeZone)
    if (aDate !== bDate) return bDate.localeCompare(aDate)
    const aTime = a.workout_started_at || a.updated_at || '', bTime = b.workout_started_at || b.updated_at || ''
    return String(bTime).localeCompare(String(aTime))
  }).slice(0, limit)
  return { data, error: null }
}
