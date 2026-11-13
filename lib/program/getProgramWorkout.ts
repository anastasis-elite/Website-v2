import 'server-only'

import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { resolveProgramDayIntent } from '@/lib/program/templateDayIntent'
import { getWeekdayMusclePreferencesView } from '@/lib/program/weekdayMusclePreferences'
import { redistributeProgramWeek } from '@/lib/program/weekdayMuscleDistribution'
import { projectSavedExercisePrescription } from '@/lib/program/savedPrescription'
import {
  applyCycleTrainingAdjustment,
  getCycleTrainingAdjustment,
} from '@/lib/cycle/getCycleTrainingAdjustment'

/** Project this member's current week without changing the saved prescription. */
export function projectWeekdayProgram({ client, output, now = new Date() }: { client: any; output: any; now?: Date }) {
  const savedProgram = output?.program_json || output?.output || {}
  const preferences = getWeekdayMusclePreferencesView(client?.onboarding_data, getClientLocalDate(client, now), getClientTimeZone(client))
  const notices: string[] = []
  if (preferences.status === 'invalid') {
    return { programJson: savedProgram, weekdayPreferenceNotice: 'Your saved weekday preferences are unavailable. Your prescribed plan has been kept.' }
  }
  if (preferences.pending) {
    notices.push(preferences.pending.choice.mode === 'program_default'
      ? `Program-default weekdays are saved to begin on ${preferences.pending.effectiveDate}. Your current plan continues until then.`
      : `Your preferred weekday focus is saved to begin on ${preferences.pending.effectiveDate}. Your current plan continues until then.`)
  }
  let programJson = savedProgram
  if (preferences.current?.choice.mode === 'custom') {
    const projection = redistributeProgramWeek({ programJson: savedProgram, outputProgram: output?.program, days: preferences.current.choice.days })
    if (projection.status === 'supported') {
      programJson = { ...savedProgram, days: projection.days }
      notices.unshift(`Your preferred weekday focus is in effect from ${preferences.current.effectiveDate}. Prescribed workdays: ${projection.workDays.join(', ')}.${projection.unspecifiedWeekdays.length ? ` ${projection.unspecifiedWeekdays.join(', ')} is unspecified in the saved source, not confirmed rest.` : ''}`)
    } else {
      notices.unshift(`Your preferred weekday focus cannot be applied to this saved plan. ${projection.issues[0]?.message || 'The saved prescription cannot be redistributed safely.'} Your existing prescribed plan has been kept.`)
    }
  } else if (preferences.current?.choice.mode === 'program_default') {
    notices.unshift(`Program-default weekdays are in effect from ${preferences.current.effectiveDate}.`)
  }
  return { programJson, weekdayPreferenceNotice: notices.length ? notices.join(' ') : null }
}

export function getProgramWorkout({ client, output, now = new Date(), strengthAssessment }: { client: any; output: any; now?: Date; strengthAssessment?: any }) {
  const { programJson, weekdayPreferenceNotice } = projectWeekdayProgram({ client, output, now })
  const days = Array.isArray(programJson.days) ? programJson.days : []
  const todayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: getClientTimeZone(client) })
  const savedWorkout = days.find((day: any) => day.day_name === todayName)
  const dayIntent = resolveProgramDayIntent(savedWorkout, programJson, output?.program)
  const calculationProgram = client?.program === 'phoenix' ? programJson.phoenix_track : client?.program || output?.program
  const projectedExercises = Array.isArray(savedWorkout?.exercises)
    ? savedWorkout.exercises.map((exercise: any) => projectSavedExercisePrescription(exercise, calculationProgram, client, strengthAssessment)) : []
  const todaysWorkout = savedWorkout && dayIntent ? { ...savedWorkout, day_intent: dayIntent } : savedWorkout
  const cycleAdjustment = getCycleTrainingAdjustment(client)
  const adjustedExercises = projectedExercises.length
    ? projectedExercises.map((exercise: any) =>
        applyCycleTrainingAdjustment({ exercise, adjustment: cycleAdjustment })
      )
    : []

  return { programJson, todaysWorkout, cycleAdjustment, adjustedExercises, weekdayPreferenceNotice }
}

/** Read-only, request-scoped refresh. Identity comes from the authenticated
 * dashboard context; assessment reads are constrained to that same member. */
export async function getCurrentProgramWorkout({ supabase, user, client, output, now = new Date() }: {
  supabase: any; user: { id: string }; client: any; output: any; now?: Date
}) {
  let strengthAssessment: any = null
  if (user?.id && client?.client_id && client.auth_user_id === user.id) {
    try {
      const result = await supabase.from('assessments').select('data,client_id,assessment_type,submitted_at')
        .eq('client_id', client.client_id).eq('assessment_type', 'strength')
        .order('submitted_at', { ascending: false }).limit(1).maybeSingle()
      if (!result.error && result.data?.client_id === client.client_id && result.data.assessment_type === 'strength') strengthAssessment = result.data
    } catch { /* Missing/unconfirmed inputs remain unavailable, never guessed. */ }
  }
  return getProgramWorkout({ client, output, now, strengthAssessment })
}
