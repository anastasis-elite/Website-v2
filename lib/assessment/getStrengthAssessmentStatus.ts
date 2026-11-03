import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { strengthCadence } from './strengthCadence'
import { loadWorkoutHistory, workoutLocalDate } from '@/lib/workout/history'

export type StrengthAssessmentStatus = {
  state: 'due' | 'draft' | 'completed' | 'unavailable'
  label: 'Due' | 'In Progress' | 'Completed' | 'Status unavailable'
  period: string
  completedAt: string | null
  savedAt: string | null
  assessmentId: string | null
  actionLabel: string
  href: string
  unavailable: boolean
  previousDraft: { period: string; savedAt: string; href: string } | null
  eligibleDate?: string | null
  scheduledDate?: string | null
  latestCompletedAt?: string | null
  eligible?: boolean
  isWorkoutDay?: boolean
  completedToday?: boolean
  completedDate?: string | null
  workoutHref?: string
}

export function getStrengthAssessmentPeriod(client: any, now = new Date()) {
  return `${getClientLocalDate(client, now).slice(0, 7)}-01`
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime())
}

export function strengthAssessmentStatusFromRecords({
  period, session, assessment, previousDraft, unavailable = false,
}: {
  period: string
  session?: any
  assessment?: any
  previousDraft?: any
  unavailable?: boolean
}): StrengthAssessmentStatus {
  const href = `/dashboard/assessment/start2?period=${period}`
  // Every historical strength row was a final submission. Keep the original
  // date when a legacy submission and its later session record both exist.
  const completions = [
    assessment && validTimestamp(assessment.submitted_at)
      ? { date: assessment.submitted_at, id: assessment.id }
      : null,
    session?.status === 'completed' && validTimestamp(session.completed_at)
      ? { date: session.completed_at, id: session.assessment_id }
      : null,
  ].filter((record): record is { date: string; id: any } => Boolean(record))
  completions.sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
  const completed = completions[0]
  const previous = previousDraft?.status === 'draft' && previousDraft.period < period && validTimestamp(previousDraft.saved_at)
    ? { period: String(previousDraft.period), savedAt: previousDraft.saved_at, href: `/dashboard/assessment/start2?period=${previousDraft.period}` }
    : null

  if (completed) return {
    state: 'completed', label: 'Completed', period, completedAt: completed.date,
    savedAt: completed.date, assessmentId: completed.id ? String(completed.id) : null,
    actionLabel: 'View Saved Results', href, unavailable: false, previousDraft: previous,
  }
  if (unavailable) return {
    state: 'unavailable', label: 'Status unavailable', period, completedAt: null,
    savedAt: null, assessmentId: null, actionLabel: 'Retry Loading Assessment', href,
    unavailable: true, previousDraft: previous,
  }
  if (session?.status === 'draft' && validTimestamp(session.saved_at)) return {
    state: 'draft', label: 'In Progress', period, completedAt: null,
    savedAt: session.saved_at, assessmentId: null, actionLabel: 'Resume Assessment', href,
    unavailable: false, previousDraft: previous,
  }
  return {
    state: 'due', label: 'Due', period, completedAt: null, savedAt: null,
    assessmentId: null, actionLabel: 'Start Assessment', href, unavailable: false, previousDraft: previous,
  }
}

