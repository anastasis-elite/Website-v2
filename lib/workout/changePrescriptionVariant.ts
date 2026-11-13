import { roundSuggestedWeightLb, SUGGESTED_LOAD_ROUNDING } from '@/lib/workout/weightRounding'
import { calculateFounderLoadFromEstimated1RM, resolveFounderExerciseReference } from '@/lib/program/founderReference'
import { getEquipmentAdjustedLoad } from '@/lib/program/getEquipmentAdjustedLoad'
import { roundRecommendedWeight } from '@/lib/cycle/getCycleTrainingAdjustment'
import { hasNoCalculatedLoad, withoutCalculatedLoad } from '@/lib/workout/loadGuidance'

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const equalLoad = (first: number, second: number) => Math.abs(first - second) < 1e-8

/** Equipment identity can be changed without claiming load equivalence. */
function manualEquipmentContext(exercise: any) {
  if (exercise?.completed || exercise?.skipped || exercise?.confirmed_at || exercise?.set_logs?.length ||
    Number(exercise?.actual_reps || exercise?.actual_duration || 0) > 0) return null
  const resolved = resolveFounderExerciseReference(exercise?.exercise)
  if (resolved.status !== 'resolved' || resolved.group?.requires_variant_assessment !== true) return null
  const group = resolved.group
  const current = group.variants.filter((v: any) => exercise.selected_variant_id
    ? v.id === exercise.selected_variant_id : v.name === exercise.exercise)
  if (current.length !== 1 || exercise.selected_equipment && exercise.selected_equipment !== current[0].equipment ||
    exercise.load_type && exercise.load_type !== current[0].load_type) return null
  if (!Array.isArray(exercise.available_variants) || !exercise.available_variants.length ||
    new Set(exercise.available_variants.map((v: any) => v.id)).size !== exercise.available_variants.length ||
    exercise.available_variants.some((choice: any) => !group.variants.some((v: any) =>
      ['id', 'name', 'equipment', 'load_type', 'equipment_modifier'].every(field => choice[field] === v[field])))) return null
  return group
}

function switchContext(exercise: any) {
  const provenance = exercise?.prescription_calculation
  if (provenance?.version !== 'founder-load-v3' || hasNoCalculatedLoad(exercise) || exercise.prescription_status === 'unavailable' ||
    !positive(provenance.base_weight) || !positive(provenance.equipment_weight) ||
    !positive(exercise.cycle_weight_multiplier) || !positive(exercise.prescription_safety_multiplier) ||
    provenance.selected_variant_id !== exercise.selected_variant_id || exercise.completed === true ||
    Array.isArray(exercise.set_logs) && exercise.set_logs.length > 0) return null
  const resolved = resolveFounderExerciseReference(exercise.exercise)
  if (resolved.status !== 'resolved' || !resolved.group || resolved.group.requires_variant_assessment ||
    resolved.reference.exercise !== provenance.reference_exercise ||
    resolved.reference.assessment_key !== provenance.assessment_key ||
    resolved.reference.bodyweight_factor !== provenance.bodyweight_factor) return null
  const variants = resolved.group.variants.filter((item: any) => item.id === exercise.selected_variant_id)
  if (variants.length !== 1) return null
  const current = variants[0]
  if (!positive(current.equipment_modifier) || current.equipment_modifier !== provenance.equipment_modifier) return null
  const expected = calculateFounderLoadFromEstimated1RM({ estimated1RM: provenance.estimated_1rm,
    bodyweightFactor: provenance.bodyweight_factor, bodyMassLb: provenance.body_mass_lb,
    repMultiplier: provenance.rep_multiplier, group: resolved.group, variant: current, bodyweight: false })
  if (expected.baseCalculatedWeight !== provenance.base_weight || expected.adjustedWeight !== provenance.equipment_weight) return null
  const equipmentWeight = getEquipmentAdjustedLoad({ baseWeight: provenance.base_weight,
    fromEquipment: resolved.group.base_equipment, toEquipment: current.equipment,
    category: resolved.group.category, equipmentModifier: current.equipment_modifier })
  const cycleWeight = roundRecommendedWeight(equipmentWeight * exercise.cycle_weight_multiplier)
  if (!positive(cycleWeight)) return null
  const rawWeight = cycleWeight * exercise.prescription_safety_multiplier
  // Untouched legacy snapshots retain their exact historical validation.
  if (exercise.suggested_load_rounding && exercise.suggested_load_rounding !== SUGGESTED_LOAD_ROUNDING) return null
  const expectedWeight = exercise.suggested_load_rounding === SUGGESTED_LOAD_ROUNDING ? roundSuggestedWeightLb(exercise, rawWeight) : rawWeight
  if (!equalLoad(equipmentWeight, provenance.equipment_weight) || !positive(cycleWeight) ||
    !positive(exercise.recommended_weight) ||
    !equalLoad(exercise.recommended_weight, expectedWeight)) return null
  return { provenance, group: resolved.group }
}

