import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { dashboardApiError } from '@/lib/dashboard/apiError'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { canRespondToScheduleEvent } from '@/lib/schedule/actions'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { saveScheduleCheckoff, ScheduleCheckoffConflict, validScheduleDate, validScheduleResponseStatus } from '@/lib/schedule/checkoffs'

export async function POST(request: Request) {
  try {
    const { supabase, user, client } = await getDashboardContext()
    const body = await request.json().catch(() => null)
    if (!body || !validScheduleDate(body.date) || typeof body.timezone !== 'string' ||
      typeof body.eventId !== 'string' || !body.eventId || body.eventId.length > 1024 ||
      (body.status === undefined ? typeof body.completed !== 'boolean' : !validScheduleResponseStatus(body.status)) ||
      (body.completed !== undefined && (typeof body.completed !== 'boolean' || body.status !== undefined && body.completed !== (body.status === 'completed'))) ||
      !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= 2147483647 ||
      typeof body.operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.operationId)) {
      return NextResponse.json({ error: 'Choose a valid schedule item and date.' }, { status: 400 })
    }
    // Always re-resolve the supplied occurrence in the authenticated member's
    // schedule. The explicit local date prevents an old tab completing tomorrow.
    const state = await getDailyScheduleState({ supabase, user, client, date: body.date })
    if (body.timezone !== state.timezone) return NextResponse.json({ error: 'Your timezone changed. Refresh Schedule before saving.' }, { status: 409 })
    const event = state.events.find(item => item.id === body.eventId)
    if (!event) return NextResponse.json({ error: 'This occurrence was not found for the selected day.' }, { status: 404 })
    if (!canRespondToScheduleEvent(event)) return NextResponse.json({
      error: 'Open this activity and save what you did to complete it.', href: getActionRouteForEvent(event, client.program),
    }, { status: 409 })
    const status = body.status ?? (body.completed ? 'completed' : 'scheduled')
    if (['cancelled', 'skipped'].includes(event.status) || status !== 'completed' &&
      event.status === 'completed' && (!event.checkoff?.revision || event.checkoff.authoritative)) {
      return NextResponse.json({ error: 'Review this activity’s saved outcome.' }, { status: 409 })
    }
    if (state.unavailableSources?.includes('checkoffs')) return NextResponse.json({ error: 'Saved check-offs are unavailable. Try again shortly.' }, { status: 503 })
    const checkoff = await saveScheduleCheckoff({ supabase, userId: user.id, clientId: client.client_id,
      date: state.date, eventId: event.id, status,
      ...(event.schedule_response_kind === 'breakfast' ? { occurrenceSnapshot: {
        id: event.id, title: event.title, start_at: event.adjusted_start_at || event.start_at,
        end_at: event.adjusted_end_at || event.end_at,
        timezone: event.timezone, schedule_date: state.date, schedule_response_kind: event.schedule_response_kind,
      } } : {}),
      expectedRevision: body.expectedRevision, operationId: body.operationId })
    invalidateDailyPlan()
    return NextResponse.json({ success: true, checkoff })
  } catch (error) {
    if (error instanceof ScheduleCheckoffConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    return dashboardApiError(error, 'Your check-off could not be saved.')
  }
}
