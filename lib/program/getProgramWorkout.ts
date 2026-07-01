import {
  applyCycleTrainingAdjustment,
  getCycleTrainingAdjustment,
} from '@/lib/cycle/getCycleTrainingAdjustment'

export function getProgramWorkout({ client, output }: { client: any; output: any }) {
  const programJson = output?.program_json || output?.output || {}
  const days = Array.isArray(programJson.days) ? programJson.days : []
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todaysWorkout = days.find((day: any) => day.day_name === todayName)
  const cycleAdjustment = getCycleTrainingAdjustment(client)
  const adjustedExercises = todaysWorkout?.exercises?.length
    ? todaysWorkout.exercises.map((exercise: any) =>
        applyCycleTrainingAdjustment({ exercise, adjustment: cycleAdjustment })
      )
    : []

  return { programJson, todaysWorkout, cycleAdjustment, adjustedExercises }
}
