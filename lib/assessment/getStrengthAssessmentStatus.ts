import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { getClientDayRange } from '@/lib/schedule/time'

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
  const [year, month] = period.split('-').map(Number)
  const nextPeriod = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const start = getClientDayRange(client, period).start.toISOString()
  const end = getClientDayRange(client, nextPeriod).start.toISOString()
  try {
    // Keep published final recognition independent of draft-table availability.
    // A failed draft read must never hide a known, owned completed assessment.
    const read = async (query: () => PromiseLike<{ data: any; error: any }>) => {
      try { return await query() } catch { return { data: null, error: true } }
    }
    const [assessmentResult, sessionResult, previousResult] = await Promise.all([
      read(() => supabase.from('assessments').select('id,submitted_at,assessment_period')
        .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id)
        .eq('assessment_type', 'strength')
        .or(`assessment_period.is.null,assessment_period.eq.${period}`)
        .gte('submitted_at', start).lt('submitted_at', end).lte('submitted_at', now.toISOString())
        .order('submitted_at', { ascending: true }).limit(1).maybeSingle()),
      read(() => supabase.from('strength_assessment_sessions').select('period,status,saved_at,completed_at,assessment_id')
        .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id)
        .eq('period', period).maybeSingle()),
      read(() => supabase.from('strength_assessment_sessions').select('period,status,saved_at')
        .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id)
        .eq('status', 'draft').lt('period', period).lte('saved_at', now.toISOString())
        .order('period', { ascending: false }).limit(1).maybeSingle()),
    ])
    const withinCurrentMonth = (value: unknown) => validTimestamp(value) &&
      Date.parse(value) >= Date.parse(start) && Date.parse(value) < Date.parse(end) && Date.parse(value) <= now.getTime()
    const data = assessmentResult.data
    const assessment = !assessmentResult.error && withinCurrentMonth(data?.submitted_at) &&
      (data.assessment_period == null || data.assessment_period === period) ? data : null
    const rawSession = sessionResult.data
    const session = !sessionResult.error && rawSession?.period === period &&
      (rawSession.status === 'completed' ? withinCurrentMonth(rawSession.completed_at) :
        rawSession.status === 'draft' && withinCurrentMonth(rawSession.saved_at)) ? rawSession : null
    const previousDraft = !previousResult.error && validTimestamp(previousResult.data?.saved_at) &&
      Date.parse(previousResult.data.saved_at) <= now.getTime() ? previousResult.data : null
    return strengthAssessmentStatusFromRecords({ period, assessment, session, previousDraft,
      unavailable: Boolean(assessmentResult.error || sessionResult.error),
    })
  } catch {
    return strengthAssessmentStatusFromRecords({ period, unavailable: true })
  }
}

export function formatStrengthAssessmentTimestamp(value: string | null, client: any, includeTime = false) {
  if (!validTimestamp(value)) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: getClientTimeZone(client), month: 'long', day: 'numeric', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } as const : {}),
  }).format(new Date(value))
}

export function getStrengthAssessmentDetail(status: StrengthAssessmentStatus, client: any) {
  if (status.state === 'completed') return `Completed ${formatStrengthAssessmentTimestamp(status.completedAt, client)}. Saved results are available.`
  if (status.state === 'draft') return `Last saved ${formatStrengthAssessmentTimestamp(status.savedAt, client, true)}. Continue where you stopped.`
  if (status.state === 'unavailable') return 'We couldn’t load your assessment status. Open the assessment to retry before submitting again.'
  return 'Your strength assessment is due for this month.'
}
