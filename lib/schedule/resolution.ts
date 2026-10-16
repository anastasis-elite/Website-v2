import { buildDailyScheduleState } from './engine'
import { zonedDateTimeToUtc } from './time'
import { addLocalDays } from '@/lib/timezone'
import type { DailyScheduleState, ScheduleEvent } from './types'

export function applyScheduleResolution(schedule: DailyScheduleState, event: ScheduleEvent): DailyScheduleState {
  const events = schedule.events.map(item => item.id === event.id ? event : item)
  const state = buildDailyScheduleState({ date: schedule.date, timezone: schedule.timezone,
    now: new Date(schedule.now), dayStart: zonedDateTimeToUtc(schedule.date, '00:00', schedule.timezone),
    dayEnd: zonedDateTimeToUtc(addLocalDays(schedule.date, 1), '00:00', schedule.timezone), events,
    program: schedule.program, transitionMinutes: schedule.preferences?.transitionMinutes })
  return { ...schedule, ...state, dailyRecommendation: undefined, todayActivities: undefined }
}
