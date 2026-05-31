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

function getDefaultVariant(group: any) {
  if (!group) return null

  return (
    group.variants?.find(
      (variant: any) => variant.id === group.default_variant
    ) || group.variants?.[0]
  )
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

  return {
    weight: Number(data?.[mapped.weight] || 0),
    reps: Number(data?.[mapped.reps] || 0),
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

export function generateProgram({
  client,
  initialAssessment,
  strengthAssessment,
}: any) {
  const template = getTemplate(client.program)
  const ifKey = getIfKey(client.program)

  const generatedDays = template.days.map((day: any) => {
    const exercises = day.exercises.map((exercise: any) => {
      const variantGroup = getVariantGroup(exercise.exercise)
      const defaultVariant = getDefaultVariant(variantGroup)

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
          selected_equipment: defaultVariant?.equipment || null,
          available_variants: variantGroup?.variants || [],
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
          selected_equipment: defaultVariant?.equipment || null,
          available_variants: variantGroup?.variants || [],
          calculated_weight: null,
          calculation_note: 'No assessment key match',
        }
      }

      const estimated1RM = estimate1RM(
        assessmentLift.weight,
        assessmentLift.reps
      )

      const intensityFactor = Number(keyRow[ifKey] || 0)
      const repMultiplier = getRepMultiplier(Number(exercise.reps))

      const baseCalculatedWeight = roundToNearest5(
        estimated1RM * intensityFactor * repMultiplier
      )

      const adjustedWeight = getEquipmentAdjustedLoad({
        baseWeight: baseCalculatedWeight,
        fromEquipment: variantGroup?.base_equipment || defaultVariant?.equipment,
        toEquipment: defaultVariant?.equipment,
        category: variantGroup?.category || 'compound',
        equipmentModifier: defaultVariant?.equipment_modifier,
      })

      return {
        ...exercise,
        display_name: variantGroup?.display_name || exercise.exercise,
        movement_pattern: variantGroup?.pattern || null,

        selected_variant_id: defaultVariant?.id || null,
        selected_variant_name: defaultVariant?.name || exercise.exercise,
        selected_equipment: defaultVariant?.equipment || null,
        load_type: defaultVariant?.load_type || 'total_load',
        available_variants: variantGroup?.variants || [],

        assessment_key: assessmentKey,
        estimated_1rm: Math.round(estimated1RM),
        intensity_factor: intensityFactor,
        rep_multiplier: repMultiplier,

        baseline_weight: baseCalculatedWeight,
        calculated_weight: adjustedWeight,
        recommended_weight: adjustedWeight,

        calculation_note: defaultVariant
          ? `Adjusted for ${defaultVariant.equipment} loading.`
          : 'Standard loading calculation.',
      }
    })

    return {
      ...day,
      exercises,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    program: client.program,
    days: generatedDays,
  }
}
