import 'server-only'
import { membershipCan } from '@/lib/membership/policy'
import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { inspectProgramWeekSource, redistributeProgramWeek } from './weekdayMuscleDistribution'
import {
  getWeekdayMusclePreferencesView, isPreferenceDate, mergeWeekdayMusclePreferences,
  parseWeekdayMuscleChoice, readWeekdayMusclePreferences, sameWeekdayMuscleChoice,
  validPreferenceOperationId, WeekdayMusclePreferenceConflict, type WeekdayMusclePreferencesView,
} from './weekdayMusclePreferences'
import { MUSCLE_GROUP_OPTIONS, WEEKDAYS, type WeekdayMuscleChoice, type WeekdayFocusPlanView, type WeekdayFocusPlans } from './weekdayMuscleTypes'

type Failure = { ok: false; status: number; code: string; error: string; issues?: string[] }
export type WeekdayPreferenceSourceStatus = {
  status: 'available' | 'unavailable' | 'unsupported'; message?: string; issues?: string[]
  trainingDayCount?: number; exerciseCount?: number; availableGroups?: string[]
  retainedEntries?: Array<{ day: string; exercise: string; reason: string; requiresOwnerDecision: boolean }>
  mappingProvenance?: string
  workDays?: Array<typeof WEEKDAYS[number]>
  unspecifiedWeekdays?: Array<typeof WEEKDAYS[number]>
}
export type WeekdayMusclePreferenceContext = {
  ok: true; user: { id: string }; client: any; effectiveClient: any; sourceOutput: any | null
  view: WeekdayMusclePreferencesView; sourceStatus: WeekdayPreferenceSourceStatus
  focusPlans: WeekdayFocusPlans
}
export type SaveWeekdayMusclePreferenceInput = {
  expectedClientId: string; expectedUserId: string; expectedDate: string; expectedRevision: number
  operationId: string; choice: WeekdayMuscleChoice
}
const failure = (status: number, code: string, error: string): Failure => ({ ok: false, status, code, error })

/** The preview uses the same server projection as the workout reader. It never
 * generates, persists, or counts a missing source day as rest. */
export function describeWeekdayFocusPlans({ sourceOutput, sourceStatus, program, view }: {
  sourceOutput: any; sourceStatus: WeekdayPreferenceSourceStatus; program: string; view: WeekdayMusclePreferencesView
}): WeekdayFocusPlans {
  const describe = (choice: WeekdayMuscleChoice, effectiveDate?: string): WeekdayFocusPlanView => {
    const base = { mode: choice.mode, ...(effectiveDate ? { effectiveDate } : {}) }
    if (sourceStatus.status !== 'available') return { ...base, status: sourceStatus.status,
      message: sourceStatus.message || 'The prescribed workday summary could not be confirmed.', issues: sourceStatus.issues }
    const projection = choice.mode === 'custom' ? redistributeProgramWeek({ programJson: sourceOutput?.program_json, outputProgram: program, days: choice.days }) : null
    if (projection?.status === 'unsupported') return { ...base, status: 'unsupported',
      message: 'This preferred focus cannot be applied while keeping the prescribed work and sequence.', issues: projection.issues.map(issue => issue.message) }
    const workDays = projection?.status === 'supported' ? projection.workDays : sourceStatus.workDays
    const unspecifiedDays = projection?.status === 'supported' ? projection.unspecifiedWeekdays : sourceStatus.unspecifiedWeekdays
    if (!workDays || !unspecifiedDays) return { ...base, status: 'unavailable', message: 'The complete prescribed workday summary could not be confirmed.' }
    const preferredDays = choice.mode === 'custom' ? WEEKDAYS.filter(day => choice.days[day].length > 0).map(day => ({ day,
      groups: choice.days[day].map(group => MUSCLE_GROUP_OPTIONS.find(option => option.id === group)!.label) })) : []
    const preferred = new Set(preferredDays.map(entry => entry.day))
    const days = projection?.status === 'supported' ? projection.days : sourceOutput?.program_json?.days
    const fixedExtraDays = preferredDays.length ? workDays.filter(day => !preferred.has(day)).map(day => ({ day,
      exercises: (days?.find((entry: any) => entry.day_name === day)?.exercises || []).map((exercise: any) => String(exercise.exercise)) })) : []
    return { ...base, status: 'available', preferredDays, workDays, fixedExtraDays, unspecifiedDays }
  }
  if (view.status === 'invalid') return { current: { status: 'unavailable', message: 'The saved preferences could not be read.' }, pending: null }
  return { current: describe(view.current?.choice || { mode: 'program_default' }, view.current?.effectiveDate),
    pending: view.pending ? describe(view.pending.choice, view.pending.effectiveDate) : null }
}

