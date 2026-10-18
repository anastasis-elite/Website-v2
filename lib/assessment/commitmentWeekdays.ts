export const COMMITMENT_WEEKDAYS = [
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  { value: 0, label: 'Sunday', shortLabel: 'Sun' },
] as const

export const ALL_COMMITMENT_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]
export const COMMITMENT_DAY_FIELDS = [
  'work_days_of_week', 'school_dropoff_days_of_week', 'school_pickup_days_of_week',
] as const
export type CommitmentDayField = typeof COMMITMENT_DAY_FIELDS[number]

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function weekdays(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || Array.from(value).some(day => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6)) return undefined
  return [...new Set(value)].sort((left, right) => left - right)
}

/** Absence retains legacy daily anchors until the member saves their days. */
export function getCommitmentWeekdays(client: any, field: CommitmentDayField): number[] | undefined {
  const metadata = record(record(client?.onboarding_data).scheduleCommitmentWeekdays)
  return Object.prototype.hasOwnProperty.call(metadata, field) ? weekdays(metadata[field]) : undefined
}

/** Merge only supplied validated choices; older clients omit these fields. */
export function mergeCommitmentWeekdays(onboardingData: Record<string, any>, answers: Record<string, unknown>): Record<string, any> {
  const metadata = { ...record(onboardingData.scheduleCommitmentWeekdays) }
  let changed = false
  for (const field of COMMITMENT_DAY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(answers, field)) continue
    const days = weekdays(answers[field])
    if (days === undefined) continue
    metadata[field] = days
    changed = true
  }
  return changed ? { ...onboardingData, scheduleCommitmentWeekdays: metadata } : { ...onboardingData }
}

/** Weekday choices live in JSON, never in unprovisioned client columns. */
export function scheduleStructureProfileFields(answers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(answers).filter(([field]) => !COMMITMENT_DAY_FIELDS.includes(field as CommitmentDayField)))
}
