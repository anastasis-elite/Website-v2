import hypertrophyChart from '@/data/reference/hypertrophyChart_normalized.json'
import { calculateFounderLoadFromEstimated1RM, calculateLegacyFounderLoadFromEstimated1RM, getFounderIntensityKey, resolveFounderExerciseReference } from '@/lib/program/founderReference'
import { roundRecommendedWeight } from '@/lib/cycle/getCycleTrainingAdjustment'
import { roundSuggestedWeightLb, SUGGESTED_LOAD_ROUNDING } from '@/lib/workout/weightRounding'

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const integer = (value: unknown): value is number => positive(value) && Number.isSafeInteger(value) && value <= 100
const equal = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8
const levels: Record<string, number> = { level_0_full_plan: 1, level_1_slight_modify: .9, level_2_moderate_modify: .8, level_3_recovery_training: .6 }
const structural = (value: unknown): value is number => positive(value) && value >= .78 && value <= 1 && equal(value * 100, Math.round(value * 100))
const oldProjectionReason = 'The original saved load cannot be verified as current guidance.'

/** Only the old projection error may be recovered by a successful integrity
 * check. Explicit unsupported-equipment and missing-input states still win. */
export function canVerifySavedLoad(exercise: any) {
  return !exercise?.load_guidance_status || exercise.load_guidance_status === 'unverified' &&
    typeof exercise.load_guidance_reason === 'string' && exercise.load_guidance_reason.startsWith(oldProjectionReason)
}

/** The original rep multiplier belongs to the calculation's rep target, not
 * the later cycle/readiness target. No current assessment is consulted. */
export function hasVerifiedRawCalculation(exercise: any, program?: string) {
  const p = exercise?.prescription_calculation
  if (!p || !['founder-load-v2', 'founder-load-v3'].includes(p.version)) return false
  const resolved = resolveFounderExerciseReference(exercise.exercise)
  if (resolved.status !== 'resolved') return false
  const { reference, group } = resolved
  const variants = group?.variants?.filter((v: any) => v.id === exercise.selected_variant_id) || []
  const variant = variants.length === 1 ? variants[0] : null
  if (group && !variant || !group && (exercise.selected_variant_id || exercise.selected_equipment !== null || exercise.load_type !== 'total_load') ||
    group?.requires_variant_assessment && variant?.name !== reference.exercise ||
    variant && (exercise.selected_equipment !== variant.equipment || exercise.load_type !== variant.load_type) ||
    exercise.weight_unit !== undefined && exercise.weight_unit !== 'lb') return false
  if (p.reference_exercise !== reference.exercise || p.assessment_key !== reference.assessment_key || p.assessment_key !== exercise.assessment_key ||
    !positive(p.estimated_1rm) || !positive(p.rep_multiplier) || p.rep_multiplier !== exercise.rep_multiplier ||
    p.selected_variant_id !== (exercise.selected_variant_id || null) || p.equipment_modifier !== (variant?.equipment_modifier ?? 1)) return false
  const calculationReps = exercise.issued_prescription?.calculation_reps ?? exercise.baseline_reps ?? exercise.reps
  const rows = (hypertrophyChart as any[]).filter(row => row.reps === calculationReps)
  if (rows.length !== 1 || rows[0].multiplier !== p.rep_multiplier) return false
  const modern = p.version === 'founder-load-v3'
  const intensityKey = program ? getFounderIntensityKey(program) : p.intensity_key
  if (modern ? p.bodyweight_factor !== reference.bodyweight_factor
    : !intensityKey || p.intensity_key !== intensityKey || p.intensity_factor !== reference[intensityKey] || p.intensity_factor !== exercise.intensity_factor) return false
  const expected = modern ? calculateFounderLoadFromEstimated1RM({ estimated1RM: p.estimated_1rm,
    bodyweightFactor: p.bodyweight_factor, bodyMassLb: p.body_mass_lb, repMultiplier: p.rep_multiplier, group, variant, bodyweight: false })
    : calculateLegacyFounderLoadFromEstimated1RM({ estimated1RM: p.estimated_1rm, intensityFactor: p.intensity_factor,
      repMultiplier: p.rep_multiplier, group, variant, bodyweight: false })
  // Cycle processing historically reused baseline_weight for equipment weight.
  const baseline = exercise.cycle_weight_multiplier === undefined ? p.base_weight : p.equipment_weight
  return positive(p.base_weight) && positive(p.equipment_weight) && p.base_weight === expected.baseCalculatedWeight &&
    p.equipment_weight === expected.adjustedWeight && p.equipment_weight === exercise.calculated_weight &&
    baseline === exercise.baseline_weight
}

