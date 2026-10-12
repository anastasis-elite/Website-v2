import { addLocalDays, localDateKey } from '@/lib/timezone'
import { zonedDateTimeToUtc } from './time'
import type { DailyScheduleState } from './types'

export function nextScheduleBoundary(schedule: Pick<DailyScheduleState, 'date' | 'timezone' | 'events'>, now = Date.now()) {
  if (schedule.date < localDateKey(new Date(now), schedule.timezone)) return now
  const boundaries = [zonedDateTimeToUtc(addLocalDays(schedule.date, 1), '00:00', schedule.timezone).getTime()]
  for (const event of schedule.events) {
    if (['completed', 'skipped', 'cancelled'].includes(event.status)) continue
    boundaries.push(Date.parse(event.adjusted_start_at || event.start_at), Date.parse(event.adjusted_end_at || event.end_at))
  }
  return Math.min(...boundaries.filter(value => Number.isFinite(value) && value > now))
}
