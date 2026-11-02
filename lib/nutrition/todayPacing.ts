import { getClientTimeZone, localDateKey, addLocalDays } from '@/lib/timezone'
import { getLocalParts, zonedDateTimeToUtc } from '@/lib/schedule/time'

export type NutritionPacing = {
  state: 'complete' | 'on_pace' | 'behind' | 'sleep' | 'neutral'
  expectedPercent: number | null
  consumedPercent: number | null
  nextRefreshAt: string | null
  prompt: string
  reason: 'missing_target' | 'missing_schedule' | 'unlogged' | 'overnight_unavailable' | 'invalid_consumed' | 'unavailable' | null
}

function clock(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/.exec(value)
  if (!match || Number(match[1]) > 23) return null
  const hours = Number(match[1]), minutes = Number(match[2]), seconds = Number(match[3] || 0)
  return { minutes: hours * 60 + minutes + seconds / 60, time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, seconds }
}

/** Presentation pacing only: never changes targets, fuel readiness or daily completion. */
export function calculateTodayNutritionPacing({ client, target, consumed, hasLoggedIntake, available = true, now = new Date() }: {
  client: any; target: number; consumed: number; hasLoggedIntake: boolean; available?: boolean; now?: Date
}): NutritionPacing {
  const neutral = (reason: NutritionPacing['reason'], prompt: string, nextRefreshAt: string | null = null): NutritionPacing => ({
    state: 'neutral', expectedPercent: null, consumedPercent: null, nextRefreshAt, reason, prompt,
  })
  const wake = clock(client?.wake_time), bed = clock(client?.bed_time)
  if (!wake || !bed || wake.minutes === bed.minutes || !Number.isFinite(now.getTime())) {
    return neutral('missing_schedule', 'Log what you’ve had. Save your wake time and bedtime to personalize when this reminder appears.')
  }
  const timeZone = getClientTimeZone(client), date = localDateKey(now, timeZone)
  const at = (day: string, value: NonNullable<ReturnType<typeof clock>>) => new Date(zonedDateTimeToUtc(day, value.time, timeZone).getTime() + value.seconds * 1000)
  const local = getLocalParts(now, timeZone), localMinutes = local.hour * 60 + local.minute + local.second / 60
  const overnight = bed.minutes < wake.minutes
  const sleeping = overnight
    ? localMinutes >= bed.minutes && localMinutes < wake.minutes
    : localMinutes < wake.minutes || localMinutes >= bed.minutes
  if (sleeping) {
    const nextWake = at(!overnight && localMinutes >= bed.minutes ? addLocalDays(date, 1) : date, wake)
    return { state: 'sleep', expectedPercent: null, consumedPercent: null, nextRefreshAt: nextWake.toISOString(), reason: null,
      prompt: 'Nutrition logging is available whenever you need it.' }
  }
  const end = at(overnight && localMinutes >= wake.minutes ? addLocalDays(date, 1) : date, bed)
  if (overnight) {
    // Existing meals/macros expose log-entry timestamps and calendar-day totals,
    // not a reliable eaten-at time for every intake. Never reset an awake shift
    // at midnight or infer which calories belong to it.
    return neutral('overnight_unavailable', 'Log what you’ve had. Your overnight waking window is not compared with calendar-day totals.', end.toISOString())
  }
  if (!Number.isFinite(target) || target <= 0) return neutral('missing_target', 'Log what you’ve had. A saved daily calorie target is needed for pacing.', end.toISOString())
  if (!available) return neutral('unavailable', 'Your saved nutrition could not be loaded. Open nutrition to retry.', end.toISOString())
  if (!Number.isFinite(consumed) || consumed < 0) return neutral('invalid_consumed', 'Open nutrition to review your saved intake.', end.toISOString())
  if (!hasLoggedIntake) return neutral('unlogged', 'Log what you’ve had so today’s reminder can use your recorded intake.', end.toISOString())
  const start = at(date, wake), duration = end.getTime() - start.getTime()
  if (duration <= 0) return neutral('missing_schedule', 'Log what you’ve had. Review your saved wake time and bedtime.')
  const elapsed = Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / duration))
  const consumedFraction = consumed / target
  const base = { expectedPercent: elapsed * 100, consumedPercent: Math.min(100, consumedFraction * 100), reason: null }
  if (consumedFraction >= 1) return { ...base, state: 'complete', nextRefreshAt: end.toISOString(), prompt: 'Your logged calories have reached your daily target.' }
  if (consumedFraction >= elapsed) {
    // Equality is on pace. Refresh exactly when elapsed time first exceeds the
    // recorded fraction; no recurring clock polling or hydration tolerance.
    const crossing = Math.floor(start.getTime() + consumedFraction * duration) + 1
    return { ...base, state: 'on_pace', nextRefreshAt: new Date(Math.min(end.getTime(), Math.max(now.getTime() + 1, crossing))).toISOString(),
      prompt: 'Your logged calories are on pace for your waking day.' }
  }
  return { ...base, state: 'behind', nextRefreshAt: end.toISOString(),
    prompt: 'Your calorie logs are behind your waking-day pace. Log what you’ve had, and consider your usual next meal when it suits you.' }
}

export type RecordedHistoryMacros = { protein: number | null; carbs: number | null; fats: number | null }
export type NutritionMacroReminder = { macros: Array<keyof RecordedHistoryMacros>; message: string; startDate: string; endDate: string }

/** Missing values stay unknown, and tiny positive records never round to zero. */
export function recordedHistoryMacros(mealTotals: any[], macroEntries: any[]): RecordedHistoryMacros {
  const keys = { protein: ['protein_eaten_g', 'protein_g'], carbs: ['carbs_eaten_g', 'carbs_g'], fats: ['fat_eaten_g', 'fat_g'] } as const
  return Object.fromEntries(Object.entries(keys).map(([key, columns]) => {
    const values = [...mealTotals.map(row => row[columns[0]]), ...macroEntries.map(row => row[columns[1]])]
    if (!values.length || values.some(value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) return [key, null]
    return [key, values.reduce((sum, value) => sum + Number(value), 0)]
  })) as RecordedHistoryMacros
}

export function recentZeroMacroReminder(today: string, history: Array<{ date: string; mealCount: number; nutritionLogId: string | null; recordedMacros?: RecordedHistoryMacros }>, available = true): NutritionMacroReminder | null {
  if (!available) return null
  const dates = [-3, -2, -1].map(offset => addLocalDays(today, offset))
  const days = dates.map(date => history.find(day => day.date === date))
  if (days.some(day => !day?.nutritionLogId || day.mealCount < 1 || !day.recordedMacros)) return null
  const macros = (['protein', 'carbs', 'fats'] as const).filter(key => days.every(day => day?.recordedMacros?.[key] === 0))
  if (!macros.length) return null
  const labels = macros.map(key => key === 'carbs' ? 'carbohydrates' : key)
  const label = labels.length < 2 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
  return { macros, startDate: dates[0], endDate: dates[2], message: `Your recent logs show no recorded ${label} across three logged days. Consider giving ${label} some attention as you plan your usual meals.` }
}
