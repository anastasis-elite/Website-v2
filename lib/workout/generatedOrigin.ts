import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { activityDose, prescribedSetCount, workoutCompletionEvidence } from './activity'
import { workoutSessionKeys } from './session'

const field = 'generated_workout_origin'
const statusField = 'generated_workout_origin_status'
const context = 'anastasis:generated-workout-origin:v1:'
type Origin = { dayName: string; fingerprint: string }
type Proof = { version: 1; userId: string; clientId: string; program: string; date: string; origin: Origin; assigned: string; issuedAt: string }
type Scope = { userId: string; client: any; date: string; now?: Date }
const secret = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

// Ignore changing load guidance/actuals. Bind the saved occurrence keys and its
// prescribed completion denominator/dose, including non-strength activities.
function prescriptionIdentity(dayName: string, exercises: any[]) {
  if (typeof dayName !== 'string' || !dayName.trim() || !Array.isArray(exercises) || !exercises.length || exercises.length > 100 ||
    exercises.some(exercise => !exercise || typeof exercise !== 'object')) return null
  const keys = workoutSessionKeys(exercises)
  if (new Set(keys).size !== keys.length) return null
  return { dayName, occurrences: exercises.map((exercise, index) => {
    const dose = activityDose(exercise)
    return { key: keys[index], sets: prescribedSetCount(exercise), kind: dose.kind, metric: dose.metric, prescribed: dose.prescribed }
  }) }
}

export function generatedOriginIdentity(plannedWorkout: any): Origin | null {
  const identity = prescriptionIdentity(plannedWorkout?.day_name, plannedWorkout?.exercises)
  return identity ? { dayName: identity.dayName, fingerprint: digest(identity) } : null
}

export function hasGeneratedWorkoutOrigin(plan: any[]) {
  return Array.isArray(plan) && plan.some(exercise => exercise && (Object.hasOwn(exercise, field) || Object.hasOwn(exercise, statusField)))
}

// Only a record already read from saved history can qualify as preexisting
// legacy. New rows retain a server/database classification even without a token.
export function isLegacyGeneratedWorkoutSession(row: any) {
  return Boolean(row?.id && row.generated_origin_version == null && !hasGeneratedWorkoutOrigin(row.planned_exercises))
}

/** Issue at assignment time, before readiness or a resumed session can change.
 * The signed origin travels inside existing planned_exercises JSON; no generated
 * plan, historical prescription or completion rule is rewritten. */
export function attachGeneratedWorkoutOrigin({ userId, client, date, plannedWorkout, assignedWorkout, now = new Date() }: Scope & {
  plannedWorkout: any; assignedWorkout: any
}) {
  const key = secret()
  const origin = generatedOriginIdentity(plannedWorkout)
  const assigned = prescriptionIdentity(assignedWorkout?.day_name, assignedWorkout?.exercises)
  if (!key || !origin || !assigned || !userId || client?.auth_user_id !== userId || !client.client_id || !client.program ||
    !Number.isFinite(now.getTime()) || getClientLocalDate(client, now) !== date || hasGeneratedWorkoutOrigin(assignedWorkout.exercises)) return assignedWorkout
  const proof: Proof = { version: 1, userId, clientId: client.client_id, program: client.program, date, origin, assigned: digest(assigned), issuedAt: now.toISOString() }
  const encoded = Buffer.from(JSON.stringify(proof)).toString('base64url')
  const token = `gwo1.${encoded}.${createHmac('sha256', key).update(context + encoded).digest('base64url')}`
  return { ...assignedWorkout, exercises: assignedWorkout.exercises.map((exercise: any, index: number) => index === 0 ? { ...exercise, [field]: token } : exercise) }
}

/** Verify the retained assigned snapshot, never a newly recalculated dose. */
export function readGeneratedWorkoutOrigin({ userId, client, date, dayName, plan, now = new Date() }: Scope & { dayName: string; plan: any[] }): Origin | null {
  const key = secret()
  const identity = prescriptionIdentity(dayName, plan)
  if (!key || !identity || !userId || client?.auth_user_id !== userId || !client.client_id || !client.program || !Number.isFinite(now.getTime())) return null
  if (plan.some(exercise => Object.hasOwn(exercise, statusField))) return null
  const tokens = plan.filter(exercise => Object.hasOwn(exercise, field)).map(exercise => exercise[field])
  if (tokens.length !== 1 || typeof tokens[0] !== 'string' || tokens[0].length > 16000) return null
  try {
    const [version, encoded, signature, extra] = tokens[0].split('.')
    if (version !== 'gwo1' || !encoded || !signature || extra) return null
    const expected = createHmac('sha256', key).update(context + encoded).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const proof = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Proof
    if (proof.version !== 1 || proof.userId !== userId || proof.clientId !== client.client_id || proof.program !== client.program ||
      proof.date !== date || proof.assigned !== digest(identity) || !Number.isFinite(Date.parse(proof.issuedAt)) ||
      Date.parse(proof.issuedAt) > now.getTime() || !proof.origin?.dayName || !/^[a-f0-9]{64}$/.test(proof.origin.fingerprint)) return null
    return proof.origin
  } catch { return null }
}