function cycleStage(exercise: any) {
  const rawWeight = exercise.prescription_calculation?.equipment_weight
  if (exercise.cycle_weight_multiplier === undefined) return exercise.cycle_adjusted_weight === undefined &&
    exercise.cycle_rep_adjustment === undefined ? { weight: rawWeight, reps: exercise.reps, calculationReps: exercise.reps } : null
  const multiplier = exercise.cycle_weight_multiplier, repAdjustment = exercise.cycle_rep_adjustment
  const known = [[1, 0], ...[1, .98, 1.02].flatMap(modifier => [[.85 * modifier, -2], [.9 * modifier, -1],
    [1.03 * modifier, 0], [1.02 * modifier, 0], [.95 * modifier, -1]])]
  if (!known.some(([weight, reps]) => equal(multiplier, weight) && repAdjustment === reps) || !integer(exercise.baseline_reps)) return null
  const weight = roundRecommendedWeight(rawWeight * multiplier), reps = Math.max(1, exercise.baseline_reps + repAdjustment)
  return positive(weight) && equal(exercise.cycle_adjusted_weight, weight) && exercise.cycle_adjusted_reps === reps
    ? { weight, reps, calculationReps: exercise.baseline_reps } : null
}

function dailyDose(stage: any, cycle: { reps: number }) {
  if (stage?.version !== 'daily-v1' || !integer(stage.input_sets) || stage.planned_reps !== Math.max(3, cycle.reps) ||
    ![-2, -1, 0, 1].includes(stage.fuel_rep_adjustment) || !integer(stage.rep_limit) || !integer(stage.set_limit) ||
    !structural(stage.structural_multiplier) || !Object.hasOwn(levels, stage.adjustment_level) ||
    ['accessory', 'keep_accessories', 'endurance_progression', 'load_progression'].some(key => typeof stage[key] !== 'boolean') ||
    !['well_fueled', 'slightly_under_fueled', 'under_fueled', 'depleted', 'unknown_needs_input', 'guidance_only'].includes(stage.fuel_status) ||
    !['needs_input', 'low', 'building', 'ready'].includes(stage.hydration_status) ||
    !['push_day', 'normal_training_day', 'modify_workout', 'active_recovery', 'full_recovery_or_red_flag'].includes(stage.recovery_status)) return null
  const fuelRepAdjustment = ['under_fueled', 'depleted'].includes(stage.fuel_status) ? Math.max(3, stage.planned_reps - 2) - stage.planned_reps
    : ['slightly_under_fueled', 'unknown_needs_input'].includes(stage.fuel_status) ? Math.max(3, stage.planned_reps - 1) - stage.planned_reps
    : stage.hydration_status === 'ready' && stage.fuel_status === 'well_fueled' && ['normal_training_day', 'push_day'].includes(stage.recovery_status) ? 1 : 0
  if (stage.fuel_rep_adjustment !== fuelRepAdjustment) return null
  const safety = levels[stage.adjustment_level] * (stage.adjustment_level === 'level_0_full_plan' && stage.load_progression ? 1.025 : 1)
  if (!equal(stage.safety_multiplier, safety * stage.structural_multiplier) || stage.load_progression && stage.adjustment_level !== 'level_0_full_plan' ||
    stage.endurance_progression && stage.adjustment_level !== 'level_0_full_plan') return null
  let sets = stage.input_sets
  if (stage.adjustment_level === 'level_2_moderate_modify') sets = Math.max(1, sets - 1)
  if (stage.adjustment_level === 'level_3_recovery_training') sets = Math.min(2, sets)
  sets = Math.min(sets, stage.accessory ? stage.keep_accessories ? Math.max(2, stage.set_limit - 1) : 2 : stage.set_limit)
  if (stage.endurance_progression) sets = Math.min(5, sets + 1)
  return { sets, reps: Math.max(3, Math.min(Math.max(3, stage.planned_reps + stage.fuel_rep_adjustment), stage.rep_limit)) }
}

/** Validate final adjustments separately from the raw founder calculation. A
 * snapshot is an exact issued result, never permission to trust any saved load. */
