import masterKey from '@/data/reference/masterKey.json'
import hypertrophyChart from '@/data/reference/hypertrophyChart_normalized.json'

import emberGym from '@/data/template/emberGym.json'
import igniteGym from '@/data/template/igniteGym.json'

import phoenixStrength from '@/data/template/phoenixStrength.json'
import phoenixHypertrophy from '@/data/template/phoenixHypertrophy.json'

function getTemplate(program: string) {
  switch (program) {
    case 'ember':
      return emberGym

    case 'ignite':
      return igniteGym

    case 'phoenix-strength':
      return phoenixStrength

    case 'phoenix-hypertrophy':
      return phoenixHypertrophy

    default:
      return emberGym
  }
}

function estimate1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0

  return weight * (1 + reps / 30)
}

function getHypertrophyMultiplier(
  chart: any,
  goal: string
) {
  const found = chart.find(
    (row: any) => row.goal === goal
  )

  return found?.multiplier || 0.7
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

  const generatedDays = template.days.map((day: any) => {

    const exercises = day.exercises.map((exercise: any) => {

      const assessmentValue =
        strengthAssessment?.[exercise.assessment_key]

      const estimated1RMValue =
        estimate1RM(
          assessmentValue?.weight,
          assessmentValue?.reps
        )

      const multiplier =
        getHypertrophyMultiplier(
          hypertrophyChart,
          exercise.goal
        )

      const calculatedWeight =
        roundToNearest5(
          estimated1RMValue * multiplier
        )

      return {
        ...exercise,
        estimated_1rm: estimated1RMValue,
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
