import { NUTRITION_INTELLIGENCE_CONFIG } from '@/lib/nutrition/intelligenceConfig'

export type HydrationPaceState =
  | 'ahead_of_pace'
  | 'on_pace'
  | 'slightly_behind'
  | 'behind'
  | 'insufficient_data'

export type HydrationPacingInput = {
  consumed: number
  target: number
  now?: Date
  localTimeMinutes?: number
  wakeTime?: string | null
  bedTime?: string | null
}

export type HydrationPacingResult = {
  state: HydrationPaceState
  consumedPercent: number
  expectedPercent: number
  dayElapsedPercent: number
  differenceFromPace: number
  prompt: string
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function parseTime(value: string | null | undefined, fallback: string) {
  const raw = String(value || fallback).slice(0, 5)
  const match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return parseTime(fallback, '07:00')
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return parseTime(fallback, '07:00')
  return clamp(hours, 0, 23) * 60 + clamp(minutes, 0, 59)
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

export function calculateHydrationPacing(input: HydrationPacingInput): HydrationPacingResult {
  const target = Number(input.target)
  const consumed = Number(input.consumed)
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(consumed)) {
    return {
      state: 'insufficient_data',
      consumedPercent: 0,
      expectedPercent: 0,
      dayElapsedPercent: 0,
      differenceFromPace: 0,
      prompt: "We're still learning your hydration pattern.",
    }
  }

  const config = NUTRITION_INTELLIGENCE_CONFIG.hydration
  const wake = parseTime(input.wakeTime, config.defaultWakeTime)
  let bed = parseTime(input.bedTime, config.defaultBedTime)
  if (bed <= wake) bed += 24 * 60

  let current = typeof input.localTimeMinutes === 'number'
    ? input.localTimeMinutes
    : minutesFromDate(input.now || new Date())
  if (current < wake) current += 24 * 60

  const wakingMinutes = Math.max(1, bed - wake)
  const elapsedMinutes = clamp(current - wake, 0, wakingMinutes)
  const dayElapsedPercent = clamp((elapsedMinutes / wakingMinutes) * 100)
  const expectedPercent = dayElapsedPercent
  const consumedPercent = clamp((Math.max(0, consumed) / target) * 100)
  const differenceFromPace = consumedPercent - expectedPercent

  let state: HydrationPaceState = 'behind'
  if (differenceFromPace >= config.aheadTolerance) state = 'ahead_of_pace'
  else if (differenceFromPace >= -config.onPaceTolerance) state = 'on_pace'
  else if (differenceFromPace >= -config.slightlyBehindTolerance) state = 'slightly_behind'

  const promptByState: Record<HydrationPaceState, string> = {
    ahead_of_pace: 'Hydration is ahead of your current day pace. Continue normally.',
    on_pace: 'Hydration is on pace for this point in your day.',
    slightly_behind: 'Hydration is a little behind pace. A small steady add is enough.',
    behind: 'Hydration is behind pace for this point in your day. Keep it steady from here.',
    insufficient_data: "We're still learning your hydration pattern.",
  }

  return {
    state,
    consumedPercent: Math.round(consumedPercent),
    expectedPercent: Math.round(expectedPercent),
    dayElapsedPercent: Math.round(dayElapsedPercent),
    differenceFromPace: Math.round(differenceFromPace),
    prompt: promptByState[state],
  }
}
