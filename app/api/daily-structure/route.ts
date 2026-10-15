import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'
import { getScheduleStructureMonth, getScheduleStructureSubmission, getScheduleStructureVersion, scheduleStructureMonthlyTask, scheduleStructureTaskKey, SCHEDULE_STRUCTURE_VERSION } from '@/lib/assessment/scheduleStructure'
import { validateScheduleStructure } from '@/lib/assessment/validateScheduleStructure'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClientLocalDate } from '@/lib/timezone'

function record(value: unknown): Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Enter a valid assessment submission.' }, { status: 400 })
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (typeof body.client_id !== 'string' || !body.client_id || body.action !== 'submit') {
      return NextResponse.json({ error: 'Use Submit assessment after completing the required questions.' }, { status: 400 })
    }
    if (body.assessmentVersion !== SCHEDULE_STRUCTURE_VERSION) {
      return NextResponse.json({ error: 'This assessment has changed. Refresh the page and submit the current version.' }, { status: 409 })
    }
    const validation = validateScheduleStructure(body)
    if ('error' in validation) return NextResponse.json({ error: validation.error }, { status: 400 })
    const { answers } = validation
    if (body.eventId !== undefined && (typeof body.eventId !== 'string' || !body.eventId || body.eventId.length > 200)) {
      return NextResponse.json({ error: 'The scheduled assessment could not be identified. Reopen it from Schedule.' }, { status: 400 })
    }
    const { data: client, error: clientError } = await supabase.from('clients').select('client_id, timezone, onboarding_data, daily_structure_reviewed_at')
      .eq('client_id', body.client_id).eq('auth_user_id', user.id).maybeSingle()
    if (clientError) return NextResponse.json({ error: 'Your assessment could not be loaded. Try again.' }, { status: 500 })
    if (!client) return NextResponse.json({ error: 'Client not found for this user.' }, { status: 404 })

    const currentMonth = getClientLocalDate(client).slice(0, 7)
    const requestedMonth = body.eventId ? getScheduleStructureMonth(body.eventId) : currentMonth
    let event: any
    if (requestedMonth) {
      event = scheduleStructureMonthlyTask(requestedMonth)
      // A stale screen can acknowledge an already saved monthly submission,
      // but cannot create a past or future review under another month's key.
      if (requestedMonth !== currentMonth && (requestedMonth > currentMonth || !getScheduleStructureSubmission(client.onboarding_data, event))) {
        return NextResponse.json({ error: 'This monthly assessment has changed. Reopen it from Schedule.' }, { status: 409 })
      }
    } else if (body.eventId) {
      if (body.eventId.startsWith('schedule-structure:')) return NextResponse.json({ error: 'Scheduled assessment not found.' }, { status: 404 })
      const { data, error } = await supabase.from('anastasis_schedule_events').select('*')
        .eq('id', body.eventId).eq('user_id', user.id).eq('client_id', client.client_id).maybeSingle()
      if (error) return NextResponse.json({ error: 'Your scheduled assessment could not be loaded. Try again.' }, { status: 500 })
      const existingSubmission = data ? getScheduleStructureSubmission(client.onboarding_data, data) : null
      const taskVersion = data ? getScheduleStructureVersion(data) ?? existingSubmission?.assessmentVersion : null
      if (!data || taskVersion == null) return NextResponse.json({ error: 'Scheduled assessment not found.' }, { status: 404 })
      if (taskVersion !== body.assessmentVersion || (!existingSubmission && ['skipped', 'cancelled'].includes(data.status))) {
        return NextResponse.json({ error: 'This scheduled assessment has changed. Reopen it from Schedule.' }, { status: 409 })
      }
      event = data
    }

    const version = String(SCHEDULE_STRUCTURE_VERSION)
    const taskKey = scheduleStructureTaskKey(event)
    const now = new Date().toISOString()
    // Answers and completion evidence share one owner-scoped compare-and-swap.
    // Schedule derives status from this proof, so a failed/partial second write
    // can never leave a completed task without its persisted assessment.
    const result = await updateOwnedOnboardingData({
      supabase, userId: user.id, clientId: client.client_id,
      merge: current => {
        const assessments = record(current.scheduleStructureAssessments)
        const submissions = record(assessments[version])
        const previous = getScheduleStructureSubmission(current, event)
        // A completed task/version is immutable. A delayed retry from an older
        // screen must not overwrite a newer assessment or profile preference.
        if (previous) return current
        const submission = { assessmentVersion: SCHEDULE_STRUCTURE_VERSION, eventId: event.id, submittedAt: now, answers }
        return { ...current, scheduleStructureAssessments: { ...assessments, [version]: { ...submissions, [taskKey]: submission } } }
      },
      fields: (current, next) => {
        if (getScheduleStructureSubmission(current, event)) return {}
        // Retrying an older task must not roll a newer monthly review backward.
        const reviewedAt = Object.values(record(next.scheduleStructureAssessments)).flatMap(group => Object.values(record(group)))
          .filter(submission => typeof submission?.submittedAt === 'string' && Number.isFinite(Date.parse(submission.submittedAt)) &&
            !('error' in validateScheduleStructure(submission.answers)))
          .reduce((latest, submission) => Date.parse(submission.submittedAt) > Date.parse(latest) ? submission.submittedAt : latest,
            next.scheduleStructureAssessments[version][taskKey].submittedAt)
        return { ...answers, daily_structure_reviewed_at: reviewedAt }
      },
    })
    if (!result.saved) return NextResponse.json({ error: 'Your assessment could not be saved. Refresh and try again.' }, { status: result.status })
    invalidateDailyPlan()
    return NextResponse.json({ success: true, submission: getScheduleStructureSubmission(result.onboardingData, event) })
  } catch {
    return NextResponse.json({ error: 'Your assessment could not be saved. Check your connection and try again.' }, { status: 500 })
  }
}
