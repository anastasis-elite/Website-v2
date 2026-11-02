import { membershipCan } from '@/lib/membership/policy'
import { getManualWorkoutLibrary, isReferenceSessionVariant } from '@/lib/workout/manualWorkout'
import { selectedFounderBase, buildSelectedPrescription } from '@/lib/workout/selectedPrescription'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { loadProgramLogicInputs } from '@/lib/dashboard/logic/loadProgramLogicInputs'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getCycleTrainingAdjustment } from '@/lib/cycle/getCycleTrainingAdjustment'
import { evaluateSafetyEscalation } from '@/lib/safety/evaluateSafetyEscalation'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'

import { isApprovedPhoenixPrescriptionTrack } from '@/lib/program/generateProgram'
import type { SelectedPrescriptionResponse } from './selectedPrescriptionTypes'
import { readSessionEquipmentContext } from './selectedPrescriptionTypes'

export type SelectedPrescriptionResolution = { httpStatus: number; response: SelectedPrescriptionResponse }
const resolved = (response: SelectedPrescriptionResponse, httpStatus = 200): SelectedPrescriptionResolution => ({ httpStatus, response })

// This request only reads existing inputs. Fail closed on a source read error,
// and prevent a future orchestration edit from writing a plan or recommendation.
function checkedReadOnlyClient(supabase: any) {
  let failed = false
  const wrap = (query: any): any => new Proxy(query, {
    get(target, key) {
      if (['insert', 'update', 'upsert', 'delete'].includes(String(key))) return () => { failed = true; throw new Error('Read-only prescription request') }
      if (key === 'then') return (resolve: any, reject: any) => Promise.resolve(target).then((result: any) => {
        if (result?.error) { failed = true; throw new Error('Prescription input could not be loaded') }
        return result
      }, () => { failed = true; throw new Error('Prescription input could not be loaded') }).then(resolve, reject)
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? (...args: any[]) => wrap(value.apply(target, args)) : value
    },
  })
  return { from: (...args: any[]) => wrap(supabase.from(...args)), storage: supabase.storage,
    assertSuccessfulReads: () => { if (failed) throw new Error('Prescription input could not be confirmed') },
    rpc: () => { failed = true; throw new Error('Read-only prescription request') } }
}

/** Shared read-only resolver for selection and the first guided save.
 * The user must come from auth.getUser(); an optional client ID is still
 * freshly constrained to that authenticated owner before any tier or health read.
 */
