import { addCalendarMonths } from '@/lib/body-assessment/schedule'
import { getClientLocalDate, getClientTimeZone, recordLocalDate } from '@/lib/timezone'

export type MemberAssessmentStatus = {
  due: boolean
  dueKind: 'quarterly' | 'review' | null
  unavailable: boolean
  lastCompletedAt: string | null
  lastReviewCompletedAt: string | null
  nextFullDueDate: string
  nextReviewDueDate: string
  savedAnswers: Record<string, unknown>
}

type SavedAssessment = { submitted_at: string; data?: Record<string, unknown>; source?: string | null } | null
export function memberAssessmentStatusFromRecords({ client, full, review, unavailable = false, now = new Date() }: {
  client: any; full: SavedAssessment; review: SavedAssessment; unavailable?: boolean; now?: Date
}): MemberAssessmentStatus {
  const valid = (row: SavedAssessment) => !row || Number.isFinite(Date.parse(row.submitted_at)) && Date.parse(row.submitted_at) <= now.getTime()
  unavailable ||= !valid(full) || !valid(review)
  const today = getClientLocalDate(client, now), zone = getClientTimeZone(client)
  const fullDate = full && valid(full) ? recordLocalDate(full.submitted_at, zone) : null
  // A review predating a later full submission must not move that full's cycle.
  const latest = full && (!review || Date.parse(full.submitted_at) >= Date.parse(review.submitted_at)) ? full : review
  const latestDate = latest && valid(latest) ? recordLocalDate(latest.submitted_at, zone) : null
  const nextFullDueDate = fullDate ? addCalendarMonths(fullDate, 3) : today
  const nextReviewDueDate = latestDate ? addCalendarMonths(latestDate, 1) : today
  const dueKind = unavailable ? null : !fullDate || nextFullDueDate <= today ? 'quarterly' : nextReviewDueDate <= today ? 'review' : null
  return {
    due: dueKind !== null, dueKind, unavailable,
    lastCompletedAt: full && valid(full) ? full.submitted_at : null,
    lastReviewCompletedAt: review && valid(review) ? review.submitted_at : null,
    nextFullDueDate, nextReviewDueDate,
    savedAnswers: latest?.data && typeof latest.data === 'object' && !Array.isArray(latest.data) ? latest.data : {},
  }
}

export async function getMonthlyAssessmentStatus(supabase: any, client: any, now = new Date()): Promise<MemberAssessmentStatus> {
  const empty = () => memberAssessmentStatusFromRecords({ client, full: null, review: null, unavailable: true, now })
  if (!client?.client_id || !client?.auth_user_id) return empty()
  try {
    const base = () => supabase.from('assessments').select('id,submitted_at,data,source')
      .eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id)
      .lte('submitted_at', now.toISOString())
    const [full, review] = await Promise.all([
      // Keep the existing table and assessment types. Legacy monthly submissions
      // were full forms; only the new explicit review source is excluded.
      base().in('assessment_type', ['initial', 'monthly']).or('source.is.null,source.neq.monthly-review')
        .order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
      base().eq('assessment_type', 'monthly').eq('source', 'monthly-review')
        .order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    return memberAssessmentStatusFromRecords({ client, full: full.data, review: review.data, unavailable: Boolean(full.error || review.error), now })
  } catch { return empty() }
}
