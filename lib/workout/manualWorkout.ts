import masterKey from '@/data/reference/masterKey.json'
import exerciseVariants from '@/data/reference/exerciseVariants.json'
import type { CanonicalMuscle, WorkoutExercise } from '@/lib/workout-os/types'
import {
  MUSCLE_REGIONS,
  getMuscleReadinessPresentation,
  normalizeExerciseMuscles,
  type MuscleReadiness,
  type MuscleReadinessState,
} from '@/lib/workout/muscleReadiness'

export type ManualWorkoutExercise = WorkoutExercise & {
  id: string
  exercise: string
  display_name: string
  equipment: string
  movement_family: string
  movement_family_label: string
  demand_profile: 'higher_loading' | 'moderate' | 'controlled'
  selected_equipment: string
  selected_variant_id: string
  selected_variant_name: string
  available_variants: Array<{
    id: string
    name: string
    equipment: string
    load_type: string
    equipment_modifier: number
  }>
}

export type ManualWorkoutLibraryAudit = {
  totalExercises: number
  muscleGroups: string[]
  equipmentTypes: string[]
  movementFamilies: string[]
  missingPrimaryMuscleMetadata: string[]
  missingSecondaryMuscleMetadata: string[]
  missingEquipmentMetadata: string[]
  missingMovementFamilyMetadata: string[]
  unreachableExercises: string[]
  duplicates: string[]
}

const CANONICAL_MUSCLES: CanonicalMuscle[] = [
  'neck',
  'upper_traps',
  'shoulders',
  'chest',
  'upper_back',
  'lats',
  'rhomboids',
  'biceps',
  'triceps',
  'forearms',
  'lower_back',
  'core',
  'glutes',
  'hip_flexors',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
  'feet_ankles',
]

const EQUIPMENT_ALIASES: Record<string, string> = {
  dumbbells: 'dumbbell',
  bands: 'band',
  resistance_bands: 'band',
  resistance_band: 'band',
  cables: 'cable',
  cable_machine: 'cable',
  machines: 'machine',
  smith_machine: 'smith',
  kettlebells: 'kettlebell',
  pull_up_equipment: 'pull_up',
  full_gym: '*',
  commercial_gym: '*',
  all_equipment: '*',
  gym: '*',
}

const nameEquipmentRules: Array<{ pattern: RegExp; equipment: string }> = [
  { pattern: /bodyweight|push[- ]?up|plank|deadbug|bird ?dog|frog pump/i, equipment: 'bodyweight' },
  { pattern: /dumbbell|goblet/i, equipment: 'dumbbell' },
  { pattern: /barbell|front squat|bench press|skull crusher|rollout/i, equipment: 'barbell' },
  { pattern: /cable|pulldown|pushdown|woodchop|pallof/i, equipment: 'cable' },
  { pattern: /smith/i, equipment: 'smith' },
  { pattern: /machine|pec deck|hack|leg press|leg extension|ham curl|abduction|adduction/i, equipment: 'machine' },
  { pattern: /band/i, equipment: 'band' },
  { pattern: /kettlebell/i, equipment: 'kettlebell' },
  { pattern: /pull[- ]?up|chin[- ]?up/i, equipment: 'pull_up' },
  { pattern: /bench|incline|decline/i, equipment: 'bench' },
]

