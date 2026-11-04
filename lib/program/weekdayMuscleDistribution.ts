import 'server-only'

import { resolveProgramDayIntent } from '@/lib/program/templateDayIntent'
import { resolveVersionedWeekdayExerciseMappings } from '@/lib/program/weekdayExerciseMapping'
import { MUSCLE_GROUP_OPTIONS, WEEKDAYS } from '@/lib/program/weekdayMuscleTypes'
import type { Weekday, WeekdayMuscleDays } from '@/lib/program/weekdayMuscleTypes'
import type { CanonicalMuscle } from '@/lib/workout-os/types'

export type WeekdayDistributionDay = Record<string, unknown> & {
  day_name: Weekday
  day_intent: 'training' | 'rest'
  focus: string
  exercises: Record<string, unknown>[]
}

export type WeekdayDistributionIssue = {
  code: string
  message: string
  day?: string
  exercise?: string
}

export type RetainedWeekdayEntry = {
  day: string
  exercise: string
  reason: string
  requiresOwnerDecision: boolean
}

type SourcePresentation = {
  retainedEntries?: RetainedWeekdayEntry[]
  mappingProvenance?: string
  unspecifiedWeekdays?: Weekday[]
}

export type WeekdayDistributionResult = SourcePresentation & ({
  status: 'supported'
  days: WeekdayDistributionDay[]
  trainingDayCount: number
  exerciseCount: number
  preferredDays: Weekday[]
  workDays: Weekday[]
  fixedExtraDays: Weekday[]
  unspecifiedWeekdays: Weekday[]
} | {
  status: 'unsupported'
  issues: WeekdayDistributionIssue[]
})

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const muscleLabels = new Map<string, string>(MUSCLE_GROUP_OPTIONS.map(option => [option.id, option.label]))
const isWeekday = (value: unknown): value is Weekday => typeof value === 'string' && (WEEKDAYS as readonly string[]).includes(value)
// Diagnostics name the verified prescribed identity, even when generated UI
// metadata uses a broader display alias. The saved object is never changed.
const exerciseName = (exercise: Record<string, unknown>) => [exercise.exercise, exercise.name, exercise.display_name]
  .find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim()

type SourceOccurrence = {
  exercise: Record<string, unknown>
  name: string
  day: Weekday
  primaryMuscles: CanonicalMuscle[]
  pinned?: { category: 'ambiguous' | 'non_strength' | 'unknown'; reason: string; ownerDecision: string }
}
export type ProgramWeekSourceStatus = SourcePresentation & ({
  status: 'available'
  trainingDayCount: number
  exerciseCount: number
  availableGroups: CanonicalMuscle[]
  workDays: Weekday[]
  unspecifiedWeekdays: Weekday[]
} | { status: 'unsupported'; issues: WeekdayDistributionIssue[] })

