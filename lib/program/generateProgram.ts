import 'server-only'

import masterKey from '@/data/reference/masterKey.json'
import hypertrophyChart from '@/data/reference/hypertrophyChart_normalized.json'
import exerciseVariants from '@/data/reference/exerciseVariants.json'

import emberGym from '@/data/template/emberGym.json'
import igniteGym from '@/data/template/igniteGym.json'
import phoenixBodybuilding from '@/data/template/phoenixBodybuilding.json'
import phoenixEndurance from '@/data/template/phoenixEndurance.json'
import phoenixFullTransformation from '@/data/template/phoenixFullTransformation.json'
import phoenixGluteSculpt from '@/data/template/phoenixGluteSculpt.json'
import phoenixHypertrophy from '@/data/template/phoenixHypertrophy.json'
import phoenixRecomposition from '@/data/template/phoenixRecomposition.json'
import phoenixStrength from '@/data/template/phoenixStrength.json'
import phoenixWaistCincher from '@/data/template/phoenixWaistCincher.json'

import { calculateFounderLoadFromEstimated1RM, founderBodyMassLb, experimentalLoadNote, resolveFounderExerciseReference } from '@/lib/program/founderReference'
import { getClientTimeZone } from '@/lib/timezone'
import { readSessionEquipmentContext } from '@/lib/workout/selectedPrescriptionTypes'
import { isReferenceSessionVariant } from '@/lib/workout/manualWorkout'
import { withoutCalculatedLoad } from '@/lib/workout/loadGuidance'

function getTemplate(program: string) {
  switch (program) {
    case 'ember':
      return emberGym
    case 'ignite':
      return igniteGym
    case 'phoenixBodybuilding':
      return phoenixBodybuilding
    case 'phoenixEndurance':
      return phoenixEndurance
    case 'phoenixFullTransformation':
      return phoenixFullTransformation
    case 'phoenixGluteSculpt':
      return phoenixGluteSculpt
    case 'phoenixHypertrophy':
      return phoenixHypertrophy
    case 'phoenixRecomposition':
      return phoenixRecomposition
    case 'phoenixStrength':
      return phoenixStrength
    case 'phoenixWaistCincher':
      return phoenixWaistCincher
    default:
      return emberGym
  }
}

function normalizeName(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeEquipment(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/dumbbells/g, 'dumbbell')
    .replace(/kettlebells/g, 'kettlebell')
    .replace(/resistance bands|bands/g, 'band')
    .replace(/cables/g, 'cable')
    .replace(/machines/g, 'machine')
    .replace(/\s+/g, ' ')
}

function getClientEquipment(client: any, initialAssessment: any) {
  const assessment = initialAssessment?.data || initialAssessment || {}
  const inventory = (recorded: unknown) => (Array.isArray(recorded) ? recorded : String(recorded ?? '').split(','))
    .map(normalizeEquipment).filter(Boolean).flatMap((item: string) => item === 'dumbbell band' ? ['dumbbell', 'band'] : [item]) as string[]
  const profileEquipment = inventory(client?.equipment_access)
  const assessmentEquipment = inventory(assessment.equipmentAccess)
  // Empty profile arrays are not an explicit equipment restriction. Preserve
  // any recorded restriction; only an absent/empty inventory uses the assessment.
  const normalized = profileEquipment.length ? profileEquipment : assessmentEquipment.length ? assessmentEquipment : inventory(assessment.equipment_access)
  if (normalized.some((item) => ['gym', 'full gym', 'commercial gym', 'all equipment'].includes(item))) return ['*']
  return normalized
}

function equipmentMatches(variant: any, equipment: string[]) {
  if (equipment.includes('*')) return true
  const variantEquipment = normalizeEquipment(variant?.equipment)
  return Boolean(variantEquipment) && equipment.some((item) => variantEquipment.includes(item) || item.includes(variantEquipment))
}