const movementFamilyRules: Array<{ pattern: RegExp; family: string; label: string }> = [
  { pattern: /hip thrust|glute bridge|frog pump|kickback/i, family: 'hip_extension', label: 'Hip extension' },
  { pattern: /squat|leg press|hack|goblet|front squat/i, family: 'squat', label: 'Squat' },
  { pattern: /lunge|split squat|step[- ]?up/i, family: 'lunge', label: 'Lunge' },
  { pattern: /deadlift|rdl|hinge|good morning|pull[- ]?through/i, family: 'hinge', label: 'Hinge' },
  { pattern: /leg curl|hamstring curl/i, family: 'curl', label: 'Curl' },
  { pattern: /leg extension/i, family: 'extension', label: 'Extension' },
  { pattern: /abduction|abductor/i, family: 'abduction', label: 'Abduction' },
  { pattern: /adduction|adductor/i, family: 'adduction', label: 'Adduction' },
  { pattern: /calf raise/i, family: 'calf_raise', label: 'Calf raise' },
  { pattern: /shoulder press|arnold press|overhead press/i, family: 'press', label: 'Presses' },
  { pattern: /lateral raise|front raise|y[- ]?raise/i, family: 'raise', label: 'Raises' },
  { pattern: /rear delt|reverse pec deck|face ?pull|fly/i, family: 'fly', label: 'Rear delt / fly' },
  { pattern: /external rotation|internal rotation/i, family: 'rotation', label: 'Rotation' },
  { pattern: /bench|push[- ]?up|chest press|incline press|decline press|close[- ]?grip press/i, family: 'horizontal_press', label: 'Horizontal press' },
  { pattern: /row/i, family: 'horizontal_pull', label: 'Horizontal pull' },
  { pattern: /pulldown|pull[- ]?up|chin[- ]?up/i, family: 'vertical_pull', label: 'Vertical pull' },
  { pattern: /pullover/i, family: 'pullover', label: 'Pullover' },
  { pattern: /back extension|hyper ?extension/i, family: 'extension', label: 'Extension' },
  { pattern: /curl/i, family: 'curl', label: 'Curls' },
  { pattern: /pressdown|pushdown/i, family: 'pressdown', label: 'Pressdowns' },
  { pattern: /skull|tricep extension|overhead rope extension|overhead extension/i, family: 'extension', label: 'Extensions' },
  { pattern: /plank|carry|dead ?bug|bird ?dog/i, family: 'stability', label: 'Stability' },
  { pattern: /crunch|leg raise|knee raise|rollout/i, family: 'flexion', label: 'Flexion' },
  { pattern: /pallof|rotation|twist|woodchop/i, family: 'anti_rotation', label: 'Rotation' },
]

const higherDemandRules = /barbell|smith|deadlift|squat|bench|leg press|hip thrust|pull[- ]?up|chin[- ]?up|row/i
const controlledDemandRules = /machine|cable|band|raise|curl|extension|kickback|fly|plank|dead ?bug|bird ?dog|frog pump|rotation/i

