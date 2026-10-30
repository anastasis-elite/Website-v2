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

export type ProgramDayIntent = 'training' | 'rest'

const templates: Record<string, { version: string; days: Array<{ day_name: string; day_intent: string }> }> = {
  ember: emberGym,
  ignite: igniteGym,
  phoenixBodybuilding,
  phoenixEndurance,
  phoenixFullTransformation,
  phoenixGluteSculpt,
  phoenixHypertrophy,
  phoenixRecomposition,
  phoenixStrength,
  phoenixWaistCincher,
}

// Resolve old generated plans in memory only. An empty saved day is rest only
// when its known source explicitly marks that same weekday as rest. Missing
// days, unknown templates, and equipment exclusions never establish rest intent.
export function resolveProgramDayIntent(day: any, programJson: any, outputProgram: unknown): ProgramDayIntent | null {
  if (!day) return null
  if (day.day_intent === 'rest' || day.day_intent === 'training') return day.day_intent
  if (day.day_intent !== undefined || !Array.isArray(day.exercises) || day.exercises.length !== 0) return null

  const sourceKey = programJson.template_program ?? programJson.program ?? outputProgram
  const template = typeof sourceKey === 'string' && Object.prototype.hasOwnProperty.call(templates, sourceKey) ? templates[sourceKey] : undefined
  if (!template || (programJson.template_version && programJson.template_version !== template.version)) return null
  if (Array.isArray(programJson.excluded_exercises) && programJson.excluded_exercises.some((exercise: any) => exercise?.day === day.day_name)) return 'training'
  const sourceDay = template.days.find(source => source.day_name === day.day_name)
  return sourceDay?.day_intent === 'rest' ? 'rest' : null
}
