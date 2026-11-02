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

import { getEquipmentAdjustedLoad } from '@/lib/program/getEquipmentAdjustedLoad'
import { getClientTimeZone } from '@/lib/timezone'
import { readSessionEquipmentContext } from '@/lib/workout/selectedPrescriptionTypes'
import { isReferenceSessionVariant } from '@/lib/workout/manualWorkout'

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

function getIfKey(program: string) {
  switch (program) {
    case 'ember':
      return 'ember_if'
    case 'ignite':
      return 'ignite_if'
    case 'phoenixHypertrophy':
      return 'phoenix_hypertrophy_if'
    case 'phoenixStrength':
      return 'phoenix_strength_if'
    case 'phoenixBodybuilding':
      return 'phoenix_bodybuilding_if'
    case 'phoenixEndurance':
      return 'phoenix_endurance_if'
    case 'phoenixRecomposition':
      return 'phoenix_recomposition_if'
    case 'phoenixWaistCincher':
      return 'phoenix_waist_cincher_if'
    case 'phoenixGluteSculpt':
      return 'phoenix_glute_sculpt_if'
    default:
      return 'ember_if'
  }
}

function normalizeName(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function getVariantGroup(exerciseName: string) {
  const normalized = normalizeName(exerciseName)

  return (exerciseVariants as any[]).find((group) => {
    const aliases = group.aliases || []

    return aliases.some(
      (alias: string) => normalizeName(alias) === normalized
    )
  })
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
  const numericReps = Number(reps)

  if (!numericReps || Number.isNaN(numericReps)) {
    return 1
  }

  const found = (hypertrophyChart as any[]).find(
    (row) => Number(row.reps) === numericReps
  )

  return Number(found?.multiplier || 1)
}

function roundToNearest5(num: number) {
  if (!num || Number.isNaN(num)) return 0

  if (num < 20) {
    return Math.round(num)
  }

  return Math.round(num / 5) * 5
}

// One calculation path for saved programs and bounded manual selections.
function calculateFounderLoad({ lift, intensityFactor, repMultiplier, group, variant, bodyweight }: {
  lift: { weight: number; reps: number }; intensityFactor: number; repMultiplier: number
  group: any; variant: any; bodyweight: boolean
}) {
  const estimated1RM = estimate1RM(lift.weight, lift.reps)
  const baseCalculatedWeight = roundToNearest5(estimated1RM * intensityFactor * repMultiplier)
  const adjustedWeight = bodyweight ? 0 : getEquipmentAdjustedLoad({
    baseWeight: baseCalculatedWeight,
    fromEquipment: group?.base_equipment || variant?.equipment,
    toEquipment: variant?.equipment,
    category: group?.category || 'compound',
    equipmentModifier: variant?.equipment_modifier,
  })
  return { estimated1RM, baseCalculatedWeight, adjustedWeight }
}

export function generateProgram({
  client,
  initialAssessment,
  strengthAssessment,
}: any) {
  const template = getTemplate(client.program)
  const ifKey = getIfKey(client.program)
  const clientEquipment = getClientEquipment(client, initialAssessment)
  const restrictedEquipment = !clientEquipment.includes('*')
  const excludedExercises: Array<{ day: string; exercise: string; reason: string }> = []

  const generatedDays = template.days.map((day: any) => {
    const exercises = day.exercises.flatMap((exercise: any) => {
      const variantGroup = getVariantGroup(exercise.exercise)
      const defaultVariant = getDefaultVariantForEquipment(variantGroup, clientEquipment)
      const availableVariants = getEquipmentCompatibleVariants(variantGroup, clientEquipment)
      // Keep existing unloaded template movements, but never assign an unsupported gym variant.
      const unloaded = !variantGroup && /^(?:side plank|single-leg glute bridge|walking lunge|reverse lunge|sumo squat|bulgarian split squat)$/i.test(exercise.exercise)
      if (restrictedEquipment && !defaultVariant && !unloaded) {
        excludedExercises.push({ day: day.day_name, exercise: exercise.exercise, reason: 'No supported variant for recorded equipment.' })
        return []
      }

      const keyRow = (masterKey as any[]).find((row) => {
        if (variantGroup?.assessment_key) {
          return row.assessment_key === variantGroup.assessment_key
        }

        return row.exercise === exercise.exercise
      })

      if (!keyRow) {
        return {
          ...exercise,
          display_name: variantGroup?.display_name || exercise.exercise,
          movement_pattern: variantGroup?.pattern || null,
          selected_variant_id: defaultVariant?.id || null,
          selected_variant_name: defaultVariant?.name || exercise.exercise,
          selected_equipment: defaultVariant?.equipment || null,
          load_type: unloaded ? 'bodyweight' : defaultVariant?.load_type || 'total_load',
          available_variants: availableVariants,
          calculated_weight: null,
          calculation_note: 'No master key match',
        }
      }

      const assessmentKey =
        variantGroup?.assessment_key || keyRow.assessment_key

      const assessmentLift = getAssessmentLift(
        assessmentKey,
        strengthAssessment
      )

      if (!assessmentLift) {
        return {
          ...exercise,
          display_name: variantGroup?.display_name || exercise.exercise,
          movement_pattern: variantGroup?.pattern || null,
          selected_variant_id: defaultVariant?.id || null,
          selected_variant_name: defaultVariant?.name || exercise.exercise,
          selected_equipment: defaultVariant?.equipment || null,
          load_type: unloaded ? 'bodyweight' : defaultVariant?.load_type || 'total_load',
          available_variants: availableVariants,
          calculated_weight: null,
          calculation_note: 'No assessment key match',
        }
      }

      const intensityFactor = Number(keyRow[ifKey] || 0)
      const repMultiplier = getRepMultiplier(Number(exercise.reps))
      const bodyweight = unloaded || defaultVariant?.load_type === 'bodyweight' || defaultVariant?.equipment === 'bodyweight'
      const { estimated1RM, baseCalculatedWeight, adjustedWeight } = calculateFounderLoad({
        lift: assessmentLift, intensityFactor, repMultiplier, group: variantGroup, variant: defaultVariant, bodyweight,
      })

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
        intensity_factor: intensityFactor,
        rep_multiplier: repMultiplier,

        baseline_weight: baseCalculatedWeight,
        calculated_weight: adjustedWeight,
        recommended_weight: adjustedWeight,

        calculation_note: bodyweight ? 'Bodyweight movement; zero added load.' : defaultVariant
          ? `Adjusted for ${defaultVariant.equipment} loading.`
          : 'Standard loading calculation.',
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
  const calculationGroup = getVariantGroup(catalogName)
  // The manual catalog also recognizes exact display/variant names. Resolve
  // only that existing identity metadata, without creating movement aliases.
  const group = calculationGroup || (exerciseVariants as any[]).find(item =>
    [item.display_name, ...(item.aliases || []), ...(item.variants || []).map((entry: any) => entry.name)]
      .some(name => normalizeName(name) === normalizeName(catalogName)))
  const unloaded = !group && /^(?:side plank|single-leg glute bridge|walking lunge|reverse lunge|sumo squat|bulgarian split squat)$/i.test(catalogName)
  const variant = group?.variants?.find((item: any) => item.id === variantId) ||
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
  const key = (masterKey as any[]).find(row => calculationGroup?.assessment_key ? row.assessment_key === calculationGroup.assessment_key : row.exercise === catalogName)
  const assessmentKey = calculationGroup?.assessment_key || key?.assessment_key
  const lift = getAssessmentLift(assessmentKey, strengthAssessment?.data || strengthAssessment)
  const intensity = Number(key?.[getIfKey(track)])
  const repRow = (hypertrophyChart as any[]).find(row => Number(row.reps) === base.reps)
  const repMultiplier = Number(repRow?.multiplier)
  const bodyweight = variant.load_type === 'bodyweight' || variant.equipment === 'bodyweight'
  if (!key || !lift || !lift.recorded || !Number.isFinite(lift.weight) || lift.weight > 3000 || (bodyweight ? lift.weight < 0 : lift.weight <= 0) ||
    !Number.isSafeInteger(lift.reps) || lift.reps <= 0 || lift.reps > 100 || !Number.isFinite(intensity) || intensity <= 0 ||
    !Number.isFinite(repMultiplier) || repMultiplier <= 0) return null
  const { estimated1RM, baseCalculatedWeight, adjustedWeight } = calculateFounderLoad({ lift, intensityFactor: intensity, repMultiplier, group, variant, bodyweight })
  if (!Number.isFinite(adjustedWeight) || (!bodyweight && adjustedWeight <= 0)) return null
  return { template, exercise: {
    ...catalogExercise, ...base,
    id: catalogExercise.id, exercise: catalogName, name: variant.name, display_name: variant.name,
    selected_variant_id: variant.id, selected_variant_name: variant.name, selected_equipment: variant.equipment,
    equipment: variant.equipment, load_type: bodyweight ? 'bodyweight' : variant.load_type,
    // Keep this exact variant through the existing capacity/structural path.
    available_variants: [variant], assessment_key: assessmentKey, estimated_1rm: Math.round(estimated1RM),
    intensity_factor: intensity, rep_multiplier: repMultiplier, baseline_weight: baseCalculatedWeight,
    calculated_weight: adjustedWeight, recommended_weight: adjustedWeight,
  } }
}
