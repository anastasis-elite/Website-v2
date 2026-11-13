import { activityDose, isBodyweightExercise } from '@/lib/workout/activity'
import { hasNoCalculatedLoad } from '@/lib/workout/loadGuidance'
import { calculateFounderLoadFromEstimated1RM, resolveFounderExerciseReference } from '@/lib/program/founderReference'

type Context = { source?: 'manual' | 'recommended'; projectedExercise?: any }
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown): value is number => numeric(value) && value > 0

function hasRecordedCalculation(exercise: any) {
  const calculation = exercise?.prescription_calculation
  if (calculation?.version !== 'founder-load-v3' || !positive(calculation.estimated_1rm) ||
    !positive(calculation.rep_multiplier)) return false
  const resolved = resolveFounderExerciseReference(exercise.exercise)
  if (resolved.status !== 'resolved' || calculation.reference_exercise !== resolved.reference.exercise ||
    calculation.assessment_key !== resolved.reference.assessment_key ||
    calculation.bodyweight_factor !== resolved.reference.bodyweight_factor ||
    calculation.selected_variant_id !== (exercise.selected_variant_id || null)) return false
  const variant = resolved.group?.variants?.find((item: any) => item.id === exercise.selected_variant_id)
  if (resolved.group && !variant || calculation.equipment_modifier !== (variant?.equipment_modifier ?? 1)) return false
  const expected = calculateFounderLoadFromEstimated1RM({ estimated1RM: calculation.estimated_1rm,
    bodyweightFactor: calculation.bodyweight_factor, bodyMassLb: calculation.body_mass_lb, repMultiplier: calculation.rep_multiplier,
    group: resolved.group, variant, bodyweight: false })
  return calculation.base_weight === expected.baseCalculatedWeight && calculation.equipment_weight === expected.adjustedWeight &&
    positive(calculation.equipment_weight) && exercise.calculated_weight === calculation.equipment_weight
}

/** Presentation only: never annotate or replace the retained session snapshot. */
export function exerciseLoadPresentation(exercise: any, { source = 'recommended', projectedExercise }: Context = {}) {
  if (isBodyweightExercise(exercise)) return { status: 'bodyweight' as const, recommendationAvailable: true, reason: '' }
  const marked = hasNoCalculatedLoad(projectedExercise) ? projectedExercise : hasNoCalculatedLoad(exercise) ? exercise : null
  const weight = exercise?.recommended_weight ?? exercise?.cycle_adjusted_weight ?? exercise?.calculated_weight ?? exercise?.baseline_weight
  if (marked) return { status: marked.load_guidance_status as 'not_calculated' | 'unverified', recommendationAvailable: false,
    reason: String(marked.load_guidance_reason || 'The saved load needs review before it can be used as a current recommendation.') }
  if (!positive(weight)) return { status: 'not_calculated' as const, recommendationAvailable: false,
    reason: 'A load recommendation has not been calculated for this exercise.' }
  if (source === 'recommended' && !hasRecordedCalculation(exercise)) return { status: 'unverified' as const,
    recommendationAvailable: false, reason: 'The saved load needs review before it can be used as a current recommendation.' }
  return { status: 'available' as const, recommendationAvailable: true, reason: '' }
}

export function hasRecordedExerciseWork(exercise: any) {
  return exercise?.completed === true || exercise?.set_logs?.length > 0 ||
    Number(exercise?.actual_reps || exercise?.actual_duration || exercise?.actual_breaths) > 0
}

/** Actual entries retain their original unit. A new unknown external load is
 * blank rather than a fabricated zero or an old recommendation. */
export function actualWeightForInput(exercise: any, unit: 'lb' | 'kg', context: Context = {}, retainedWeight?: number, preserveRetained = false): number {
  if (isBodyweightExercise(exercise)) return 0
  if (preserveRetained && numeric(retainedWeight) && retainedWeight >= 0) return retainedWeight
  const recorded = Array.isArray(exercise?.set_logs) ? [...exercise.set_logs].reverse().find(set =>
    (typeof set?.weight === 'number' || typeof set?.weight === 'string' && set.weight.trim() !== '') &&
    Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0) : null
  if (recorded) {
    const sourceUnit = recorded.weight_unit === 'kg' ? 'kg' : 'lb'
    const factor = unit === sourceUnit ? 1 : unit === 'kg' ? 1 / 2.2046226218 : 2.2046226218
    return Math.round(Number(recorded.weight) * factor * 10) / 10
  }
  return exerciseLoadPresentation(exercise, context).recommendationAvailable ? activityDose(exercise, unit).weight : NaN
}

/** Old browser drafts did not distinguish a suggested load from a typed
 * actual. Keep that original value for review without treating it as entered. */
export function weightDraftForInput(exercise: any, unit: 'lb' | 'kg', context: Context = {}, retained?: any): {
  weight: number; weightEdited: boolean; retainedWeight?: unknown
} {
  const weightEdited = retained?.weightEdited === true
  const guidance = exerciseLoadPresentation(exercise, context)
  const weight = guidance.status === 'bodyweight' ? 0 : weightEdited
    ? numeric(retained.weight) && retained.weight >= 0 ? retained.weight : NaN
    : guidance.recommendationAvailable && numeric(retained?.weight) && retained.weight >= 0 ? retained.weight
    : actualWeightForInput(exercise, unit, context)
  const retainUnknown = !guidance.recommendationAvailable && !weightEdited && retained && Object.hasOwn(retained, 'weight')
  const retainedWeight = retained && Object.hasOwn(retained, 'retainedWeight') ? retained.retainedWeight
    : retainUnknown ? retained.weight : undefined
  return { weight, weightEdited, ...(retainedWeight !== undefined ? { retainedWeight } : {}) }
}