/** Read-only context. Neither this helper nor viewing preferences generates or saves a workout. */
export async function readWeekdayMusclePreferenceContext({ supabase, user, now = new Date() }: {
  supabase: any; user: { id: string } | null | undefined; now?: Date
}): Promise<WeekdayMusclePreferenceContext | Failure> {
  if (!user?.id) return failure(401, 'SIGN_IN', 'Sign in to review your workout preferences.')
  try {
    const { data: client, error } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).maybeSingle()
    if (error) return failure(503, 'UNAVAILABLE', 'Your member profile could not be confirmed. Retry.')
    if (!client || client.auth_user_id !== user.id) return failure(404, 'UNAVAILABLE', 'Your member profile could not be found.')
    if (!membershipCan(client, 'generatedCoaching', now) || !membershipCan(client, 'workoutDisplay', now)) return failure(403, 'FORBIDDEN', 'Weekday training preferences are unavailable for this membership.')
    const today = getClientLocalDate(client, now), timezone = getClientTimeZone(client)
    const view = getWeekdayMusclePreferencesView(client.onboarding_data, today, timezone)
    const [profileResult, outputResult] = await Promise.all([
      supabase.from('client_current_profiles').select('*').eq('client_id', client.client_id).eq('user_id', user.id).maybeSingle(),
      supabase.from('program_outputs').select('id,client_id,auth_user_id,program,program_json,generated_at')
        .eq('client_id', client.client_id).eq('program', client.program)
        .or(`auth_user_id.eq.${user.id},auth_user_id.is.null`)
        .order('generated_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
    ])
    const profile = profileResult.data
    const effectiveClient = profile ? { ...client,
      injuries: profile.injuries, limitations: profile.limitations, equipment_access: profile.equipment_access,
      workout_days_available: profile.workout_days_available ?? client.workout_days_available,
      current_workout_minutes_per_session: profile.workout_minutes_available ?? client.current_workout_minutes_per_session,
    } : client
    const output = outputResult.data
    const ownedOutput = output && output.client_id === client.client_id && output.program === client.program && (output.auth_user_id === user.id || output.auth_user_id === null)
    const base = { ok: true as const, user, client, effectiveClient, view, sourceOutput: ownedOutput ? output : null }
    const ready = (sourceStatus: WeekdayPreferenceSourceStatus): WeekdayMusclePreferenceContext => ({ ...base, sourceStatus,
      focusPlans: describeWeekdayFocusPlans({ sourceOutput: base.sourceOutput, sourceStatus, program: client.program, view }) })
    if (profileResult.error || outputResult.error) return ready({ status: 'unavailable', message: 'Your saved plan inputs could not be confirmed. Retry before saving a preferred focus.' })
    if (!ownedOutput) return ready({ status: 'unavailable', message: 'No matching saved training plan is available. A preferred focus cannot be prepared yet.' })
    const source = inspectProgramWeekSource({ programJson: output.program_json, outputProgram: output.program })
    return source.status === 'available' ? ready(source) : ready({
      status: 'unsupported', message: 'This saved plan cannot currently be redistributed without changing its prescribed work.', issues: source.issues.map(issue => issue.message),
      retainedEntries: source.retainedEntries, mappingProvenance: source.mappingProvenance,
    })
  } catch { return failure(503, 'UNAVAILABLE', 'Your workout preferences could not be loaded. Retry.') }
}

class PreferenceReplay extends Error {
  constructor(readonly onboardingData: Record<string, unknown>) { super('Already saved') }
}
class PreferenceDayChanged extends Error {}

