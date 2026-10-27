export const dayBlockLabels = { morning: 'Morning', midday: 'Midday', evening: 'Evening' } as const
export type DayBlock = keyof typeof dayBlockLabels

export function isDayBlockDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export function dayBlockHref(block: DayBlock, date: string) {
  return `/dashboard/day/${block}?${new URLSearchParams({ date })}`
}
export function scheduleDayHref(date: string) {
  return `/dashboard/schedule?${new URLSearchParams({ date })}`
}
