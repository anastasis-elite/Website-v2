import { calculateTodayNutritionPacing, type NutritionPacing } from '@/lib/nutrition/todayPacing'

export type TodayHydrationPacing = NutritionPacing

/** Today presentation only. Existing hydration targets and readiness stay intact. */
export function calculateTodayHydrationPacing(input: Parameters<typeof calculateTodayNutritionPacing>[0]): TodayHydrationPacing {
  // Both prompts use the same saved waking window, exact equality and crossing
  // clock. Calendar-day totals cannot establish an overnight waking-window sum.
  const pacing = calculateTodayNutritionPacing(input)
  let prompt: string
  if (pacing.state === 'complete') prompt = 'Your recorded water meets today’s target.'
  else if (pacing.state === 'on_pace') prompt = 'Your recorded water is on pace for your waking day.'
  else if (pacing.state === 'sleep') prompt = 'Water logging is available whenever you need it.'
  else if (pacing.state === 'behind') prompt = 'A little moment of care: log the water you’ve had today.'
  else if (pacing.reason === 'missing_schedule') prompt = 'Log the water you’ve had. Save your wake time and bedtime to personalize when this reminder appears.'
  else if (pacing.reason === 'missing_target') prompt = 'Log the water you’ve had. A saved daily water target is needed for pacing.'
  else if (pacing.reason === 'overnight_unavailable') prompt = 'Log the water you’ve had. Your overnight waking window is not compared with calendar-day totals.'
  else if (pacing.reason === 'unavailable') prompt = 'Your saved water could not be loaded. Open water logging to retry.'
  else if (pacing.reason === 'invalid_consumed') prompt = 'Open water logging to review your saved intake.'
  else prompt = 'Log the water you’ve had so today’s reminder can use your recorded intake.'
  return { ...pacing, prompt }
}