function normalizeKey(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function normalizeEquipmentName(value: unknown) {
  const key = normalizeKey(value)
  return EQUIPMENT_ALIASES[key] || key
}

export function normalizeEquipmentList(values: unknown): string[] {
  const raw = Array.isArray(values) ? values : String(values || '').split(',')
  const normalized = raw.map(normalizeEquipmentName).filter(Boolean)
  if (normalized.some((item) => item === '*')) return ['*']
  return Array.from(new Set(['bodyweight', ...normalized]))
}

function variantGroupsForExercise(name: string) {
  const key = normalizeKey(name)
  return (exerciseVariants as any[]).filter((group) => {
    const names = [
      group.display_name,
      ...(Array.isArray(group.aliases) ? group.aliases : []),
      ...(Array.isArray(group.variants) ? group.variants.map((variant: any) => variant.name) : []),
    ].map(normalizeKey)
    return names.includes(key)
  })
}

function inferEquipment(name: string) {
  const direct = nameEquipmentRules.find((rule) => rule.pattern.test(name))?.equipment
  return direct ? [direct] : ['bodyweight']
}

function inferMovementFamily(name: string) {
  const match = movementFamilyRules.find((rule) => rule.pattern.test(name))
  return match || { family: 'general_strength', label: 'General strength' }
}

function inferDemandProfile(name: string): ManualWorkoutExercise['demand_profile'] {
  if (higherDemandRules.test(name)) return 'higher_loading'
  if (controlledDemandRules.test(name)) return 'controlled'
  return 'moderate'
}

function equipmentMatches(exerciseEquipment: string[], selectedEquipment: string[]) {
  if (!selectedEquipment.length || selectedEquipment.includes('*')) return true
  return exerciseEquipment.some((equipment) =>
    selectedEquipment.some((selected) => selected === equipment || selected.includes(equipment) || equipment.includes(selected)),
  )
}

function buildVariants(name: string, equipment: string[]) {
  const groups = variantGroupsForExercise(name)
  const variants = groups.flatMap((group) => group.variants || [])
  const fallback = equipment.map((item) => ({
    id: `${normalizeKey(name)}-${item}`,
    name,
    equipment: item,
    load_type: item === 'bodyweight' ? 'bodyweight' : 'total_load',
    equipment_modifier: 1,
  }))

  return (variants.length ? variants : fallback).map((variant: any) => ({
    id: String(variant.id || `${normalizeKey(name)}-${normalizeEquipmentName(variant.equipment)}`),
    name: String(variant.name || name),
    equipment: normalizeEquipmentName(variant.equipment || equipment[0] || 'bodyweight'),
    load_type: String(variant.load_type || (normalizeEquipmentName(variant.equipment) === 'bodyweight' ? 'bodyweight' : 'total_load')),
    equipment_modifier: Number(variant.equipment_modifier || 1),
  }))
}

function buildExercise(row: any): ManualWorkoutExercise {
  const name = String(row.exercise || 'Exercise')
  const variantEquipment = variantGroupsForExercise(name).flatMap((group) =>
    (group.variants || []).map((variant: any) => normalizeEquipmentName(variant.equipment)),
  )
  const equipment = Array.from(new Set(variantEquipment.length ? variantEquipment : inferEquipment(name)))
  const availableVariants = buildVariants(name, equipment)
  const selected = availableVariants[0]
  const muscles = normalizeExerciseMuscles({ exercise: name })
  const [primary, ...secondary] = muscles
  const movementFamily = inferMovementFamily(name)

  return {
    id: `manual-${normalizeKey(name)}`,
    exercise: name,
    name,
    display_name: name,
    exercise_category: 'strength',
    movement_type: movementFamily.family,
    movement_family: movementFamily.family,
    movement_family_label: movementFamily.label,
    demand_profile: inferDemandProfile(name),
    primary_muscles: primary ? [primary] : [],
    secondary_muscles: secondary,
    intended_muscles: muscles,
    compensatory_muscles: [],
    equipment: selected.equipment,
    selected_equipment: selected.equipment,
    selected_variant_id: selected.id,
    selected_variant_name: selected.name,
    available_variants: availableVariants,
    sets: 3,
    reps: 10,
    recommended_reps: 10,
    baseline_reps: 10,
    calculated_weight: 0,
    recommended_weight: 0,
    baseline_weight: 0,
    load_type: selected.load_type,
    rest_seconds: 90,
    rpe_target: 'RPE 7',
  }
}

export const MANUAL_WORKOUT_MUSCLES = CANONICAL_MUSCLES

export function getManualWorkoutLibrary() {
  return (masterKey as any[]).map(buildExercise)
}

export function filterManualExercises({
  muscles,
  equipment,
  movementFamily,
  search = '',
}: {
  muscles: CanonicalMuscle[]
  equipment: string[]
  movementFamily?: string | null
  search?: string
}) {
  const query = search.trim().toLowerCase()
  const selectedEquipment = normalizeEquipmentList(equipment)

  return getManualWorkoutLibrary().filter((exercise) => {
    const exerciseMuscles = new Set(normalizeExerciseMuscles(exercise))
    const muscleMatch = !muscles.length || muscles.some((muscle) => exerciseMuscles.has(muscle))
    const exerciseEquipment = Array.from(new Set(exercise.available_variants.map((variant) => variant.equipment)))
    const equipmentMatch = equipmentMatches(exerciseEquipment, selectedEquipment)
    const movementMatch = !movementFamily || exercise.movement_family === movementFamily
    const searchable = [
      exercise.exercise,
      exercise.display_name,
      exercise.primary_muscles?.join(' '),
      exercise.secondary_muscles?.join(' '),
      exerciseEquipment.join(' '),
      exercise.movement_type,
      exercise.movement_family_label,
    ].join(' ').toLowerCase()

    return muscleMatch && equipmentMatch && movementMatch && (!query || searchable.includes(query))
  })
}

export function getAvailableEquipmentForMuscles(muscles: CanonicalMuscle[]) {
  return Array.from(new Set(
    filterManualExercises({ muscles, equipment: ['*'] })
      .flatMap((exercise) => exercise.available_variants.map((variant) => variant.equipment)),
  )).sort()
}

export function getAvailableMovementFamilies({
  muscles,
  equipment,
}: {
  muscles: CanonicalMuscle[]
  equipment: string[]
}) {
  const families = new Map<string, string>()
  filterManualExercises({ muscles, equipment }).forEach((exercise) => {
    families.set(exercise.movement_family, exercise.movement_family_label)
  })
  return Array.from(families.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getReadinessSummaryForCanonicalMuscle(readiness: MuscleReadiness[], muscle: CanonicalMuscle) {
  const regionIds = MUSCLE_REGIONS
    .filter((region) => region.canonicalMuscles.includes(muscle))
    .map((region) => region.id)
  const rows = readiness.filter((item) => regionIds.includes(item.muscleId))
  const state = getReadinessForCanonicalMuscle(readiness, muscle)
  const scores = rows
    .map((item) => item.readinessScore)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
  const score = scores.length ? Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length) : undefined
  const presentation = getMuscleReadinessPresentation(state)
  const reason = rows.find((item) => item.reasons?.length)?.reasons?.[0]

  return {
    state,
    score,
    label: presentation.label,
    guidance: presentation.guidance,
    reason,
  }
}

export function sortManualExercisesByReadiness(exercises: ManualWorkoutExercise[], state: MuscleReadinessState) {
  const demandRank: Record<ManualWorkoutExercise['demand_profile'], number> =
    state === 'ready'
      ? { higher_loading: 0, moderate: 1, controlled: 2 }
      : state === 'available'
        ? { moderate: 0, controlled: 1, higher_loading: 2 }
        : { controlled: 0, moderate: 1, higher_loading: 2 }

  return [...exercises].sort((first, second) => {
    const demandDifference = demandRank[first.demand_profile] - demandRank[second.demand_profile]
    if (demandDifference !== 0) return demandDifference
    return first.display_name.localeCompare(second.display_name)
  })
}

export function getReadinessForCanonicalMuscle(readiness: MuscleReadiness[], muscle: CanonicalMuscle): MuscleReadinessState {
  const regionIds = MUSCLE_REGIONS
    .filter((region) => region.canonicalMuscles.includes(muscle))
    .map((region) => region.id)
  const rankedStates: MuscleReadinessState[] = ['rest', 'recovering', 'available', 'ready', 'unknown']
  const states = readiness.filter((item) => regionIds.includes(item.muscleId)).map((item) => item.state)
  return rankedStates.find((state) => states.includes(state)) || 'unknown'
}

export function auditManualWorkoutLibrary(): ManualWorkoutLibraryAudit {
  const exercises = getManualWorkoutLibrary()
  const names = exercises.map((exercise) => exercise.exercise)
  const counts = names.reduce<Record<string, number>>((map, name) => {
    const key = normalizeKey(name)
    map[key] = (map[key] || 0) + 1
    return map
  }, {})

  return {
    totalExercises: exercises.length,
    muscleGroups: Array.from(new Set(exercises.flatMap((exercise) => normalizeExerciseMuscles(exercise)))).sort(),
    equipmentTypes: Array.from(new Set(exercises.flatMap((exercise) => exercise.available_variants.map((variant) => variant.equipment)))).sort(),
    movementFamilies: Array.from(new Set(exercises.map((exercise) => exercise.movement_family))).sort(),
    missingPrimaryMuscleMetadata: exercises.filter((exercise) => !exercise.primary_muscles?.length).map((exercise) => exercise.exercise),
    missingSecondaryMuscleMetadata: exercises.filter((exercise) => !exercise.secondary_muscles?.length).map((exercise) => exercise.exercise),
    missingEquipmentMetadata: exercises.filter((exercise) => !exercise.available_variants.length).map((exercise) => exercise.exercise),
    missingMovementFamilyMetadata: exercises.filter((exercise) => exercise.movement_family === 'general_strength').map((exercise) => exercise.exercise),
    unreachableExercises: exercises.filter((exercise) => {
      const muscles = normalizeExerciseMuscles(exercise)
      const equipment = exercise.available_variants.map((variant) => variant.equipment)
      return !muscles.length || !equipment.length || !exercise.movement_family
    }).map((exercise) => exercise.exercise),
    duplicates: Object.entries(counts).filter(([, count]) => count > 1).map(([key]) => key),
  }
}
