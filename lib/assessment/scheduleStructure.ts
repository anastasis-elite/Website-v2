import { validateScheduleStructure } from './validateScheduleStructure'

export const SCHEDULE_STRUCTURE_VERSION = 1
export const SCHEDULE_STRUCTURE_PATH = '/dashboard/assessment/daily-structure'

type ScheduleStructureTask = {
  id: string
  event_type: string
  title?: string | null
  source?: string
  action_route?: string | null
  calendar_event_id?: string
  external_event_id?: string | null
  external_calendar_source?: string | null
}

export type ScheduleStructureSubmission = {
  assessmentVersion: number
  eventId: string
  submittedAt: string
  answers: Record<string, any>
}

const internalSources = new Set(['manual', 'anastasis', 'program', 'mobile', 'system'])
const legacyTitles = new Set([
  'schedule structure assessment',
  'daily structure assessment',
  'daily structure review',
])

function internalAssessment(event: ScheduleStructureTask) {
  return event.event_type === 'assessment' && internalSources.has(event.source || '') &&
    !event.calendar_event_id && !event.external_event_id && !event.external_calendar_source
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function assessmentRoute(value: string | null | undefined): URL | null {
  if (!value?.startsWith('/') || value.startsWith('//')) return null
  try {
    const url = new URL(value, 'https://anastasis.invalid')
    return url.origin === 'https://anastasis.invalid' && url.pathname === SCHEDULE_STRUCTURE_PATH ? url : null
  } catch { return null }
}

export function getScheduleStructureVersion(event: ScheduleStructureTask): number | null {
  if (!internalAssessment(event)) return null
  const route = assessmentRoute(event.action_route)
  const title = String(event.title || '').trim().replace(/\s+/g, ' ').toLowerCase()
  if (!route && !legacyTitles.has(title)) return null
  const requestedVersion = route?.searchParams.get('assessmentVersion')
  if (requestedVersion === null || requestedVersion === undefined) return SCHEDULE_STRUCTURE_VERSION
  if (!/^[1-9]\d*$/.test(requestedVersion)) return null
  const version = Number(requestedVersion)
  return Number.isSafeInteger(version) ? version : null
}

export function scheduleStructureTaskKey(event: Pick<ScheduleStructureTask, 'id'>): string {
  const month = getScheduleStructureMonth(event.id)
  return month ? `standalone:${month}` : event.id
}

// The monthly review already uses a stable month-scoped submission. Give its
// schedule projection an identity without creating a second completion record.
export function getScheduleStructureMonth(eventId: string): string | null {
  const match = /^schedule-structure:([1-9]\d{3}-(?:0[1-9]|1[0-2]))$/.exec(eventId)
  return match?.[1] || null
}

export function scheduleStructureMonthlyTaskId(month: string): string {
  return `schedule-structure:${month}`
}

export function scheduleStructureMonthlyTask(month: string): ScheduleStructureTask {
  return {
    id: scheduleStructureMonthlyTaskId(month), event_type: 'assessment', source: 'system',
    title: 'Schedule Structure Assessment',
    action_route: `${SCHEDULE_STRUCTURE_PATH}?assessmentVersion=${SCHEDULE_STRUCTURE_VERSION}`,
  }
}

export function scheduleStructureTaskHref(event: ScheduleStructureTask): string | null {
  const version = getScheduleStructureVersion(event)
  if (version === null) return null
  const query = new URLSearchParams({ eventId: event.id, assessmentVersion: String(version) })
  return `${SCHEDULE_STRUCTURE_PATH}?${query}`
}

export function getScheduleStructureSubmission(onboardingData: unknown, event: ScheduleStructureTask): ScheduleStructureSubmission | null {
  // Once submitted, the canonical task ID preserves identity across a calendar
  // title edit. An explicit different assessment route/version still wins.
  const version = getScheduleStructureVersion(event) ??
    (internalAssessment(event) && !event.action_route ? SCHEDULE_STRUCTURE_VERSION : null)
  if (version === null) return null
  const assessments = record(record(onboardingData)?.scheduleStructureAssessments)
  const submissions = record(assessments?.[String(version)])
  const submission = record(submissions?.[scheduleStructureTaskKey(event)])
  const monthly = getScheduleStructureMonth(event.id) !== null
  if (!submission || submission.assessmentVersion !== version ||
    (submission.eventId !== event.id && !(monthly && submission.eventId === undefined)) ||
    typeof submission.submittedAt !== 'string' || !Number.isFinite(Date.parse(submission.submittedAt))) return null
  const validated = validateScheduleStructure(submission.answers)
  if ('error' in validated) return null
  return { assessmentVersion: version, eventId: event.id, submittedAt: submission.submittedAt, answers: validated.answers }
}
