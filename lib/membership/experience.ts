export const EXPERIENCE_MONTHS = [6, 12, 24, 60] as const
export const CONTINUATION_CHOICES = ['continue', 'unsure', 'do_not_continue'] as const
export type ExperienceResponse = { rating: number; continuation: typeof CONTINUATION_CHOICES[number]; comment?: string }
export type ExperienceMilestone = {
  id: string; months: typeof EXPERIENCE_MONTHS[number]; due_at: string; reminder_due_at: string
  status: 'scheduled' | 'open' | 'completed' | 'suppressed'; can_respond: boolean
  feedback?: { response: ExperienceResponse; submitted_at: string }
}
export type ExperienceState = { clientId: string; eligible: boolean; milestones: ExperienceMilestone[] }
export const isExperienceId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

export function experienceResponse(value: unknown): ExperienceResponse | null {
  if (!object(value) || Object.keys(value).some(key => !['rating','continuation','comment'].includes(key)) ||
    typeof value.rating !== 'number' || !Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5 ||
    !CONTINUATION_CHOICES.includes(value.continuation as ExperienceResponse['continuation']) ||
    value.comment !== undefined && (typeof value.comment !== 'string' || value.comment.trim().length > 2000)) return null
  const comment = typeof value.comment === 'string' ? value.comment.trim() : ''
  return { rating: value.rating, continuation: value.continuation as ExperienceResponse['continuation'], ...(comment ? { comment } : {}) }
}

/** Only owner-facing milestone/feedback fields leave the authenticated API. */
export function experienceMilestone(value: unknown): ExperienceMilestone | null {
  if (!object(value) || !isExperienceId(value.id) || !EXPERIENCE_MONTHS.includes(value.months as ExperienceMilestone['months']) ||
    !timestamp(value.due_at) || !timestamp(value.reminder_due_at) || !['scheduled','open','completed','suppressed'].includes(String(value.status)) || typeof value.can_respond !== 'boolean') return null
  let feedback: ExperienceMilestone['feedback']
  if (value.feedback !== null && value.feedback !== undefined) {
    if (!object(value.feedback) || !timestamp(value.feedback.submitted_at)) return null
    const response = experienceResponse(value.feedback.response)
    if (!response) return null
    feedback = { response, submitted_at: value.feedback.submitted_at }
  }
  return { id: value.id, months: value.months as ExperienceMilestone['months'], due_at: value.due_at, reminder_due_at: value.reminder_due_at,
    status: value.status as ExperienceMilestone['status'], can_respond: value.can_respond, ...(feedback ? { feedback } : {}) }
}
