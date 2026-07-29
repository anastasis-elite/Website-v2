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
  return (
    client?.timezone ||
    client?.onboarding_data?.timezone ||
    getTimezoneFromState(client?.state || client?.onboarding_data?.state)
  )
}

export function getClientLocalDate(client: any) {
  return getClientLocalDateOffset(client, 0)
}

export function getClientLocalDateOffset(client: any, offsetDays = 0) {
  const timeZone = getClientTimeZone(client)

  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const [year, month, day] = localDate.split('-').map(Number)

  const adjustedDate = new Date(Date.UTC(year, month - 1, day))
  adjustedDate.setUTCDate(adjustedDate.getUTCDate() + offsetDays)

  return adjustedDate.toISOString().slice(0, 10)
}
