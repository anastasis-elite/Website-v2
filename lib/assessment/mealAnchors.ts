/** Meal schedule anchors describe timing, never intake or nutritional evidence. */
export function getBreakfastWindowTime(client: any): string | null {
  const time = client?.onboarding_data?.routinePreferences?.answers?.breakfast_window_time
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null
}