function getEquipmentCompatibleVariants(group: any, equipment: string[]) {
  if (!group?.variants?.length) return []
  const compatible = group.variants.filter((variant: any) => equipmentMatches(variant, equipment))
  if (compatible.length) return compatible
  const bodyweight = group.variants.filter((variant: any) => normalizeEquipment(variant.equipment) === 'bodyweight')
  if (bodyweight.length) return bodyweight
  return []
}

function getDefaultVariantForEquipment(group: any, equipment: string[]) {
  if (!group) return null
  const compatible = getEquipmentCompatibleVariants(group, equipment)
  const preferred = compatible.find((variant: any) => variant.id === group.default_variant)
  return preferred || compatible[0] || null
}

function getAssessmentLift(key: string, data: any) {
  const map: Record<string, { weight: string; reps: string }> = {
    Bench: {
      weight: 'bench_press_weight',
      reps: 'bench_press_reps',
    },
    Shoulder: {
      weight: 'shoulder_press_weight',
      reps: 'shoulder_press_reps',
    },
    Squat: {
      weight: 'squat_weight',
      reps: 'squat_reps',
    },
    RDL: {
      weight: 'romanian_deadlift_weight',
      reps: 'romanian_deadlift_reps',
    },
    Row: {
      weight: 'seated_row_weight',
      reps: 'seated_row_reps',
    },
    Bicep: {
      weight: 'bicep_curl_weight',
      reps: 'bicep_curl_reps',
    },
    LateralRaise: {
      weight: 'lateral_raise_weight',
      reps: 'lateral_raise_reps',
    },
    'Close-Grip': {
      weight: 'close_grip_press_weight',
      reps: 'close_grip_press_reps',
    },
  }

  const mapped = map[key]

  if (!mapped) return null

  const supplied = (value: unknown) => typeof value === 'number' || typeof value === 'string' && value.trim() !== ''
  return {
    weight: Number(data?.[mapped.weight] || 0),
    reps: Number(data?.[mapped.reps] || 0),
    recorded: supplied(data?.[mapped.weight]) && supplied(data?.[mapped.reps]),
  }
}

function estimate1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0
  return weight * (1 + reps / 30)
}

function getRepMultiplier(reps: number) {
  const found = (hypertrophyChart as any[]).filter(row => Number(row.reps) === reps)
  return found.length === 1 ? Number(found[0].multiplier) : NaN
}

function hasUsableAssessment(lift: ReturnType<typeof getAssessmentLift>, bodyweight: boolean) {
  return Boolean(lift && lift.recorded && Number.isFinite(lift.weight) && lift.weight <= 3000 &&
    (bodyweight ? lift.weight >= 0 : lift.weight > 0) && Number.isSafeInteger(lift.reps) && lift.reps > 0 && lift.reps <= 100)
}

function calculationProvenance({ keyRow, bodyMassLb, estimated1RM, repMultiplier, baseCalculatedWeight, adjustedWeight, variant }: any) {
  return {
    version: 'founder-load-v3', reference_exercise: keyRow.exercise, assessment_key: keyRow.assessment_key,
    estimated_1rm: estimated1RM, bodyweight_factor: keyRow.bodyweight_factor, body_mass_lb: bodyMassLb, rep_multiplier: repMultiplier,
    base_weight: baseCalculatedWeight, equipment_weight: adjustedWeight,
    selected_variant_id: variant?.id || null, equipment_modifier: variant?.equipment_modifier ?? 1,
  }
}

// One calculation path for saved programs and bounded manual selections.
function calculateFounderLoad({ lift, bodyweightFactor, bodyMassLb, repMultiplier, group, variant, bodyweight }: {
  lift: { weight: number; reps: number }; bodyweightFactor: unknown; bodyMassLb: unknown; repMultiplier: number
  group: any; variant: any; bodyweight: boolean
}) {
  const estimated1RM = estimate1RM(lift.weight, lift.reps)
  return calculateFounderLoadFromEstimated1RM({ estimated1RM, bodyweightFactor, bodyMassLb, repMultiplier, group, variant, bodyweight })
}

