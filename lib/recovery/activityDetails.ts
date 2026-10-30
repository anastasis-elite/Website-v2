export const SOAK_ADDITIONS = ['epsom_salts', 'herbs', 'tea', 'oats', 'other', 'none'] as const
export type SoakAddition = typeof SOAK_ADDITIONS[number]

type ManualRecoveryDetails = { source: 'manual'; durationMinutes: number }
export type SlowWalkDetails = ManualRecoveryDetails & {
  kind: 'slow_walk'
  distance?: number
  distanceUnit?: 'mi' | 'km'
  distanceMeters?: number
  paceSecondsPerKm?: number
  heartRateBpm?: number
}
export type WarmSoakDetails = ManualRecoveryDetails & {
  kind: 'warm_soak'
  temperature?: number
  temperatureUnit?: 'F' | 'C'
  temperatureCelsius?: number
  additions: SoakAddition[]
  herbs?: string
  tea?: string
  other?: string
}
export type RecoveryActivityDetails = SlowWalkDetails | WarmSoakDetails

export function calculateWalkPace(minutes: number, distance: number): number | null {
  if (!Number.isFinite(minutes) || !Number.isFinite(distance) || minutes <= 0 || minutes > 1440 || distance <= 0 || distance > 1000) return null
  const pace = minutes / distance
  return Number.isFinite(pace) && pace > 0 ? pace : null
}

export function distanceToMeters(distance: number, unit: 'mi' | 'km'): number {
  return distance * (unit === 'mi' ? 1609.344 : 1000)
}

export function temperatureToCelsius(temperature: number, unit: 'F' | 'C'): number {
  return unit === 'F' ? (temperature - 32) * 5 / 9 : temperature
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function number(value: unknown, label: string, minimum: number, maximum: number, exclusiveMinimum = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value > maximum ||
    (exclusiveMinimum ? value <= minimum : value < minimum)) {
    throw new Error(`${label} must be a valid number ${exclusiveMinimum ? 'greater than' : 'at least'} ${minimum} and no more than ${maximum}.`)
  }
  return value
}

function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('Unexpected recovery detail. Please review your entries.')
}

function namedAddition(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Describe ${label} in 1–120 characters.`)
  }
  return value.trim()
}

/** Validate the manual option sheets without applying legacy duration defaults. */
export function validateDetailedRecovery(body: {
  activityType?: unknown; minutes?: unknown; requestId?: unknown; details?: unknown
}): { requestId: string; durationMinutes: number; details: RecoveryActivityDetails } {
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)) {
    throw new Error('A valid save identifier is required. Close and reopen this activity to try again.')
  }
  const durationMinutes = number(body.minutes, 'Duration in minutes', 0, 1440, true)
  const raw = body.details
  if (!object(raw) || raw.source !== 'manual') throw new Error('Recovery details must use manually entered information.')

  if (raw.kind === 'slow_walk' && body.activityType === 'Gentle walk') {
    onlyKeys(raw, ['kind', 'source', 'distance', 'distanceUnit', 'heartRateBpm'])
    const details: SlowWalkDetails = { kind: 'slow_walk', source: 'manual', durationMinutes }
    if (raw.distance !== undefined) {
      const distance = number(raw.distance, 'Distance', 0, 1000, true)
      if (raw.distanceUnit !== 'mi' && raw.distanceUnit !== 'km') throw new Error('Choose miles or kilometres for distance.')
      const distanceMeters = distanceToMeters(distance, raw.distanceUnit)
      const pace = durationMinutes / (distanceMeters / 1000)
      if (!Number.isFinite(pace * 60) || pace <= 0) throw new Error('Duration and distance must produce a valid pace.')
      Object.assign(details, { distance, distanceUnit: raw.distanceUnit, distanceMeters, paceSecondsPerKm: pace * 60 })
    } else if (raw.distanceUnit !== undefined) {
      throw new Error('Enter a distance before choosing its unit.')
    }
    if (raw.heartRateBpm !== undefined) {
      const heartRateBpm = number(raw.heartRateBpm, 'Manual heart rate', 1, 300)
      if (!Number.isInteger(heartRateBpm)) throw new Error('Manual heart rate must be a whole number.')
      details.heartRateBpm = heartRateBpm
    }
    return { requestId: body.requestId.toLowerCase(), durationMinutes: Math.floor(durationMinutes), details }
  }

  if (raw.kind === 'warm_soak' && body.activityType === 'Warm soak') {
    onlyKeys(raw, ['kind', 'source', 'temperature', 'temperatureUnit', 'additions', 'herbs', 'tea', 'other'])
    const details: WarmSoakDetails = { kind: 'warm_soak', source: 'manual', durationMinutes, additions: [] }
    if (raw.temperature !== undefined) {
      if (raw.temperatureUnit !== 'F' && raw.temperatureUnit !== 'C') throw new Error('Choose Fahrenheit or Celsius for temperature.')
      if (typeof raw.temperature !== 'number' || !Number.isFinite(raw.temperature)) throw new Error('Approximate temperature must be a valid number.')
      const temperatureCelsius = temperatureToCelsius(raw.temperature, raw.temperatureUnit)
      number(temperatureCelsius, 'Approximate temperature in Celsius', -273.15, 1000)
      Object.assign(details, { temperature: raw.temperature, temperatureUnit: raw.temperatureUnit, temperatureCelsius })
    } else if (raw.temperatureUnit !== undefined) {
      throw new Error('Enter a temperature before choosing its unit.')
    }
    if (raw.additions !== undefined) {
      if (!Array.isArray(raw.additions) || raw.additions.length > SOAK_ADDITIONS.length ||
        raw.additions.some(value => !SOAK_ADDITIONS.includes(value as SoakAddition)) || new Set(raw.additions).size !== raw.additions.length) {
        throw new Error('Choose valid soak additions without duplicates.')
      }
      details.additions = SOAK_ADDITIONS.filter(value => (raw.additions as unknown[]).includes(value))
    }
    if (details.additions.includes('none') && details.additions.length !== 1) throw new Error('Choose None on its own, or select your additions.')
    for (const field of ['herbs', 'tea', 'other'] as const) {
      if (details.additions.includes(field)) details[field] = namedAddition(raw[field], field === 'other' ? 'other additions' : field)
      else if (raw[field] !== undefined) throw new Error(`Select ${field === 'other' ? 'Other' : field} before describing it.`)
    }
    return { requestId: body.requestId.toLowerCase(), durationMinutes: Math.floor(durationMinutes), details }
  }
  throw new Error('Recovery details do not match the selected activity.')
}

/** JSONB reorders keys, so compare content rather than serialization order. */
export function sameRecoveryDetails(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameRecoveryDetails(value, right[index]))
  if (!object(left) || !object(right)) return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameRecoveryDetails(left[key], right[key]))
}