export async function getStrengthAssessmentStatus(supabase: any, client: any, now = new Date()): Promise<StrengthAssessmentStatus> {
  const period = getStrengthAssessmentPeriod(client, now)
  if (!client?.client_id || !client?.auth_user_id) return strengthAssessmentStatusFromRecords({ period, unavailable: true })
  const read = async (query: () => PromiseLike<{ data: any; error: any }>) => {
    try { return await query() } catch { return { data: null, error: true } }
  }
  const [latestResult, sessionResult, previousResult] = await Promise.all([
    read(() => supabase.from('assessments').select('id,submitted_at,assessment_period')
      .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id).eq('assessment_type', 'strength')
      .lte('submitted_at', now.toISOString()).order('submitted_at', { ascending: false }).limit(1).maybeSingle()),
    read(() => supabase.from('strength_assessment_sessions').select('period,status,saved_at,completed_at,assessment_id')
      .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id).eq('period', period).maybeSingle()),
    read(() => supabase.from('strength_assessment_sessions').select('period,status,saved_at')
      .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id).eq('status', 'draft')
      .lt('period', period).lte('saved_at', now.toISOString()).order('period', { ascending: false }).limit(1).maybeSingle()),
  ])
  const notFuture = (value: unknown): value is string => validTimestamp(value) && Date.parse(value) <= now.getTime()
  const latest = !latestResult.error && notFuture(latestResult.data?.submitted_at) ? latestResult.data : null
  const savedPeriod = latest ? /^\d{4}-(0[1-9]|1[0-2])-01$/.test(latest.assessment_period || '')
    ? latest.assessment_period : getStrengthAssessmentPeriod(client, new Date(latest.submitted_at)) : null
  const rawSession = sessionResult.data
  const session = !sessionResult.error && rawSession?.period === period &&
    (rawSession.status === 'completed' ? notFuture(rawSession.completed_at) : rawSession.status === 'draft' && notFuture(rawSession.saved_at)) ? rawSession : null
  const previousDraft = !previousResult.error && notFuture(previousResult.data?.saved_at) && previousResult.data?.period !== savedPeriod ? previousResult.data : null
  const fallback = strengthAssessmentStatusFromRecords({ period, session, previousDraft, unavailable: true })
  // A failed final-history read cannot establish the latest completion/cadence.
  if (latestResult.error || latestResult.data && !latest) return { ...fallback, unavailable: true }
  let cadence = strengthCadence(client, latest?.submitted_at || null, now)
  if (latest && cadence.monday && cadence.monday <= getClientLocalDate(client, now)) {
    const history = await loadWorkoutHistory({ supabase, client, authUserId: client.auth_user_id,
      startDate: cadence.monday, completed: true, limit: 1 }).catch(() => ({ data: null, error: true }))
    if (history.error) return { ...fallback, unavailable: true }
    const mondayCompleted = history.data?.some((row: any) => row.completed &&
      workoutLocalDate(row, getClientTimeZone(client)) === cadence.monday &&
      (!row.workout_started_at || notFuture(row.workout_started_at))) || false
    cadence = strengthCadence(client, latest.submitted_at, now, mondayCompleted)
  }
  const timing = { eligibleDate: cadence.eligibleDate, scheduledDate: cadence.scheduledDate,
    eligible: cadence.eligible, isWorkoutDay: cadence.isWorkoutDay, completedToday: cadence.completedToday,
    completedDate: cadence.completedDate,
    workoutHref: `/dashboard/assessment/start2?period=${cadence.scheduledDate.slice(0, 7)}-01`,
    latestCompletedAt: latest?.submitted_at || null }
  if (session?.status === 'draft' && savedPeriod !== period) return { ...strengthAssessmentStatusFromRecords({ period, session, previousDraft }), ...timing }
  if (latest && (!cadence.eligible || cadence.completedToday)) {
    const status = strengthAssessmentStatusFromRecords({ period: savedPeriod!, assessment: latest, previousDraft })
    return { ...status, ...timing, previousDraft: fallback.previousDraft, href: `${status.href}&assessmentId=${encodeURIComponent(latest.id)}` }
  }
  return { ...strengthAssessmentStatusFromRecords({ period, session, previousDraft,
    unavailable: Boolean(sessionResult.error) }), ...timing }
}

export function formatStrengthAssessmentTimestamp(value: string | null, client: any, includeTime = false) {
  if (!validTimestamp(value)) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: getClientTimeZone(client), month: 'long', day: 'numeric', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } as const : {}),
  }).format(new Date(value))
}

export function getStrengthAssessmentDetail(status: StrengthAssessmentStatus, client: any) {
  if (status.state === 'completed') return `Completed ${formatStrengthAssessmentTimestamp(status.completedAt, client)}. Saved results are available.${status.eligibleDate ? ` Next eligible date: ${formatStrengthAssessmentTimestamp(status.eligibleDate + 'T12:00:00Z', { timezone: 'UTC' })}.` : ''}`
  if (status.state === 'draft') return `Last saved ${formatStrengthAssessmentTimestamp(status.savedAt, client, true)}. Continue where you stopped.`
  if (status.state === 'unavailable') return 'We couldn’t load your assessment status. Open the assessment to retry before submitting again.'
  return status.scheduledDate ? `Your strength assessment is available.${status.eligibleDate ? ` Scheduled as your workout on ${formatStrengthAssessmentTimestamp(status.scheduledDate + 'T12:00:00Z', { timezone: 'UTC' })}.` : ' Complete your first strength baseline to establish your starting point.'}` : 'Your strength baseline is available.'
}
