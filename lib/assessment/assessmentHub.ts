import { getMonthlyAssessmentStatus, type MemberAssessmentStatus } from './getMonthlyAssessmentStatus'
import { getClientLocalDate } from '@/lib/timezone'
import { getBodyAssessmentScheduleStatus } from '@/lib/body-assessment/schedule'
import { getStrengthAssessmentStatus } from './getStrengthAssessmentStatus'
import { getScheduleStructureSubmission, scheduleStructureMonthlyTask, scheduleStructureTaskHref } from './scheduleStructure'

export type DueAssessment = {
  id: string; title: string; copy: string; href: string; action: string
  illustration: 'check-in' | 'training' | 'schedule'
}

export function buildAssessmentHub({ client, today, now, monthly, strength, body }: {
  client: any; today: string; now: Date
  monthly: MemberAssessmentStatus
  strength: Awaited<ReturnType<typeof getStrengthAssessmentStatus>>
  body: { data: any[] | null; error?: unknown }
}) {
  const due: DueAssessment[] = [], unavailable: string[] = []
  if (monthly.unavailable) unavailable.push('Member assessment')
  else if (monthly.dueKind) due.push({
    id: 'member', title: monthly.dueKind === 'quarterly' ? 'Quarterly Assessment' : 'Monthly Review',
    copy: monthly.dueKind === 'quarterly' ? 'Refresh your training, goals, recovery and preferences.' : 'Review your saved choices. Edit only what has changed.',
    href: `/dashboard/assessment/start?assessmentType=${monthly.dueKind}`, action: monthly.dueKind === 'quarterly' ? 'Open assessment' : 'Review selections', illustration: 'check-in',
  })
  if (strength.unavailable) unavailable.push('Strength assessment')
  else if (strength.state === 'due' || strength.state === 'draft') due.push({
    id: 'strength', title: 'Strength Assessment', copy: 'Record your current capacity and compare your last completed results.',
    href: strength.href, action: strength.actionLabel, illustration: 'training',
  })
  const task = scheduleStructureMonthlyTask(today.slice(0, 7))
  if (!getScheduleStructureSubmission(client.onboarding_data, task)) due.push({
    id: 'structure', title: 'Daily Structure Review', copy: 'Review your daily anchors, training windows and rhythm.',
    href: scheduleStructureTaskHref(task)!, action: 'Review structure', illustration: 'schedule',
  })
  if (body.error || !Array.isArray(body.data)) unavailable.push('Body measurements')
  else {
    const completed = body.data.filter(row => row.status === 'completed' && Number.isFinite(Date.parse(row.completed_at)) && Date.parse(row.completed_at) <= now.getTime())
      .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))
    const schedule = getBodyAssessmentScheduleStatus({ today,
      latestMonthlyCompletedAt: completed.find(row => ['monthly', 'full'].includes(row.assessment_type))?.completed_at,
      latestStructuralCompletedAt: completed.find(row => ['structural', 'full'].includes(row.assessment_type))?.completed_at,
    })
    if (schedule.dueKind !== 'none') due.push({
      id: 'measurements', title: schedule.dueKind === 'full' ? 'Body & Structural Measurements' : schedule.structuralDue ? 'Structural Measurements' : 'Body Measurements',
      copy: schedule.dueKind === 'full' ? 'Both measurement schedules are due. Complete them together in one entry.' : 'Use your usual reference points for a consistent comparison.',
      href: schedule.href, action: 'Open measurements', illustration: 'training',
    })
  }
  return { due, unavailable }
}

export async function getAssessmentHub(supabase: any, client: any, now = new Date()) {
  if (!client?.client_id || !client?.auth_user_id) throw new Error('An authenticated member profile is required.')
  const bodyQuery = (types: string[]) => supabase.from('body_assessment_sessions').select('assessment_type,status,completed_at')
    .eq('client_id', client.client_id).eq('user_id', client.auth_user_id).eq('status', 'completed')
    .in('assessment_type', types).lte('completed_at', now.toISOString())
    .order('completed_at', { ascending: false }).limit(1).maybeSingle()
  const [monthly, strength, regional, structural] = await Promise.all([
    getMonthlyAssessmentStatus(supabase, client, now),
    getStrengthAssessmentStatus(supabase, client, now),
    bodyQuery(['monthly', 'full']), bodyQuery(['structural', 'full']),
  ])
  const body = { data: [regional.data, structural.data].filter(Boolean), error: regional.error || structural.error }
  return buildAssessmentHub({ client, today: getClientLocalDate(client, now), now, monthly, strength, body })
}