export function hasVerifiedFinalPrescription(exercise: any) {
  const cycle = cycleStage(exercise)
  if (!cycle || !positive(exercise.recommended_weight)) return false
  const multiplier = exercise.prescription_safety_multiplier
  if (multiplier !== undefined && (!positive(multiplier) || !Object.values(levels).concat(1.025).some(factor => structural(multiplier / factor)))) return false
  if (exercise.suggested_load_rounding !== undefined && exercise.suggested_load_rounding !== SUGGESTED_LOAD_ROUNDING) return false
  const rawFinalWeight = cycle.weight * (multiplier ?? 1)
  const expectedWeight = exercise.suggested_load_rounding === SUGGESTED_LOAD_ROUNDING ? roundSuggestedWeightLb(exercise, rawFinalWeight) : rawFinalWeight
  if (!equal(exercise.recommended_weight, expectedWeight)) return false
  const issued = exercise.issued_prescription
  if (issued === undefined) {
    // Earlier daily rep changes have no recorded readiness/capacity cause.
    // Recover only the unchanged, provable raw/cycle rep target.
    const finalReps = exercise.recommended_reps ?? exercise.reps
    return integer(finalReps) && integer(exercise.sets) && finalReps === cycle.reps
  }
  if (issued?.version !== 'issued-prescription-v1' || typeof exercise.session_key !== 'string' || issued.session_key !== exercise.session_key ||
    issued.exercise !== exercise.exercise || issued.selected_variant_id !== (exercise.selected_variant_id || null) ||
    issued.selected_equipment !== (exercise.selected_equipment || null) || issued.load_type !== exercise.load_type ||
    issued.weight_unit !== 'lb' || exercise.weight_unit !== 'lb' || issued.calculation_reps !== cycle.calculationReps ||
    issued.weight !== exercise.recommended_weight || issued.reps !== (exercise.recommended_reps ?? exercise.reps) ||
    issued.reps !== exercise.reps || issued.sets !== exercise.sets || !integer(issued.reps) || !integer(issued.sets)) return false
  const stages = issued.adjustments
  if (!stages || !stages.cycle || !stages.daily || stages.cycle.weight_multiplier !== exercise.cycle_weight_multiplier ||
    stages.cycle.rep_adjustment !== exercise.cycle_rep_adjustment || stages.cycle.weight !== cycle.weight || stages.cycle.reps !== cycle.reps ||
    stages.cycle.label !== exercise.cycle_adjustment_label || stages.cycle.note !== exercise.cycle_adjustment_note ||
    stages.cycle.caution_active !== exercise.cycle_caution_active) return false
  let dose = dailyDose(stages.daily, cycle)
  if (!dose || !equal(stages.daily.safety_multiplier, multiplier)) return false
  if (stages.low_capacity !== undefined) {
    if (stages.low_capacity?.version !== 'low-capacity-v1' || stages.low_capacity.input_sets !== dose.sets || stages.low_capacity.input_reps !== dose.reps) return false
    dose = { sets: Math.max(2, Math.min(dose.sets, 3)), reps: Math.max(5, Math.min(dose.reps, 10)) }
  }
  return dose.sets === issued.sets && dose.reps === issued.reps
}

export function hasVerifiedSavedPrescription(exercise: any, program?: string) {
  return canVerifySavedLoad(exercise) && hasVerifiedRawCalculation(exercise, program) && hasVerifiedFinalPrescription(exercise)
}

/** Called after the final daily rules, including reduced-workout rules. The
 * issued occurrence and its immutable suggested dose travel in session JSON. */
export function issueExercisePrescription(exercise: any, index: number, daily: any, lowCapacity?: any) {
  if (exercise?.prescription_calculation?.version !== 'founder-load-v3' || !canVerifySavedLoad(exercise)) return exercise
  const sessionKey = String(exercise.session_key || `${exercise.id || exercise.exercise || exercise.name}:${index}`)
  return { ...exercise, session_key: sessionKey, weight_unit: 'lb', issued_prescription: {
    version: 'issued-prescription-v1', session_key: sessionKey, exercise: exercise.exercise,
    selected_variant_id: exercise.selected_variant_id || null, selected_equipment: exercise.selected_equipment || null,
    load_type: exercise.load_type, weight_unit: 'lb', sets: exercise.sets,
    reps: exercise.recommended_reps ?? exercise.reps, weight: exercise.recommended_weight,
    calculation_reps: exercise.baseline_reps ?? exercise.reps,
    adjustments: { cycle: { weight_multiplier: exercise.cycle_weight_multiplier, rep_adjustment: exercise.cycle_rep_adjustment,
      weight: exercise.cycle_adjusted_weight, reps: exercise.cycle_adjusted_reps, label: exercise.cycle_adjustment_label,
      note: exercise.cycle_adjustment_note, caution_active: exercise.cycle_caution_active }, daily,
      ...(lowCapacity ? { low_capacity: lowCapacity } : {}) },
  } }
}
