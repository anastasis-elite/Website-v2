import masterKey from '@/data/reference/masterKey.json'
import exerciseVariants from '@/data/reference/exerciseVariants.json'
import type { CanonicalMuscle, WorkoutExercise } from '@/lib/workout-os/types'
import { MUSCLE_REGIONS, normalizeExerciseMuscles, type MuscleReadiness, type MuscleReadinessState } from '@/lib/workout/muscleReadiness'

export type ManualWorkoutExercise = WorkoutExercise & {
  id: string
  exercise: string
  display_name: string
  equipment: string
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
  missingPrimaryMuscleMetadata: string[]
  missingSecondaryMuscleMetadata: string[]
  missingEquipmentMetadata: string[]
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

  return {
    id: `manual-${normalizeKey(name)}`,
    exercise: name,
    name,
    display_name: name,
    exercise_category: 'strength',
    movement_type: String(row.Notes || row.notes || 'manual').toLowerCase().includes('core') ? 'core' : 'strength',
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
  search = '',
}: {
  muscles: CanonicalMuscle[]
  equipment: string[]
  search?: string
}) {
  const query = search.trim().toLowerCase()
  const selectedEquipment = normalizeEquipmentList(equipment)

  return getManualWorkoutLibrary().filter((exercise) => {
    const exerciseMuscles = new Set(normalizeExerciseMuscles(exercise))
    const muscleMatch = !muscles.length || muscles.some((muscle) => exerciseMuscles.has(muscle))
    const exerciseEquipment = Array.from(new Set(exercise.available_variants.map((variant) => variant.equipment)))
    const equipmentMatch = equipmentMatches(exerciseEquipment, selectedEquipment)
    const searchable = [
      exercise.exercise,
      exercise.display_name,
      exercise.primary_muscles?.join(' '),
      exercise.secondary_muscles?.join(' '),
      exerciseEquipment.join(' '),
      exercise.movement_type,
    ].join(' ').toLowerCase()

    return muscleMatch && equipmentMatch && (!query || searchable.includes(query))
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
    missingPrimaryMuscleMetadata: exercises.filter((exercise) => !exercise.primary_muscles?.length).map((exercise) => exercise.exercise),
    missingSecondaryMuscleMetadata: exercises.filter((exercise) => !exercise.secondary_muscles?.length).map((exercise) => exercise.exercise),
    missingEquipmentMetadata: exercises.filter((exercise) => !exercise.available_variants.length).map((exercise) => exercise.exercise),
    duplicates: Object.entries(counts).filter(([, count]) => count > 1).map(([key]) => key),
  }
}
