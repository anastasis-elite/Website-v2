import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { workoutLocalDate } from '@/lib/workout/history'
import { workoutRecordComplete } from '@/lib/workout/activity'
import { getTierCapabilities } from '@/lib/entitlements'

export type RecoveryRewardSuggestion = {
  version: 1
  clientId: string
  date: string
  timezone: string
  kind: 'safety' | 'reward'
  id: string
  title: string
  description: string
}

/** Raw saved sources, before sleep/passive-health fallback normalization.
 * Unavailable reads remain unknown; this evidence never grants activity or heat clearance. */
export type RecoveryRewardSources = {
  recoveryLog: any
  recoveryAvailable: boolean
  workoutsAvailable: boolean
}

type RewardInput = {
  date: string
  userId: string
  client: any
  sources?: RecoveryRewardSources
  workouts: any[]
  safety: {
    redFlag?: boolean
    recoveryStatus?: string
    adjustmentLevel?: string
    canTrain?: boolean
    workoutState?: string
  }
  now?: Date
}

function rating(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string' || typeof value === 'string' && !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 10 ? parsed : null
}

function owned(row: any, userId: string, clientId: string) {
  return row?.client_id === clientId && row?.auth_user_id === userId
}

function validInstant(value: unknown, now: Date) {
  if (typeof value !== 'string' || !value.trim()) return false
  const instant = Date.parse(value)
  return Number.isFinite(instant) && instant <= now.getTime()
}

/** A display-only decision, shared by Today and Recovery. No randomness, writes,
 * planned-effort assumptions, completion credit, or missing-as-clear safety gates. */
export function buildRecoveryRewardSuggestion({ date, userId, client, sources, workouts, safety, now = new Date() }: RewardInput): RecoveryRewardSuggestion | null {
  if (!userId || !client?.client_id || client.auth_user_id !== userId ||
    !Number.isFinite(now.getTime()) || date !== getClientLocalDate(client, now)) return null
  const clientId = String(client.client_id), timezone = getClientTimeZone(client)
  const result = (kind: RecoveryRewardSuggestion['kind'], id: string, title: string, description: string): RecoveryRewardSuggestion =>
    ({ version: 1, clientId, date, timezone, kind, id, title, description })

  // Existing safety decisions and qualified explicit saved flags take priority.
  // Free-text notes and profile fields are not interpreted by this surface.
  const raw = sources?.recoveryLog
  const saved = owned(raw, userId, clientId) && raw.log_date === date &&
    (raw.updated_at == null || validInstant(raw.updated_at, now)) &&
    (raw.created_at == null || validInstant(raw.created_at, now)) &&
    (raw.check_in_completed_at == null || validInstant(raw.check_in_completed_at, now) &&
      getClientLocalDate(client, new Date(raw.check_in_completed_at)) === date) ? raw : null
  if (safety.redFlag || safety.recoveryStatus === 'full_recovery_or_red_flag' ||
    safety.adjustmentLevel === 'level_4_rest_or_red_flag' ||
    safety.canTrain === false && !['rest', 'unavailable'].includes(safety.workoutState || '') ||
    [saved?.sick, saved?.dizzy, saved?.overheated].some(value => value === true)) {
    return result('safety', 'safety-first', 'Your safety comes first.',
      'Pause activity and follow your existing safety and care guidance. Seek appropriate medical support if you feel unwell or your symptoms need attention.')
  }

  // Personalized recovery is available only in tiers that already include it.
  // Safety remains visible independently of recommendation entitlement.
  if (!getTierCapabilities(client.program).recoveryRecommendation) return null

  // Current schemas do not establish walking or heat suitability. Quiet rest
  // and self-chosen listening work without interpreting absent flags, default
  // empty restriction arrays, or a completed workout as clearance.
  const log = sources?.recoveryAvailable === true ? saved : null
  const energy = rating(log?.energy_level), stress = rating(log?.stress_level), soreness = rating(log?.soreness_level)
  const workoutCompleted = sources?.workoutsAvailable === true && (workouts || []).some(row => {
    if (!owned(row, userId, clientId)) return false
    if ([row.workout_started_at, row.completed_at, row.updated_at].some(value => value != null && !validInstant(value, now))) return false
    try { return workoutLocalDate(row, timezone) === date && workoutRecordComplete(row) }
    catch { return false }
  })

  if (energy !== null && energy <= 3) return result('reward', 'low-energy', 'Let yourself settle in.',
    'You logged low energy today. Get comfortable and put on something soothing to listen to, or enjoy a little quiet. There’s nothing to finish here.')
  if (soreness !== null && soreness >= 7) return result('reward', workoutCompleted ? 'sore-after-workout' : 'sore-day', 'A little comfort is yours.',
    `${workoutCompleted ? 'Your workout is saved, and you logged soreness today.' : 'You logged soreness today.'} Give yourself a comfortable spot and some favorite music. Let this be a pause without another goal.`)
  if (stress !== null && stress >= 8) return result('reward', workoutCompleted ? 'stress-after-workout' : 'high-stress', 'Let the day soften.',
    `${workoutCompleted ? 'Your workout is saved, and you logged high stress today.' : 'You logged high stress today.'} Settle into a comfortable spot with a podcast you enjoy. Take a little time that’s just for you.`)
  if (workoutCompleted) return result('reward', 'after-workout', 'Your workout is done. Unwind your way.',
    'Your completed workout is saved. Put on a favorite playlist and get comfortable, or enjoy a few quiet minutes for yourself.')
  if (energy !== null && energy >= 7) return result('reward', 'energy-to-enjoy', 'Make a little room for enjoyment.',
    'You logged good energy today. Take a comfortable pause with a podcast or music you love, simply because you enjoy it.')
  return result('reward', 'quiet-moment', 'A little room for yourself.',
    'If you’d like a pause, settle somewhere comfortable with music, a podcast, or a little quiet. Choose what feels rewarding to you.')
}