/** Legacy session snapshots stay loggable, but cannot justify a new conversion. */
export function canChangePrescriptionVariant(exercise: any) {
  return manualEquipmentContext(exercise) !== null || switchContext(exercise) !== null
}

/** Rebuild a different equipment load from its recorded base, then carry the
 * existing cycle and daily safety adjustments through exactly once. */
export function changePrescriptionVariant(exercise: any, variantId: string): any | null {
  if (variantId === exercise?.selected_variant_id) return exercise
  const manualGroup = manualEquipmentContext(exercise)
  if (manualGroup) {
    const variant = manualGroup.variants.find((v: any) => v.id === variantId)
    if (!variant || !exercise.available_variants.some((v: any) => v.id === variantId)) return null
    const selected = withoutCalculatedLoad({ ...exercise, selected_variant_id: variant.id,
      selected_variant_name: variant.name, selected_equipment: variant.equipment, equipment: variant.equipment,
      load_type: variant.load_type, equipment_modifier: null, weight: null, weight_goal: null }, 'not_calculated',
      'No verified load is available for this equipment. Loads do not transfer between hip-thrust equipment; enter the actual weight you use.')
    return selected
  }
  const context = switchContext(exercise)
  if (!context || !Array.isArray(exercise.available_variants)) return null
  const choices = exercise.available_variants.filter((item: any) => item.id === variantId)
  const references = context.group.variants.filter((item: any) => item.id === variantId)
  if (choices.length !== 1 || references.length !== 1) return null
  const variant = references[0], choice = choices[0]
  if (!positive(variant.equipment_modifier) || ['name', 'equipment', 'load_type', 'equipment_modifier']
    .some(field => choice[field] !== variant[field])) return null
  const equipmentWeight = getEquipmentAdjustedLoad({ baseWeight: context.provenance.base_weight,
    fromEquipment: context.group.base_equipment, toEquipment: variant.equipment,
    category: context.group.category, equipmentModifier: variant.equipment_modifier })
  const cycleWeight = roundRecommendedWeight(equipmentWeight * exercise.cycle_weight_multiplier)
  if (!positive(equipmentWeight) || !positive(cycleWeight)) return null
  const finalWeight = roundSuggestedWeightLb({ selected_equipment: variant.equipment, load_type: variant.load_type }, cycleWeight * exercise.prescription_safety_multiplier)
  if (!positive(finalWeight)) return null
  return { ...exercise, suggested_load_rounding: SUGGESTED_LOAD_ROUNDING, selected_variant_id: variant.id, selected_variant_name: variant.name,
    selected_equipment: variant.equipment, equipment: variant.equipment, load_type: variant.load_type,
    equipment_modifier: variant.equipment_modifier, baseline_weight: equipmentWeight, calculated_weight: equipmentWeight,
    cycle_adjusted_weight: cycleWeight, recommended_weight: finalWeight,
    prescription_calculation: { ...context.provenance, selected_variant_id: variant.id,
      equipment_modifier: variant.equipment_modifier, equipment_weight: equipmentWeight } }
}
