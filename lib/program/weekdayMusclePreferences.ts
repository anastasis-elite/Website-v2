import { addLocalDays } from '@/lib/timezone'
import { MUSCLE_GROUP_OPTIONS, WEEKDAYS, type WeekdayMuscleChoice, type WeekdayMuscleDays } from './weekdayMuscleTypes'

export type SavedWeekdayMuscleChoice = {
  choice: WeekdayMuscleChoice; effectiveDate: string; savedAt: string; operationId: string
}
export type WeekdayMusclePreferencesState = {
  version: 1; revision: number; current: SavedWeekdayMuscleChoice | null; pending: SavedWeekdayMuscleChoice
  lastOperation: { id: string; expectedRevision: number; requestedDate: string; choice: WeekdayMuscleChoice }
}
export type WeekdayMusclePreferencesView = {
  revision: number | null; status: 'unset' | 'saved' | 'pending' | 'invalid'
  today: string; timezone: string; nextEffectiveDate: string
  current: SavedWeekdayMuscleChoice | null; pending: SavedWeekdayMuscleChoice | null; lastOperationId: string | null
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))
export const validPreferenceOperationId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function isPreferenceDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
/** Strictly following Monday, using civil days rather than elapsed 24-hour periods. */
export function nextWeekdayPreferenceMonday(today: string): string {
  if (!isPreferenceDate(today)) throw new Error('Invalid member date')
  const day = new Date(today + 'T12:00:00Z').getUTCDay()
  return addLocalDays(today, (8 - day) % 7 || 7)
}
export function parseWeekdayMuscleChoice(input: unknown): WeekdayMuscleChoice | null {
  if (!object(input)) return null
  if (input.mode === 'program_default') return keys(input, ['mode']) ? { mode: 'program_default' } : null
  if (input.mode !== 'custom' || !keys(input, ['mode', 'days']) || !object(input.days) || !keys(input.days, [...WEEKDAYS]) || Object.keys(input.days).length !== 7) return null
  const days = {} as WeekdayMuscleDays
  for (const day of WEEKDAYS) {
    const groups = input.days[day]
    if (!Array.isArray(groups) || groups.length > MUSCLE_GROUP_OPTIONS.length || groups.some(group => typeof group !== 'string' || !MUSCLE_GROUP_OPTIONS.some(option => option.id === group)) || new Set(groups).size !== groups.length) return null
    // Canonical ordering makes retries independent of checkbox click order.
    days[day] = MUSCLE_GROUP_OPTIONS.filter(option => groups.includes(option.id)).map(option => option.id)
  }
  if (!WEEKDAYS.some(day => days[day].length)) return null
  return { mode: 'custom', days }
}
export const sameWeekdayMuscleChoice = (a: WeekdayMuscleChoice, b: WeekdayMuscleChoice) => JSON.stringify(a) === JSON.stringify(b)
function savedChoice(input: unknown): SavedWeekdayMuscleChoice | null {
  if (!object(input) || !keys(input, ['choice', 'effectiveDate', 'savedAt', 'operationId'])) return null
  const choice = parseWeekdayMuscleChoice(input.choice)
  if (!choice || !isPreferenceDate(input.effectiveDate) || new Date(input.effectiveDate + 'T12:00:00Z').getUTCDay() !== 1 || typeof input.savedAt !== 'string' || !Number.isFinite(Date.parse(input.savedAt)) || !validPreferenceOperationId(input.operationId)) return null
  return { choice, effectiveDate: input.effectiveDate, savedAt: input.savedAt, operationId: input.operationId }
}
/** Undefined alone means unset. A malformed saved preference is never silently reset. */
export function readWeekdayMusclePreferences(onboardingData: unknown): WeekdayMusclePreferencesState | null | 'invalid' {
  if (!object(onboardingData) && onboardingData != null) return 'invalid'
  const input = object(onboardingData) ? onboardingData.weekdayMusclePreferences : undefined
  if (input === undefined) return null
  if (!object(input) || !keys(input, ['version', 'revision', 'current', 'pending', 'lastOperation']) || input.version !== 1 || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1 || !object(input.lastOperation) || !keys(input.lastOperation, ['id', 'expectedRevision', 'requestedDate', 'choice'])) return 'invalid'
  const current = input.current === null ? null : savedChoice(input.current), pending = savedChoice(input.pending)
  const lastChoice = parseWeekdayMuscleChoice(input.lastOperation.choice)
  if (current === null && input.current !== null || !pending || !lastChoice || !validPreferenceOperationId(input.lastOperation.id) || input.lastOperation.id !== pending.operationId || input.lastOperation.expectedRevision !== Number(input.revision) - 1 || !isPreferenceDate(input.lastOperation.requestedDate) || nextWeekdayPreferenceMonday(input.lastOperation.requestedDate) !== pending.effectiveDate || !sameWeekdayMuscleChoice(lastChoice, pending.choice) || current && current.effectiveDate >= pending.effectiveDate) return 'invalid'
  return { version: 1, revision: Number(input.revision), current, pending, lastOperation: { id: input.lastOperation.id, expectedRevision: Number(input.lastOperation.expectedRevision), requestedDate: input.lastOperation.requestedDate, choice: lastChoice } }
}
export function getWeekdayMusclePreferencesView(onboardingData: unknown, today: string, timezone: string): WeekdayMusclePreferencesView {
  const state = readWeekdayMusclePreferences(onboardingData)
  const base = { today, timezone, nextEffectiveDate: nextWeekdayPreferenceMonday(today), current: null, pending: null, lastOperationId: null }
  if (state === 'invalid') return { ...base, status: 'invalid', revision: null }
  if (!state) return { ...base, status: 'unset', revision: 0 }
  const current = state.pending.effectiveDate <= today ? state.pending : state.current && state.current.effectiveDate <= today ? state.current : null
  const pending = state.pending.effectiveDate > today ? state.pending : null
  return { ...base, status: pending ? 'pending' : 'saved', revision: state.revision, current, pending, lastOperationId: state.lastOperation.id }
}
export class WeekdayMusclePreferenceConflict extends Error {}
export function mergeWeekdayMusclePreferences(current: Record<string, unknown>, input: {
  expectedRevision: number; operationId: string; choice: WeekdayMuscleChoice; today: string; savedAt: string
}): { onboardingData: Record<string, unknown>; replayed: boolean } {
  const state = readWeekdayMusclePreferences(current)
  const choice = parseWeekdayMuscleChoice(input.choice)
  if (state === 'invalid' || !choice || !validPreferenceOperationId(input.operationId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER) throw new WeekdayMusclePreferenceConflict()
  if (state?.lastOperation.id === input.operationId) {
    if (state.lastOperation.expectedRevision !== input.expectedRevision || state.lastOperation.requestedDate !== input.today || !sameWeekdayMuscleChoice(state.lastOperation.choice, choice)) throw new WeekdayMusclePreferenceConflict()
    return { onboardingData: current, replayed: true }
  }
  if ((state?.revision ?? 0) !== input.expectedRevision) throw new WeekdayMusclePreferenceConflict()
  const active = state ? getWeekdayMusclePreferencesView(current, input.today, '').current : null
  const pending = { choice, effectiveDate: nextWeekdayPreferenceMonday(input.today), savedAt: input.savedAt, operationId: input.operationId }
  const next: WeekdayMusclePreferencesState = { version: 1, revision: input.expectedRevision + 1, current: active, pending,
    lastOperation: { id: input.operationId, expectedRevision: input.expectedRevision, requestedDate: input.today, choice } }
  return { onboardingData: { ...current, weekdayMusclePreferences: next }, replayed: false }
}