/** The only write is an owner-scoped JSON CAS of this dedicated preference key. */
export async function saveWeekdayMusclePreferences({ supabase, user, input, clock = () => new Date() }: {
  supabase: any; user: { id: string } | null | undefined; input: SaveWeekdayMusclePreferenceInput; clock?: () => Date
}): Promise<{ ok: true; view: WeekdayMusclePreferencesView; focusPlans: WeekdayFocusPlans; replayed: boolean } | Failure> {
  const choice = parseWeekdayMuscleChoice(input.choice)
  if (!choice || !isPreferenceDate(input.expectedDate) || !validPreferenceOperationId(input.operationId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER) return failure(400, 'INVALID_PREFERENCES', 'Review the weekday choices and try again.')
  const context = await readWeekdayMusclePreferenceContext({ supabase, user, now: clock() })
  if (!context.ok) return context
  const { client } = context
  if (input.expectedClientId !== client.client_id || input.expectedUserId !== context.user.id) return failure(409, 'ACCOUNT_CHANGED', 'Your signed-in account changed. Reopen workout preferences.')
  const state = readWeekdayMusclePreferences(client.onboarding_data)
  const replay = state && state !== 'invalid' && state.lastOperation.id === input.operationId
  if (replay && (state.lastOperation.expectedRevision !== input.expectedRevision || state.lastOperation.requestedDate !== input.expectedDate || !sameWeekdayMuscleChoice(state.lastOperation.choice, choice))) return failure(409, 'STALE_PREFERENCES', 'This save no longer matches the confirmed choice. Reload your preferences.')
  if (!replay) {
    if (context.view.today !== input.expectedDate) return failure(409, 'DAY_CHANGED', 'The local day changed. Reload to review the next effective date.')
    if (context.view.revision !== input.expectedRevision) return failure(409, 'STALE_PREFERENCES', 'Your preferences changed elsewhere. Reload before saving again.')
    if (choice.mode === 'custom') {
      if (context.sourceStatus.status === 'unavailable') return failure(503, 'UNAVAILABLE', context.sourceStatus.message || 'Your saved plan is unavailable. Retry.')
      const distribution = redistributeProgramWeek({ programJson: context.sourceOutput?.program_json, outputProgram: client.program, days: choice.days })
      if (distribution.status !== 'supported') return { ...failure(422, 'UNSUPPORTED_DISTRIBUTION', 'These choices cannot be made from your existing prescribed plan.'), issues: distribution.issues.map(issue => issue.message) }
    }
  }
  const savedAt = clock().toISOString()
  const confirmed = (onboardingData: unknown, replayed: boolean) => {
    const view = getWeekdayMusclePreferencesView(onboardingData, getClientLocalDate(client, clock()), getClientTimeZone(client))
    return { ok: true as const, replayed, view, focusPlans: describeWeekdayFocusPlans({ sourceOutput: context.sourceOutput, sourceStatus: context.sourceStatus, program: client.program, view }) }
  }
  try {
    const result = await updateOwnedOnboardingData({ supabase, userId: context.user.id, clientId: client.client_id,
      merge(current) {
        const merged = mergeWeekdayMusclePreferences(current, { expectedRevision: input.expectedRevision, operationId: input.operationId, choice, today: input.expectedDate, savedAt })
        if (merged.replayed) throw new PreferenceReplay(current)
        // Recheck the current JSON timezone and the clock after a missed CAS.
        if (getClientLocalDate({ ...client, onboarding_data: current }, clock()) !== input.expectedDate) throw new PreferenceDayChanged()
        return merged.onboardingData
      },
    })
    if (!result.saved) return failure(result.status === 500 ? 503 : result.status, result.status === 409 ? 'STALE_PREFERENCES' : 'UNAVAILABLE', 'The save was not confirmed. Retry the same choice or reload if it changed elsewhere.')
    return confirmed(result.onboardingData, false)
  } catch (error) {
    if (error instanceof PreferenceReplay) return confirmed(error.onboardingData, true)
    if (error instanceof PreferenceDayChanged) return failure(409, 'DAY_CHANGED', 'The local day changed. Reload to review the next effective date.')
    if (error instanceof WeekdayMusclePreferenceConflict) return failure(409, 'STALE_PREFERENCES', 'Your preferences changed elsewhere. Reload before saving again.')
    return failure(503, 'UNAVAILABLE', 'The save was not confirmed. Retry the same choice.')
  }
}