export async function resolveSelectedPrescription({ supabase, user, clientId, exerciseId, variantId, equipmentContext }: {
  supabase: any; user: { id: string } | null | undefined; clientId?: string; exerciseId: string; variantId: string; equipmentContext?: unknown
}): Promise<SelectedPrescriptionResolution> {
  try {
    if (!user?.id) return resolved({ status: 'blocked', message: 'Sign in before choosing a prescription.' }, 401)
    if (typeof exerciseId !== 'string' || typeof variantId !== 'string' || !exerciseId || !variantId || exerciseId.length > 200 || variantId.length > 200) {
      return resolved({ status: 'unavailable', message: 'Choose an exercise and its equipment variant.' }, 400)
    }
    const sessionContext = equipmentContext === undefined ? null : readSessionEquipmentContext(equipmentContext, variantId)
    if (equipmentContext !== undefined && !sessionContext) return resolved({ status: 'unavailable', message: 'Review the equipment chosen for this session.' }, 400)
    let memberQuery = supabase.from('clients').select('*').eq('auth_user_id', user.id)
    if (clientId !== undefined) memberQuery = memberQuery.eq('client_id', clientId)
    const { data: client, error: clientError } = await memberQuery.maybeSingle()
    if (clientError) throw new Error('Member input unavailable')
    if (!client) return resolved({ status: 'blocked', message: 'Your member profile could not be found.' }, 404)
    if (!membershipCan(client, 'workoutLogging')) return resolved({ status: 'blocked', message: 'Workout logging is unavailable for this membership.' }, 403)
    if (client.program === 'tracker') return resolved({ status: 'tracking_only', message: 'Enter your own actual sets, repetitions and load. Guided prescriptions are not included.' })
    if (!membershipCan(client, 'generatedCoaching')) return resolved({ status: 'blocked', message: 'Guided prescriptions are unavailable for this membership.' }, 403)
    const catalog = getManualWorkoutLibrary().find(exercise => exercise.id === exerciseId)
    const selectedVariant = catalog?.available_variants.find(variant => variant.id === variantId)
    if (!catalog || !selectedVariant || sessionContext && !isReferenceSessionVariant(catalog, variantId, sessionContext.equipment)) {
      return resolved({ status: 'unavailable', message: 'The selected catalog exercise or variant is unavailable.' }, 400)
    }
    const reads = checkedReadOnlyClient(supabase)
    let phoenixTrack: unknown
    if (client.program === 'phoenix') {
      const { data: savedOutput } = await reads.from('program_outputs').select('id,program_json')
        .eq('client_id', client.client_id).eq('program', client.program)
        .or(`auth_user_id.eq.${user.id},auth_user_id.is.null`)
        .order('generated_at', { ascending: false }).limit(1).maybeSingle()
      phoenixTrack = savedOutput?.program_json?.phoenix_track
      if (!isApprovedPhoenixPrescriptionTrack(phoenixTrack)) return resolved({ status: 'unavailable',
        message: 'Recommendation unavailable. Review the Phoenix track in your saved plan.', setupHref: '/dashboard/onboarding/plan' })
    }
    const [profileResult, initialResult, strengthResult, safetyFlags] = await Promise.all([
      reads.from('client_current_profiles').select('*').eq('client_id', client.client_id).eq('user_id', user.id).maybeSingle(),
      reads.from('assessments').select('*').eq('client_id', client.client_id).eq('assessment_type', 'initial').order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
      reads.from('assessments').select('*').eq('client_id', client.client_id).eq('assessment_type', 'strength').order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
      getRecentSafetyFlags(reads as unknown as typeof supabase, client.client_id),
    ])
    if (!initialResult.data) return resolved({ status: 'unavailable', message: 'Recommendation unavailable. Complete your saved member assessment.', setupHref: '/dashboard/assessment/start' })
    if (!strengthResult.data) return resolved({ status: 'unavailable', message: 'Recommendation unavailable. Complete your strength assessment.', setupHref: '/dashboard/assessment/start2' })
    const effectiveClient = { ...client, ...(profileResult.data || {}), client_id: client.client_id, auth_user_id: user.id, program: client.program }
    // Request-scoped calculation view only. No saved profile or assessment is
    // changed when a member explicitly selects equipment available today.
    const calculationClient = sessionContext ? { ...effectiveClient, equipment_access: [sessionContext.equipment] } : effectiveClient
    if (safetyFlags.length || evaluateSafetyEscalation({ client: effectiveClient, initialAssessment: initialResult.data.data, strengthAssessment: strengthResult.data.data }).length) {
      return resolved({ status: 'blocked', message: 'Review your existing safety and recovery guidance before training.', setupHref: '/dashboard/recovery' })
    }
    const base = selectedFounderBase({ client: calculationClient, initialAssessment: initialResult.data, strengthAssessment: strengthResult.data, catalogExercise: catalog, variantId, phoenixTrack, equipmentContext: sessionContext || undefined })
    if (!base) return resolved({ status: 'unavailable', message: 'Recommendation unavailable. This selection needs an established template, supported equipment and valid assessment inputs.', setupHref: '/dashboard/assessment/start2' })
    const dailyPlan = await getDailyExecutionPlan({ supabase: reads, client: calculationClient })
    const inputs = await loadProgramLogicInputs({ supabase: reads, user, client: calculationClient, program: client.program,
      dailyPlan, cycleStatus: getCycleStatus(calculationClient), cycleAdjustment: getCycleTrainingAdjustment(calculationClient),
      plannedWorkout: { day_name: 'Selected exercise', day_intent: 'training', exercises: [base.exercise] },
      plannedExercises: [base.exercise], monthlyAssessmentsDueCount: 0 })
    reads.assertSuccessfulReads()
    const response = buildSelectedPrescription({ inputs, exercise: base.exercise, variantId })
    return resolved(response.status === 'available' && sessionContext ? { ...response, prescription: { ...response.prescription, equipmentContext: sessionContext } } : response)
  } catch {
    return resolved({ status: 'unavailable', message: 'Recommendation unavailable. Your saved inputs could not be confirmed. Retry when connected.' }, 503)
  }
}