/** Older pages had no assignment-time signature. A database-owned first-save
 * receipt can establish only an exact whole-source prescription, never an
 * adapted subset or a prescription reconstructed from today's readiness. */
export function readGeneratedWorkoutTransition({ userId, client, date, row, now = new Date() }: Scope & { row: any }): Origin | null {
  const receipt = row?.generated_origin_transition
  const plan = row?.planned_exercises
  if (row?.generated_origin_version == null || !receipt || receipt.version !== 1 || !userId || client?.auth_user_id !== userId ||
    row.auth_user_id !== userId || row.client_id !== client.client_id || row.program !== client.program || row.workout_source !== 'recommended' ||
    receipt.user_id !== userId || receipt.client_id !== client.client_id || receipt.program !== client.program || receipt.workout_log_id !== row.id ||
    receipt.local_date !== date || typeof receipt.source_output_id !== 'string' || !receipt.source_output_id || receipt.timezone !== getClientTimeZone(client) ||
    !Array.isArray(plan) || plan.some(exercise => !exercise || Object.hasOwn(exercise, field) ||
      Object.hasOwn(exercise, statusField) && exercise[statusField] !== 'unsigned')) return null
  const captured = Date.parse(receipt.captured_at), generated = Date.parse(receipt.source_generated_at), started = Date.parse(row.workout_started_at)
  if (![captured, generated, started, now.getTime()].every(Number.isFinite) || generated > started || started > captured || captured > now.getTime()) return null
  try {
    if (getClientLocalDate(client, new Date(captured)) !== date || getClientLocalDate(client, new Date(started)) !== date) return null
  } catch { return null }
  const source = generatedOriginIdentity(receipt.generated_day)
  const first = prescriptionIdentity(receipt.submitted_day_name, receipt.submitted_prescription)
  const current = prescriptionIdentity(row.day_name, plan)
  if (!source || !first || !current || digest(first) !== source.fingerprint || digest(current) !== digest(first)) return null
  // An older cached page can submit today's save timestamp with yesterday's or
  // last week's recorded work. Its actual confirmed evidence must also belong
  // to this source's full local-day occurrence. Completion thresholds stay in
  // workoutRecordComplete; this verifies only the provenance of that evidence.
  const { completedAt: performed } = workoutCompletionEvidence(Array.isArray(row.exercise_logs) ? row.exercise_logs : [], plan)
  if (!performed.length) return null
  try {
    if (performed.some(value => typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) < generated ||
      Date.parse(value) > now.getTime() || getClientLocalDate(client, new Date(value)) !== date)) return null
  } catch { return null }
  return source
}

/** Keep only a verified link on the existing immutable prescribed snapshot.
 * Invalid/unlinked records can still save their actual work, without claiming a
 * generated origin. Reads independently verify the retained proof as well. */
export function retainGeneratedWorkoutOrigin(args: Scope & { dayName: string; plan: any[]; source: 'manual' | 'recommended'; legacy?: boolean }): any[] {
  const verified = args.source === 'recommended' && readGeneratedWorkoutOrigin(args)
  if (verified) return args.plan
  if (args.source === 'recommended' && args.legacy === true && !hasGeneratedWorkoutOrigin(args.plan)) return args.plan
  const unsigned = args.plan.every(exercise => exercise && !Object.hasOwn(exercise, field) &&
    (!Object.hasOwn(exercise, statusField) || exercise[statusField] === 'unsigned'))
  const retained = args.plan.map(withoutGeneratedWorkoutOrigin)
  // A new unsigned/rejected submission is never converted to a legacy record.
  // Keep this state on the retained snapshot through GET, drafts and later saves.
  return args.source === 'recommended' ? retained.map((exercise, index) => index === 0 ? { ...exercise, [statusField]: unsigned ? 'unsigned' : 'unverified' } : exercise) : retained
}

export function withoutGeneratedWorkoutOrigin(exercise: any) {
  if (!exercise || typeof exercise !== 'object' || !Object.hasOwn(exercise, field) && !Object.hasOwn(exercise, statusField)) return exercise
  const retained = { ...exercise }
  delete retained[field]
  delete retained[statusField]
  return retained
}