function readProgramWeekSource({ programJson, outputProgram }: { programJson: unknown; outputProgram?: unknown }) {
  const issues: WeekdayDistributionIssue[] = []
  if (!record(programJson) || !Array.isArray(programJson.days) || programJson.days.length === 0 || programJson.days.length > 7) {
    return { status: 'unsupported' as const, issues: [{ code: 'missing_program_week', message: 'Your saved prescribed week is unavailable or incomplete. Your current plan has been kept.' }] }
  }
  // Even explicit primary arrays in an unknown or modified saved output do not
  // establish provenance. Only the bounded, version-matched source adapter may
  // supply redistribution metadata; this never annotates or rewrites the plan.
  const mapped = resolveVersionedWeekdayExerciseMappings({ programJson, outputProgram })
  if (mapped.status === 'unsupported') return mapped
  const mappingProvenance = `${mapped.provenance.templateProgram} ${mapped.provenance.templateVersion}; ${mapped.provenance.mappingVersion}`
  const retainedEntries: RetainedWeekdayEntry[] = []
  const mappedByDay = new Map<Weekday, Map<number, (typeof mapped.occurrences)[number]>>()
  for (const occurrence of mapped.occurrences) {
    if (!mappedByDay.has(occurrence.day)) mappedByDay.set(occurrence.day, new Map())
    mappedByDay.get(occurrence.day)!.set(occurrence.index, occurrence)
  }
  const sourceDays = new Map<Weekday, Record<string, unknown>>()
  const occurrences: SourceOccurrence[] = []
  const presentMuscles = new Set<CanonicalMuscle>()
  let trainingDayCount = 0
  let exerciseCount = 0
  for (const source of programJson.days) {
    if (!record(source) || !isWeekday(source.day_name) || sourceDays.has(source.day_name) || !Array.isArray(source.exercises)) {
      issues.push({ code: 'invalid_program_day', message: 'Your saved week has an unavailable, repeated or incomplete weekday. Your current plan has been kept.' })
      continue
    }
    const day = source.day_name
    sourceDays.set(day, source)
    const intent = resolveProgramDayIntent(source, programJson, outputProgram) ??
      (source.day_intent === undefined && source.exercises.length > 0 ? 'training' : null)
    if (!intent || (intent === 'rest' && source.exercises.length !== 0) || (intent === 'training' && source.exercises.length === 0)) {
      issues.push({ code: 'incomplete_program_day', day, message: `${day}'s saved training or rest prescription is incomplete. Your current plan has been kept.` })
      continue
    }
    if (intent === 'rest') continue
    trainingDayCount += 1
    for (const [index, exercise] of source.exercises.entries()) {
      exerciseCount += 1
      const name = record(exercise) ? exerciseName(exercise) : undefined
      if (!record(exercise) || !name) {
        issues.push({ code: 'invalid_exercise', day, message: `${day} includes an unnamed or unavailable prescription that cannot be redistributed.` })
        continue
      }
      const occurrence = mappedByDay.get(day)?.get(index)
      if (!occurrence || occurrence.exercise !== exercise) {
        issues.push({ code: 'unverified_prescription', day, exercise: name,
          message: `${name} could not be matched to its saved source prescription. Your current plan has been kept.` })
        continue
      }
      if (occurrence.mapping.kind === 'pinned') {
        const pinned = occurrence.mapping
        retainedEntries.push({ day, exercise: name, reason: pinned.reason,
          requiresOwnerDecision: false })
        occurrences.push({ exercise, name, day, primaryMuscles: [], pinned })
        continue
      }
      const primary = occurrence.mapping.primaryMuscles
      if (!Array.isArray(primary) || primary.length === 0) {
        issues.push({ code: 'missing_muscle_mapping', day, exercise: name,
          message: `${name} has no verified primary-muscle mapping. It cannot be moved safely; your current plan has been kept.` })
        continue
      }
      if (primary.some(muscle => typeof muscle !== 'string' || !muscleLabels.has(muscle))) {
        issues.push({ code: 'unsupported_muscle_mapping', day, exercise: name,
          message: `${name} has an unsupported verified primary-muscle mapping. Your current plan has been kept.` })
        continue
      }
      const primaryMuscles = [...new Set(primary)] as CanonicalMuscle[]
      for (const muscle of primaryMuscles) presentMuscles.add(muscle)
      occurrences.push({ exercise, name, day, primaryMuscles })
    }
  }
  // An absent source day is unknown, not a newly inferred rest day. It remains
  // absent from projections and cannot receive a preferred focus.
  const unspecifiedWeekdays = WEEKDAYS.filter(day => !sourceDays.has(day))
  if (trainingDayCount === 0) issues.push({ code: 'missing_training_week', message: 'A complete saved training week is needed before changing its muscle-group weekdays.' })
  if (issues.length) return { status: 'unsupported' as const, issues, retainedEntries, mappingProvenance, unspecifiedWeekdays }
  return { status: 'available' as const, sourceDays, occurrences, trainingDayCount, exerciseCount,
    retainedEntries, mappingProvenance, unspecifiedWeekdays,
    workDays: WEEKDAYS.filter(day => occurrences.some(occurrence => occurrence.day === day)),
    availableGroups: MUSCLE_GROUP_OPTIONS.map(option => option.id).filter(muscle => presentMuscles.has(muscle)) }
}

/** Inspect availability without inventing a custom schedule or using name inference. */
export function inspectProgramWeekSource(input: { programJson: unknown; outputProgram?: unknown }): ProgramWeekSourceStatus {
  const source = readProgramWeekSource(input)
  if (source.status === 'unsupported') return source
  return { status: 'available', trainingDayCount: source.trainingDayCount,
    exerciseCount: source.exerciseCount, availableGroups: source.availableGroups,
    retainedEntries: source.retainedEntries, mappingProvenance: source.mappingProvenance,
    unspecifiedWeekdays: source.unspecifiedWeekdays, workDays: source.workDays }
}

/**
 * Read-only weekly projection. Only exact, version-verified source metadata can
 * move a prescription. Focus preferences are not exclusive: unselected clear
 * work, ambiguous work and non-strength activity keep their prescribed day.
 *
 * Exercise occurrences retain their original objects, including repeated named
 * exercises, order, dose, load semantics and equipment. No generator is called.
 */
