import type { CanonicalMuscle } from '@/lib/workout-os/types'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type Weekday = typeof WEEKDAYS[number]
export type WeekdayMuscleDays = Record<Weekday, CanonicalMuscle[]>
export type WeekdayMuscleChoice = { mode: 'program_default' } | { mode: 'custom'; days: WeekdayMuscleDays }

// Presentation returned by the authenticated server; this is not a second
// browser-side distribution or a persisted prescription.
export type WeekdayFocusPlanView = {
  status: 'available' | 'unsupported' | 'unavailable'
  effectiveDate?: string
  mode?: WeekdayMuscleChoice['mode']
  preferredDays?: Array<{ day: Weekday; groups: string[] }>
  workDays?: Weekday[]
  fixedExtraDays?: Array<{ day: Weekday; exercises: string[] }>
  unspecifiedDays?: Weekday[]
  issues?: string[]
  message?: string
}
export type WeekdayFocusPlans = { current: WeekdayFocusPlanView; pending: WeekdayFocusPlanView | null }

export const MUSCLE_GROUP_OPTIONS: ReadonlyArray<{ id: CanonicalMuscle; label: string }> = [
  { id: 'neck', label: 'Neck' }, { id: 'upper_traps', label: 'Upper traps' },
  { id: 'shoulders', label: 'Shoulders' }, { id: 'chest', label: 'Chest' },
  { id: 'upper_back', label: 'Upper back' }, { id: 'lats', label: 'Lats / back' },
  { id: 'rhomboids', label: 'Rhomboids / mid back' }, { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' }, { id: 'forearms', label: 'Forearms' },
  { id: 'lower_back', label: 'Lower back' }, { id: 'core', label: 'Core' },
  { id: 'glutes', label: 'Glutes' }, { id: 'hip_flexors', label: 'Hip flexors' },
  { id: 'quads', label: 'Front thighs / quadriceps' }, { id: 'hamstrings', label: 'Back thighs / hamstrings' },
  { id: 'adductors', label: 'Inner thighs / adductors' }, { id: 'calves', label: 'Back lower legs / calves' },
  { id: 'feet_ankles', label: 'Front lower legs / shins, feet & ankles' },
]
