import masterKey from '@/data/reference/masterKey.json'
import hypertrophyChart from '@/data/reference/hypertrophyChart_normalized.json'

import emberGym from '@/data/template/emberGym.json'
import igniteGym from '@/data/template/igniteGym.json'

function getTemplate(program: string) {
  switch (program) {
    case 'ember':
      return emberGym
    case 'ignite':
      return igniteGym
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
    default:
      return 'ember_if'
  }
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
  const found = (hypertrophyChart as any[]).find(
    (row) => Number(row.reps) === Number(reps)
  )

  return Number(found?.multiplier || 1)
}

function roundToNearest5(num: number) {
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
      const keyRow = (masterKey as any[]).find(
        (row) => row.exercise === exercise.exercise
      )

      if (!keyRow) {
        return {
          ...exercise,
          calculated_weight: null,
          calculation_note: 'No master key match',
        }
      }

      const assessmentLift = getAssessmentLift(
        keyRow.assessment_key,
        strengthAssessment
      )

      if (!assessmentLift) {
        return {
          ...exercise,
          calculated_weight: null,
          calculation_note: 'No assessment key match',
        }
      }

      const estimated1RM = estimate1RM(
        assessmentLift.weight,
        assessmentLift.reps
      )

      const intensityFactor = Number(keyRow[ifKey] || 0)
      const repMultiplier = getRepMultiplier(exercise.reps)

      const calculatedWeight = roundToNearest5(
        estimated1RM * intensityFactor * repMultiplier
      )

      return {
        ...exercise,
        assessment_key: keyRow.assessment_key,
        estimated_1rm: Math.round(estimated1RM),
        intensity_factor: intensityFactor,
        rep_multiplier: repMultiplier,
        calculated_weight: calculatedWeight,
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
