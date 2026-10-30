import { getClientTimeZone } from '@/lib/timezone'
import { resolveProgramDayIntent } from '@/lib/program/templateDayIntent'
import {
  applyCycleTrainingAdjustment,
  getCycleTrainingAdjustment,
} from '@/lib/cycle/getCycleTrainingAdjustment'

export function getProgramWorkout({ client, output }: { client: any; output: any }) {
  const programJson = output?.program_json || output?.output || {}
  const days = Array.isArray(programJson.days) ? programJson.days : []
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: getClientTimeZone(client) })
  const savedWorkout = days.find((day: any) => day.day_name === todayName)
  const dayIntent = resolveProgramDayIntent(savedWorkout, programJson, output?.program)
  const todaysWorkout = savedWorkout && dayIntent ? { ...savedWorkout, day_intent: dayIntent } : savedWorkout
  const cycleAdjustment = getCycleTrainingAdjustment(client)
  const adjustedExercises = todaysWorkout?.exercises?.length
    ? todaysWorkout.exercises.map((exercise: any) =>
        applyCycleTrainingAdjustment({ exercise, adjustment: cycleAdjustment })
      )
    : []

  return { programJson, todaysWorkout, cycleAdjustment, adjustedExercises }
}
