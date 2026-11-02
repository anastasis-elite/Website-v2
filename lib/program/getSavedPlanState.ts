import { resolveProgramDayIntent } from '@/lib/program/templateDayIntent'
import { hasUsableTrainingExercises } from '@/lib/workout/getWorkoutForToday'

export type SavedPlanState = { status: 'missing' | 'incomplete' | 'ready'; incompleteDays: string[] }

/** Inspect saved availability only; never regenerate or reinterpret exclusions as rest. */
export function getSavedPlanState(output: any): SavedPlanState {
  if (!output) return { status: 'missing', incompleteDays: [] }
  const program = output.program_json || output.output || {}
  const days = Array.isArray(program.days) ? program.days : []
  if (!days.length) return { status: 'incomplete', incompleteDays: [] }
  const incompleteDays = days.filter((day: any) => {
    const rest = resolveProgramDayIntent(day, program, output.program) === 'rest'
    return rest ? !Array.isArray(day?.exercises) || day.exercises.length !== 0 : !hasUsableTrainingExercises(day?.exercises)
  }).map((day: any) => String(day?.day_name || 'Unnamed training day'))
  const hasTraining = days.some((day: any) => resolveProgramDayIntent(day, program, output.program) !== 'rest' && hasUsableTrainingExercises(day?.exercises))
  return { status: incompleteDays.length || !hasTraining ? 'incomplete' : 'ready', incompleteDays }
}
