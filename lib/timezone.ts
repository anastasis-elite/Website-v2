const stateTimeZones: Record<string, string> = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix',
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DE: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  IA: 'America/Chicago',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  KS: 'America/Chicago',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  MA: 'America/New_York',
  MD: 'America/New_York',
  ME: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MO: 'America/Chicago',
  MS: 'America/Chicago',
  MT: 'America/Denver',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  NE: 'America/Chicago',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NV: 'America/Los_Angeles',
  NY: 'America/New_York',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago',
  TX: 'America/Chicago',
  UT: 'America/Denver',
  VA: 'America/New_York',
  VT: 'America/New_York',
  WA: 'America/Los_Angeles',
  WI: 'America/Chicago',
  WV: 'America/New_York',
  WY: 'America/Denver',
}

export function getTimezoneFromState(state?: string) {
  if (!state) return 'America/Chicago'

  return stateTimeZones[state.trim().toUpperCase()] || 'America/Chicago'
}

export function getClientTimeZone(client: any) {
  const candidate = client?.timezone || client?.onboarding_data?.timezone || getTimezoneFromState(client?.state || client?.onboarding_data?.state)
  try { new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(); return candidate as string }
  catch { return getTimezoneFromState(client?.state || client?.onboarding_data?.state) }
}

export function localDateKey(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-')
}
export function addLocalDays(date: string, offset: number) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
}
export function getClientLocalDate(client: any, now = new Date()) { return localDateKey(now, getClientTimeZone(client)) }
export function getClientLocalDateOffset(client: any, offsetDays = 0, now = new Date()) {
  return addLocalDays(getClientLocalDate(client, now), offsetDays)
}
export function getLocalMinutes(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(now)
  return Number(parts.find(p => p.type === 'hour')!.value) * 60 + Number(parts.find(p => p.type === 'minute')!.value)
}
export function getLocalDaypart(now: Date, timeZone: string): 'morning' | 'midday' | 'evening' {
  const minutes = getLocalMinutes(now, timeZone)
  return minutes < 11 * 60 ? 'morning' : minutes < 17 * 60 ? 'midday' : 'evening'
}
export function getGreeting(now: Date, timeZone: string) {
  const minutes = getLocalMinutes(now, timeZone)
  return minutes < 12 * 60 ? 'Good Morning' : minutes < 17 * 60 ? 'Good Afternoon' : 'Good Evening'
}
export function recordLocalDate(value: string, timeZone: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localDateKey(new Date(value), timeZone)
}