export function generateProgram({
  client,
  initialAssessment,
  strengthAssessment,
}: any) {
  const template = getTemplate(client.program)
  const bodyMassLb = founderBodyMassLb(client, strengthAssessment)
  const clientEquipment = getClientEquipment(client, initialAssessment)
  const restrictedEquipment = !clientEquipment.includes('*')
  const excludedExercises: Array<{ day: string; exercise: string; reason: string }> = []

  const generatedDays = template.days.map((day: any) => {
    const exercises = day.exercises.flatMap((exercise: any) => {
      const resolved = resolveFounderExerciseReference(exercise.exercise, masterKey, exerciseVariants)
      const variantGroup = resolved.status === 'resolved' ? resolved.group : null
      const defaultVariant = getDefaultVariantForEquipment(variantGroup, clientEquipment)
      const availableVariants = getEquipmentCompatibleVariants(variantGroup, clientEquipment)
      // Keep existing unloaded template movements, but never assign an unsupported gym variant.
      const unloaded = !variantGroup && /^(?:side plank|single-leg glute bridge|walking lunge|reverse lunge|sumo squat|bulgarian split squat)$/i.test(exercise.exercise)
      if (restrictedEquipment && !defaultVariant && !unloaded) {
        excludedExercises.push({ day: day.day_name, exercise: exercise.exercise, reason: 'No supported variant for recorded equipment.' })
        return []
      }

      const keyRow = resolved.status === 'resolved' ? resolved.reference : null
      const assessmentKey = keyRow?.assessment_key
      const assessmentLift = getAssessmentLift(assessmentKey, strengthAssessment?.data || strengthAssessment)
      const bodyweight = unloaded || defaultVariant?.load_type === 'bodyweight' || defaultVariant?.equipment === 'bodyweight'
      const exerciseMetadata = {
        ...exercise,
        display_name: variantGroup?.display_name || exercise.exercise,
        movement_pattern: variantGroup?.pattern || null,
        selected_variant_id: defaultVariant?.id || null,
        selected_variant_name: defaultVariant?.name || exercise.exercise,
        selected_equipment: defaultVariant?.equipment || (unloaded ? 'bodyweight' : null),
        load_type: bodyweight ? 'bodyweight' : defaultVariant?.load_type || 'total_load',
        available_variants: availableVariants,
      }
      // These established unloaded movements need no assessed external load.
      // In particular Side Plank must not depend on an unsupported Crunch input.
      if (bodyweight) return {
        ...exerciseMetadata, baseline_weight: 0, calculated_weight: 0, recommended_weight: 0,
        calculation_note: 'Bodyweight movement; zero added load.',
      }
      const bodyweightFactor = keyRow?.bodyweight_factor
      const repMultiplier = getRepMultiplier(Number(exercise.reps))
      const invalidReason = resolved.status === 'unavailable' ? resolved.reason
        : !assessmentLift ? 'This exercise has no established assessed load calculation.'
        : !hasUsableAssessment(assessmentLift, bodyweight) ? 'Saved strength input is missing or invalid.'
        : typeof bodyweightFactor !== 'number' || !Number.isFinite(bodyweightFactor) ? 'Exercise bodyweight factor is unavailable.'
        : !Number.isSafeInteger(exercise.sets) || exercise.sets <= 0 || !Number.isSafeInteger(exercise.reps) || exercise.reps <= 0 ||
          !Number.isFinite(repMultiplier) || repMultiplier <= 0 ? 'Exercise dose is unavailable.'
        : defaultVariant && (!Number.isFinite(defaultVariant.equipment_modifier) || defaultVariant.equipment_modifier <= 0) ? 'Equipment conversion is unavailable.'
        : null
      const calculation = invalidReason ? null : calculateFounderLoad({
        lift: assessmentLift!, bodyweightFactor, bodyMassLb, repMultiplier, group: variantGroup, variant: defaultVariant, bodyweight,
      })
      const unavailableReason = invalidReason || (!calculation || !Number.isFinite(calculation.adjustedWeight) || (!bodyweight && calculation.adjustedWeight <= 0)
        ? 'Calculated exercise load is unavailable.' : null)
      if (unavailableReason) return withoutCalculatedLoad(
        { ...exerciseMetadata, calculation_note: unavailableReason },
        resolved.status === 'resolved' && !assessmentLift || resolved.status === 'unavailable' && resolved.reason === 'No exact exercise reference.'
          ? 'not_calculated' : 'unverified',
        unavailableReason,
      )
      const { estimated1RM, baseCalculatedWeight, adjustedWeight } = calculation!

      return {
        ...exercise,
        display_name: variantGroup?.display_name || exercise.exercise,
        movement_pattern: variantGroup?.pattern || null,

        selected_variant_id: defaultVariant?.id || null,
        selected_variant_name: defaultVariant?.name || exercise.exercise,
        selected_equipment: defaultVariant?.equipment || (unloaded ? 'bodyweight' : null),
        load_type: bodyweight ? 'bodyweight' : defaultVariant?.load_type || 'total_load',
        available_variants: availableVariants,

        assessment_key: assessmentKey,
        estimated_1rm: Math.round(estimated1RM),
        rep_multiplier: repMultiplier,

        baseline_weight: baseCalculatedWeight,
        calculated_weight: adjustedWeight,
        recommended_weight: adjustedWeight,
        prescription_calculation: calculationProvenance({ keyRow, bodyMassLb, estimated1RM, repMultiplier,
          baseCalculatedWeight, adjustedWeight, variant: defaultVariant }),

        calculation_note: experimentalLoadNote,
      }
    })

    return {
      ...day,
      // Preserve source intent before equipment filtering can empty training.
      day_intent: day.day_intent === 'rest' ? 'rest' : 'training',
      exercises,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    program: client.program,
    template_program: template.program,
    template_version: template.version,
    days: generatedDays,
    equipment_review_required: restrictedEquipment && excludedExercises.length > 0,
    excluded_exercises: excludedExercises,
    equipment_note: restrictedEquipment && excludedExercises.length > 0 ? 'Some template movements need equipment you have not recorded. Your plan contains only supported movements; review your available equipment before adding others.' : null,
  }
}

export const PHOENIX_PRESCRIPTION_TRACKS = ['phoenixBodybuilding', 'phoenixEndurance', 'phoenixFullTransformation', 'phoenixGluteSculpt', 'phoenixHypertrophy', 'phoenixRecomposition', 'phoenixStrength', 'phoenixWaistCincher'] as const

export function isApprovedPhoenixPrescriptionTrack(value: unknown): value is typeof PHOENIX_PRESCRIPTION_TRACKS[number] {
  return typeof value === 'string' && (PHOENIX_PRESCRIPTION_TRACKS as readonly string[]).includes(value)
}

/** Resolve one existing catalog selection; never creates or saves a full plan. */
export function getFounderSelectedExercise({ client, initialAssessment, strengthAssessment, catalogExercise, variantId, phoenixTrack, equipmentContext, now = new Date() }: {
  client: any; initialAssessment: any; strengthAssessment: any; catalogExercise: any; variantId: string; phoenixTrack?: unknown; equipmentContext?: unknown; now?: Date
}): { exercise: any; template: any } | null {
  // Only the caller's server-resolved saved-output track can select Phoenix
  // coefficients. Client/profile fields are not an authoritative track source.
  if (client.program === 'phoenix' && !isApprovedPhoenixPrescriptionTrack(phoenixTrack)) return null
  const track = client.program === 'phoenix' ? phoenixTrack : client.program
  const approved = ['ember', 'ignite', ...PHOENIX_PRESCRIPTION_TRACKS]
  if (!approved.includes(track)) return null
  const template = getTemplate(track)
  const catalogName = catalogExercise.exercise
  const resolved = resolveFounderExerciseReference(catalogName, masterKey, exerciseVariants)
  if (resolved.status !== 'resolved') return null
  const { reference: key, group } = resolved
  const unloaded = !group && /^(?:side plank|single-leg glute bridge|walking lunge|reverse lunge|sumo squat|bulgarian split squat)$/i.test(catalogName)
  const matchingVariants = group?.variants?.filter((item: any) => item.id === variantId) || []
  if (matchingVariants.length > 1) return null
  const variant = matchingVariants[0] ||
    (unloaded ? catalogExercise.available_variants.find((item: any) => item.id === variantId && item.load_type === 'bodyweight' && item.equipment === 'bodyweight') : null)
  if (!variant || !Number.isFinite(variant.equipment_modifier) || variant.equipment_modifier <= 0) return null
  const sessionContext = equipmentContext === undefined ? null : readSessionEquipmentContext(equipmentContext, variantId)
  if (equipmentContext !== undefined && (!sessionContext || !isReferenceSessionVariant(catalogExercise, variantId, sessionContext.equipment))) return null
  const equipment = sessionContext ? [sessionContext.equipment] : getClientEquipment(client, initialAssessment)
  if (!unloaded && !getEquipmentCompatibleVariants(group, equipment).some((item: any) => item.id === variantId)) return null
  const all = template.days.flatMap((day: any) => (day.exercises || []).map((exercise: any) => ({ day, exercise })))
  const exact = all.filter(({ exercise }: any) => normalizeName(exercise.exercise) === normalizeName(catalogName))
  // A related movement pattern is not an established prescription for this
  // catalog exercise. Only the template's actual named exercise supplies dose.
  const matching = exact
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: getClientTimeZone(client) })
  const today = matching.filter(({ day }: any) => day.day_name === weekday)
  const choices = today.length ? today : matching
  const doses = new Set(choices.map(({ exercise }: any) => `${exercise.sets}:${exercise.reps}`))
  if (!choices.length || doses.size !== 1) return null
  const base = choices[0].exercise
  if (!Number.isSafeInteger(base.sets) || base.sets <= 0 || !Number.isSafeInteger(base.reps) || base.reps <= 0) return null
  const assessmentKey = key.assessment_key
  const lift = getAssessmentLift(assessmentKey, strengthAssessment?.data || strengthAssessment)
  const bodyMassLb = founderBodyMassLb(client, strengthAssessment)
  const bodyweightFactor = key.bodyweight_factor
  const repMultiplier = getRepMultiplier(base.reps)
  const bodyweight = variant.load_type === 'bodyweight' || variant.equipment === 'bodyweight'
  if (!hasUsableAssessment(lift, bodyweight) ||
    !Number.isFinite(repMultiplier) || repMultiplier <= 0) return null
  const { estimated1RM, baseCalculatedWeight, adjustedWeight } = calculateFounderLoad({ lift: lift!, bodyweightFactor, bodyMassLb, repMultiplier, group, variant, bodyweight })
  if (!Number.isFinite(adjustedWeight) || (!bodyweight && adjustedWeight <= 0)) return null
  return { template, exercise: {
    ...catalogExercise, ...base,
    id: catalogExercise.id, exercise: catalogName, name: variant.name, display_name: variant.name,
    selected_variant_id: variant.id, selected_variant_name: variant.name, selected_equipment: variant.equipment,
    equipment: variant.equipment, load_type: bodyweight ? 'bodyweight' : variant.load_type,
    // Keep this exact variant through the existing capacity/structural path.
    available_variants: [variant], assessment_key: assessmentKey, estimated_1rm: Math.round(estimated1RM),
    rep_multiplier: repMultiplier, baseline_weight: baseCalculatedWeight,
    calculated_weight: adjustedWeight, recommended_weight: adjustedWeight, calculation_note: experimentalLoadNote,
    prescription_calculation: calculationProvenance({ keyRow: key, bodyMassLb, estimated1RM, repMultiplier,
      baseCalculatedWeight, adjustedWeight, variant }),
  } }
}
