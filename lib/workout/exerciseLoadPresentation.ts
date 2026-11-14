import { activityDose, isBodyweightExercise } from '@/lib/workout/activity'
import { hasNoCalculatedLoad } from '@/lib/workout/loadGuidance'
import { resolveFounderExerciseReference } from '@/lib/program/founderReference'
import { canVerifySavedLoad, hasVerifiedSavedPrescription } from '@/lib/workout/issuedPrescription'

type Context = { source?: 'manual' | 'recommended'; projectedExercise?: any }
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown): value is number => numeric(value) && value > 0

/** Presentation only: never annotate or replace the retained session snapshot. */
export function exerciseLoadPresentation(exercise: any, { source = 'recommended', projectedExercise }: Context = {}) {
  if (isBodyweightExercise(exercise)) return { status: 'bodyweight' as const, recommendationAvailable: true, reason: '' }
  const resolved = resolveFounderExerciseReference(exercise?.exercise)
  if (resolved.status === 'resolved' && resolved.group?.requires_variant_assessment && exercise?.selected_variant_id) {
    const variant = resolved.group.variants.find((item: any) => item.id === exercise.selected_variant_id)
    if (!variant || variant.name !== resolved.reference.exercise) return { status: 'not_calculated' as const,
      recommendationAvailable: false, reason: 'No verified load is available for this substituted equipment. Enter the actual weight you use.' }
  }
  const verified = hasVerifiedSavedPrescription(exercise)
  const candidate = hasNoCalculatedLoad(projectedExercise) ? projectedExercise : hasNoCalculatedLoad(exercise) ? exercise : null
  const marked = candidate && !(verified && canVerifySavedLoad(candidate)) ? candidate : null
  const weight = exercise?.recommended_weight ?? exercise?.cycle_adjusted_weight ?? exercise?.calculated_weight ?? exercise?.baseline_weight
  if (marked) return { status: marked.load_guidance_status as 'not_calculated' | 'unverified', recommendationAvailable: false,
    reason: String(marked.load_guidance_reason || 'The saved load needs review before it can be used as a current recommendation.') }
  if (!positive(weight)) return { status: 'not_calculated' as const, recommendationAvailable: false,
    reason: 'A load recommendation has not been calculated for this exercise.' }
  if (source === 'recommended' && (exercise.prescription_calculation?.version !== 'founder-load-v3' || !verified)) return { status: 'unverified' as const,
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
  inputWeight?: { value: number | null; unit: 'lb' | 'kg' }
} {
  const weightEdited = retained?.weightEdited === true
  const guidance = exerciseLoadPresentation(exercise, context)
  // Keep the entered value in its original unit while showing a conversion.
  // Saving that display conversion must not round away the original input.
  const inputWeight = retained?.inputWeight
  const entered = inputWeight && ['lb', 'kg'].includes(inputWeight.unit) ? inputWeight.value : retained?.weight
  const editedWeight = numeric(entered) && entered >= 0 ? entered : NaN
  const editedUnit = inputWeight && ['lb', 'kg'].includes(inputWeight.unit) ? inputWeight.unit
    : retained?.weight_unit === 'kg' || retained?.weight_unit === 'lb' ? retained.weight_unit : unit
  const convertedEditedWeight = editedUnit === unit ? editedWeight : Math.round(editedWeight * (unit === 'kg' ? 1 / 2.2046226218 : 2.2046226218) * 10) / 10
  const weight = guidance.status === 'bodyweight' ? 0 : weightEdited
    ? convertedEditedWeight
    : actualWeightForInput(exercise, unit, context)
  const retainUnknown = !guidance.recommendationAvailable && !weightEdited && retained && Object.hasOwn(retained, 'weight')
  const retainedWeight = retained && Object.hasOwn(retained, 'retainedWeight') ? retained.retainedWeight
    : retainUnknown ? retained.weight : undefined
  return { weight, weightEdited, ...(retainedWeight !== undefined ? { retainedWeight } : {}),
    ...(weightEdited ? { inputWeight: { value: Number.isFinite(editedWeight) ? editedWeight : null, unit: editedUnit } } : {}) }
}
