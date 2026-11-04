import { resolveFounderExerciseReference } from '@/lib/program/founderReference'
import { getEquipmentAdjustedLoad } from '@/lib/program/getEquipmentAdjustedLoad'
import { roundRecommendedWeight } from '@/lib/cycle/getCycleTrainingAdjustment'
import { hasNoCalculatedLoad } from '@/lib/workout/loadGuidance'

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const equalLoad = (first: number, second: number) => Math.abs(first - second) < 1e-8

function switchContext(exercise: any) {
  const provenance = exercise?.prescription_calculation
  if (provenance?.version !== 'founder-load-v2' || hasNoCalculatedLoad(exercise) || exercise.prescription_status === 'unavailable' ||
    !positive(provenance.base_weight) || !positive(provenance.equipment_weight) ||
    !positive(exercise.cycle_weight_multiplier) || !positive(exercise.prescription_safety_multiplier) ||
    provenance.selected_variant_id !== exercise.selected_variant_id || exercise.completed === true ||
    Array.isArray(exercise.set_logs) && exercise.set_logs.length > 0) return null
  const resolved = resolveFounderExerciseReference(exercise.exercise)
  if (resolved.status !== 'resolved' || !resolved.group ||
    resolved.reference.exercise !== provenance.reference_exercise ||
    resolved.reference.assessment_key !== provenance.assessment_key ||
    !positive(provenance.intensity_factor) || resolved.reference[provenance.intensity_key] !== provenance.intensity_factor) return null
  const variants = resolved.group.variants.filter((item: any) => item.id === exercise.selected_variant_id)
  if (variants.length !== 1) return null
  const current = variants[0]
  if (!positive(current.equipment_modifier) || current.equipment_modifier !== provenance.equipment_modifier) return null
  const equipmentWeight = getEquipmentAdjustedLoad({ baseWeight: provenance.base_weight,
    fromEquipment: resolved.group.base_equipment, toEquipment: current.equipment,
    category: resolved.group.category, equipmentModifier: current.equipment_modifier })
  const cycleWeight = roundRecommendedWeight(equipmentWeight * exercise.cycle_weight_multiplier)
  if (!equalLoad(equipmentWeight, provenance.equipment_weight) || !positive(cycleWeight) ||
    !positive(exercise.recommended_weight) ||
    !equalLoad(exercise.recommended_weight, cycleWeight * exercise.prescription_safety_multiplier)) return null
  return { provenance, group: resolved.group }
}

/** Legacy session snapshots stay loggable, but cannot justify a new conversion. */
export function canChangePrescriptionVariant(exercise: any) {
  return switchContext(exercise) !== null
}

/** Rebuild a different equipment load from its recorded base, then carry the
 * existing cycle and daily safety adjustments through exactly once. */
export function changePrescriptionVariant(exercise: any, variantId: string): any | null {
  if (variantId === exercise?.selected_variant_id) return exercise
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
  return { ...exercise, selected_variant_id: variant.id, selected_variant_name: variant.name,
    selected_equipment: variant.equipment, equipment: variant.equipment, load_type: variant.load_type,
    equipment_modifier: variant.equipment_modifier, baseline_weight: equipmentWeight, calculated_weight: equipmentWeight,
    cycle_adjusted_weight: cycleWeight, recommended_weight: cycleWeight * exercise.prescription_safety_multiplier,
    prescription_calculation: { ...context.provenance, selected_variant_id: variant.id,
      equipment_modifier: variant.equipment_modifier, equipment_weight: equipmentWeight } }
}