export function redistributeProgramWeek({ programJson, outputProgram, days }: {
  programJson: unknown
  outputProgram?: unknown
  days: WeekdayMuscleDays
}): WeekdayDistributionResult {
  const issues: WeekdayDistributionIssue[] = []
  const unsupported = (): WeekdayDistributionResult => ({ status: 'unsupported', issues })
  if (!record(days) || Object.keys(days).length !== 7 || Object.keys(days).some(day => !isWeekday(day))) {
    issues.push({ code: 'invalid_weekdays', message: 'Choose muscle groups using the seven named weekdays.' })
    return unsupported()
  }

  const destinations = new Map<CanonicalMuscle, Weekday>()
  const requestedDays: Weekday[] = []
  for (const day of WEEKDAYS) {
    const groups: unknown = days[day]
    if (!Array.isArray(groups) || groups.some(group => typeof group !== 'string' || !muscleLabels.has(group)) || new Set(groups).size !== groups.length) {
      issues.push({ code: 'invalid_muscle_group', day, message: `${day} contains an unavailable or repeated muscle group.` })
      continue
    }
    if (groups.length) requestedDays.push(day)
    for (const group of groups as CanonicalMuscle[]) {
      if (destinations.has(group)) {
        issues.push({ code: 'multiple_group_days', day, message: `Choose one weekday for ${muscleLabels.get(group)}; splitting its existing prescriptions between days is not defined.` })
      } else destinations.set(group, day)
    }
  }
  if (issues.length) return unsupported()

  const source = readProgramWeekSource({ programJson, outputProgram })
  if (source.status === 'unsupported') return source
  const { sourceDays, occurrences, trainingDayCount, exerciseCount, availableGroups,
    retainedEntries, mappingProvenance, unspecifiedWeekdays } = source
  const presentation = { retainedEntries, mappingProvenance, unspecifiedWeekdays }
  for (const day of requestedDays) {
    if (!sourceDays.has(day)) issues.push({ code: 'unspecified_destination', day,
      message: `${day} is not prescribed in your verified source week. Its training or rest intent is unspecified, so no work can be moved there.` })
  }
  const occurrenceDestinations = new Map<SourceOccurrence, Weekday>()
  const incoming = new Map<Weekday, Record<string, unknown>[]>(WEEKDAYS.map(day => [day, []]))
  for (const occurrence of occurrences) {
    const { exercise, name, day, primaryMuscles, pinned } = occurrence
    if (pinned) { occurrenceDestinations.set(occurrence, day); continue }
    // A focus is a preference for reviewed work, not a requirement to assign
    // every primary group in the week. Unselected work stays exactly in place.
    const candidateDays = new Set(primaryMuscles.flatMap(muscle => destinations.has(muscle) ? [destinations.get(muscle)!] : []))
    if (candidateDays.size === 0) { occurrenceDestinations.set(occurrence, day); continue }
    if (candidateDays.size !== 1) {
      issues.push({ code: 'ambiguous_prescription', day, exercise: name,
        message: `${name} has primary groups assigned to different weekdays. Keep those groups together to preserve the existing exercise.` })
      continue
    }
    const destination = [...candidateDays][0]
    occurrenceDestinations.set(occurrence, destination)
    if (destination !== day) incoming.get(destination)!.push(exercise)
  }
  for (const [muscle, day] of destinations) {
    if (!availableGroups.includes(muscle)) issues.push({ code: 'no_prescribed_group', day,
      message: `There is no supported saved primary work for ${muscleLabels.get(muscle)}. A preference cannot add exercises or weekly sets.` })
  }
  const assignments = new Map<Weekday, Record<string, unknown>[]>()
  for (const [day, sourceDay] of sourceDays) {
    const original = occurrences.filter(occurrence => occurrence.day === day)
    const additions = incoming.get(day)!
    const firstWorkSlot = original.findIndex(occurrence => !occurrence.pinned)
    if (additions.length && original.length && firstWorkSlot < 0) {
      issues.push({ code: 'unestablished_insertion_order', day,
        message: `${day} contains only fixed prescribed activities. A safe position for incoming exercise work is not established, so your current plan has been kept.` })
    }
    // The verified source sequence supplies the work slot: incoming work stays
    // after its fixed prefix and before its fixed suffix. This preserves every
    // original fixed entry's order without guessing what an unclear activity is.
    // An explicitly empty source rest day has no ordering constraints; the total
    // established workday count is still checked below.
    const projected: Record<string, unknown>[] = []
    for (const [index, occurrence] of original.entries()) {
      if (index === firstWorkSlot) projected.push(...additions)
      if (occurrenceDestinations.get(occurrence) === day) projected.push(occurrence.exercise)
    }
    if (!original.length && Array.isArray(sourceDay.exercises) && !sourceDay.exercises.length) projected.push(...additions)
    assignments.set(day, projected)
  }
  const workDays = WEEKDAYS.filter(day => Boolean(assignments.get(day)?.length))
  if (workDays.length !== trainingDayCount) issues.push({ code: 'training_day_count',
    message: `Your saved plan prescribes ${trainingDayCount} workdays. These preferences would produce ${workDays.length}; keep the established frequency without adding or dropping prescribed work.` })
  for (const day of requestedDays) {
    if (sourceDays.has(day) && !assignments.get(day)?.length) issues.push({ code: 'empty_selected_day', day,
      message: `${day} would have no existing prescribed work. A preference cannot create exercises or weekly sets to fill it.` })
  }
  if (issues.length) return { status: 'unsupported', issues, ...presentation }

  return {
    status: 'supported', trainingDayCount: workDays.length, exerciseCount, ...presentation,
    preferredDays: requestedDays, workDays,
    fixedExtraDays: workDays.filter(day => !requestedDays.includes(day) && occurrences.some(occurrence => occurrence.day === day && occurrence.pinned)),
    days: [...sourceDays].map(([day, sourceDay]) => ({
      ...sourceDay,
      day_name: day,
      day_intent: assignments.get(day)!.length ? 'training' : 'rest',
      focus: days[day].length ? days[day].map(muscle => muscleLabels.get(muscle)).join(' + ') :
        typeof sourceDay.focus === 'string' ? sourceDay.focus : '',
      exercises: assignments.get(day)!,
    })),
  }
}
