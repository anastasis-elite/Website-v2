import { calculateFounderLoadFromEstimated1RM, resolveFounderExerciseReference, getFounderIntensityKey } from '@/lib/program/founderReference'
import hypertrophyChart from '@/data/reference/hypertrophyChart_normalized.json'
import { activityDose, isBodyweightExercise } from '@/lib/workout/activity'
import { matchingWorkoutPlan, workoutSessionKeys } from '@/lib/workout/session'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { workoutLocalDate } from '@/lib/workout/history'

const unverifiedReason = 'The original saved load cannot be verified as current guidance. Keep the saved prescription for review and record the weight actually used. Your planned sets, reps and recorded work are retained.'
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function withoutObsoleteOutage(exercise: any) {
  if (exercise?.prescription_status !== 'unavailable' && !Object.hasOwn(exercise, 'prescription_unavailable_reason')) return exercise
  const retained = { ...exercise }
  delete retained.prescription_status
  delete retained.prescription_unavailable_reason
  return retained
}

const loadFields = ['baseline_weight', 'calculated_weight', 'recommended_weight', 'cycle_adjusted_weight', 'weight', 'weight_goal']
function hasStoredLoad(exercise: any) {
  return loadFields.some(field => typeof exercise[field] === 'number' && Number.isFinite(exercise[field]) ||
    typeof exercise[field] === 'string' && exercise[field].trim() !== '' && Number.isFinite(Number(exercise[field])))
}

/** Read-only load-guidance projection. Keep every stored load and dose intact:
 * rounded legacy 1RM values cannot safely recreate a trusted recommendation. */
export function projectSavedExercisePrescription(exercise: any, program: string) {
  if (!exercise || typeof exercise !== 'object') return exercise
  const retained = withoutObsoleteOutage(exercise)
  if (activityDose(exercise).kind !== 'strength' || isBodyweightExercise(exercise)) return retained
  if (exercise.load_guidance_status === 'not_calculated' || exercise.load_guidance_status === 'unverified') return retained
  if (!hasStoredLoad(exercise) && !exercise.prescription_calculation) {
    const source = resolveFounderExerciseReference(exercise.exercise)
    const mappedAssessment = source.status === 'resolved' && ['Bench', 'Shoulder', 'Squat', 'RDL', 'Row', 'Bicep', 'LateralRaise', 'Close-Grip'].includes(source.reference.assessment_key)
    return { ...retained, load_guidance_status: mappedAssessment ? 'unverified' : 'not_calculated',
      load_guidance_reason: mappedAssessment ? unverifiedReason : 'No calculated load is established for this saved movement. The original sets and reps remain available to log.' }
  }
  const provenance = exercise.prescription_calculation
  const resolved = resolveFounderExerciseReference(exercise.exercise)
  const group = resolved.status === 'resolved' ? resolved.group : null
  const variant = group?.variants?.find((item: any) => item.id === exercise.selected_variant_id)
  const reference = resolved.status === 'resolved' ? resolved.reference : null
  const intensityKey = ['ember', 'ignite', 'phoenixBodybuilding', 'phoenixEndurance', 'phoenixFullTransformation', 'phoenixGluteSculpt',
    'phoenixHypertrophy', 'phoenixRecomposition', 'phoenixStrength', 'phoenixWaistCincher'].includes(program)
    ? getFounderIntensityKey(program) : null
  const repRows = (hypertrophyChart as any[]).filter(row => Number(row.reps) === Number(exercise.reps))
  const expected = provenance && finite(provenance.estimated_1rm) && provenance.estimated_1rm > 0 &&
    finite(provenance.intensity_factor) && provenance.intensity_factor > 0 &&
    finite(provenance.rep_multiplier) && provenance.rep_multiplier > 0
    ? calculateFounderLoadFromEstimated1RM({ estimated1RM: provenance.estimated_1rm, intensityFactor: provenance.intensity_factor,
      repMultiplier: provenance.rep_multiplier, group, variant, bodyweight: false }) : null
  const supported = provenance?.version === 'founder-load-v2' && reference && intensityKey &&
    provenance.reference_exercise === reference.exercise && provenance.assessment_key === reference.assessment_key &&
    provenance.intensity_key === intensityKey && provenance.intensity_factor === reference[intensityKey] &&
    provenance.assessment_key === exercise.assessment_key && provenance.intensity_factor === exercise.intensity_factor &&
    finite(provenance.estimated_1rm) && provenance.estimated_1rm > 0 &&
    finite(provenance.rep_multiplier) && provenance.rep_multiplier > 0 && provenance.rep_multiplier === exercise.rep_multiplier &&
    repRows.length === 1 && provenance.rep_multiplier === Number(repRows[0].multiplier) &&
    finite(provenance.base_weight) && provenance.base_weight > 0 && provenance.base_weight === exercise.baseline_weight &&
    finite(provenance.equipment_weight) && provenance.equipment_weight > 0 && provenance.equipment_weight === exercise.calculated_weight &&
    provenance.equipment_weight === exercise.recommended_weight &&
    provenance.base_weight === expected?.baseCalculatedWeight && provenance.equipment_weight === expected?.adjustedWeight &&
    provenance.selected_variant_id === (exercise.selected_variant_id || null) &&
    (variant ? provenance.equipment_modifier === variant.equipment_modifier && exercise.selected_equipment === variant.equipment && exercise.load_type === variant.load_type
      : !group && provenance.selected_variant_id === null && provenance.equipment_modifier === 1)
  if (supported) return retained
  return { ...retained, load_guidance_status: 'unverified', load_guidance_reason: unverifiedReason }
}

export function hasUnconfirmedPrescription(exercises: unknown): boolean {
  return Array.isArray(exercises) && exercises.some(exercise => exercise?.load_guidance_status === 'unverified')
}

/** Resume only an existing, coherent current-day snapshot owned by this member.
 * No loads, recorded sets, original set denominator or occurrence keys change. */
export function selectPreservedWorkoutSession({ sessions, client, now = new Date() }: { sessions: any[]; client: any; now?: Date }) {
  if (!client?.client_id || !client.auth_user_id || !client.program) return null
  const today = getClientLocalDate(client, now), timeZone = getClientTimeZone(client)
  const candidates = sessions.filter(session => session && session.client_id === client.client_id &&
    session.auth_user_id === client.auth_user_id && session.program === client.program &&
    (session.workout_source || 'recommended') === 'recommended' && workoutLocalDate(session, timeZone) === today &&
    typeof session.day_name === 'string' && session.day_name.trim() &&
    Array.isArray(session.planned_exercises) && session.planned_exercises.length > 0 &&
    matchingWorkoutPlan(session.exercise_logs, workoutSessionKeys(session.planned_exercises)) &&
    (session.completed === true || session.exercise_logs.some((log: any) => log.completed || log.skipped || log.set_logs?.length ||
      log.confirmed_at || Number(log.actual_reps || log.actual_duration || log.actual_breaths) > 0)))
  // Distinct saved same-day plans have no established priority. Keep them in
  // history instead of choosing one and assigning its prescription to another.
  const identities = new Set(candidates.map(session => `${session.day_name}:${JSON.stringify(workoutSessionKeys(session.planned_exercises))}`))
  if (identities.size !== 1) return null
  return candidates[0] || null
}
