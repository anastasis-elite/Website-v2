import { addLocalDays, getClientTimeZone, localDateKey } from '@/lib/timezone'
import { fixedCommitmentsForDate } from './dailyPlanAdapter'
import type { ScheduleEvent } from './types'

function calendarRange(start: string, end: string) {
  const from = Date.parse(start), until = Date.parse(end)
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from || until - from > 400 * 86400000) {
    throw new Error('Choose a calendar range of up to 400 days.')
  }
  return { from, until }
}

/** Read-only projection; occurrence IDs and saved outcomes use the daily Schedule's identities. */
export function projectCommitmentCalendar({ userId, client, start, end, blocks }: {
  userId: string; client: any; start: string; end: string; blocks: any[]
}): ScheduleEvent[] {
  const { from, until } = calendarRange(start, end), timezone = getClientTimeZone(client)
  const first = localDateKey(new Date(from), timezone), last = localDateKey(new Date(until - 1), timezone)
  const generated = new Map<string, ScheduleEvent>()
  for (let date = first; date <= last; date = addLocalDays(date, 1)) {
    for (const event of fixedCommitmentsForDate({ userId, client, date, timezone, blocks })) generated.set(event.id, event)
  }
  // Use the live schedule's existing occurrence override read semantics.
  // This range reader does not create or complete any schedule records.
  const overrides = client.onboarding_data?.scheduleOverrides || {}
  const events = [...generated.values()].map(event => overrides[event.id] ? { ...event, ...overrides[event.id] } : event)
  return events.filter(event => Date.parse(event.adjusted_start_at || event.start_at) < until &&
    Date.parse(event.adjusted_end_at || event.end_at) > from)
    .sort((left, right) => Date.parse(left.adjusted_start_at || left.start_at) - Date.parse(right.adjusted_start_at || right.start_at) || left.id.localeCompare(right.id))
}

/** One owned template query serves the whole visible range, rather than one query per day. */
export async function getCommitmentCalendarRange({ supabase, user, client, start, end }: {
  supabase: any; user: { id: string }; client: any; start: string; end: string
}): Promise<{ commitmentEvents: ScheduleEvent[]; commitmentsUnavailable: boolean }> {
  calendarRange(start, end)
  if (!client?.client_id) return { commitmentEvents: [], commitmentsUnavailable: false }
  let blocks: any[] = [], commitmentsUnavailable = false
  try {
    const result = await supabase.from('client_schedule_blocks').select('*')
      .eq('user_id', user.id).eq('client_id', client.client_id).eq('active', true)
    if (result.error) throw new Error('Commitments unavailable.')
    blocks = result.data || []
  } catch { commitmentsUnavailable = true }
  return { commitmentEvents: projectCommitmentCalendar({ userId: user.id, client, start, end, blocks }), commitmentsUnavailable }
}
