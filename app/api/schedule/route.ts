import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { assertClientOwner, getDailyScheduleState } from '@/lib/schedule/service'
import { getClientTimeZone } from '@/lib/timezone'

const eventTypes = new Set(['workout','meal','hydration','recovery','check_in','assessment','work','school','appointment','medical','dental','personal','household','sleep','custom'])
const flexTypes = new Set(['fixed','flexible','approval_required'])
const priorities = new Set(['low','medium','high','critical'])

export async function GET(request: Request) {
  try {
    const { supabase, user, client } = await getDashboardContext()
    const url = new URL(request.url)
    const state = await getDailyScheduleState({
      supabase,
      user,
      client,
      date: url.searchParams.get('date') || undefined,
    })

    return NextResponse.json({ success: true, schedule: state })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Schedule could not be loaded.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, client } = await getDashboardContext()
    const body = await request.json()
    const clientId = body.client_id || client.client_id

    if (!(await assertClientOwner({ supabase, userId: user.id, clientId }))) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    if (!body.title || !body.start_at || !body.end_at) {
      return NextResponse.json({ error: 'Title, start, and end are required.' }, { status: 400 })
    }

    const eventType = eventTypes.has(body.event_type) ? body.event_type : 'custom'
    const flexibility = flexTypes.has(body.flexibility_type) ? body.flexibility_type : 'flexible'
    const fixed = flexibility === 'fixed'
    const approvalRequired = fixed || flexibility === 'approval_required' || Boolean(body.approval_required)

    const row = {
      user_id: user.id,
      client_id: clientId,
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : null,
      event_type: eventType,
      source: 'manual',
      start_at: new Date(body.start_at).toISOString(),
      end_at: new Date(body.end_at).toISOString(),
      timezone: body.timezone || getClientTimeZone(client),
      all_day: Boolean(body.all_day),
      flexibility_type: flexibility,
      priority: priorities.has(body.priority) ? body.priority : 'medium',
      required: Boolean(body.required || fixed),
      movable: fixed ? false : body.movable !== false,
      approval_required: approvalRequired,
      earliest_start_at: body.earliest_start_at ? new Date(body.earliest_start_at).toISOString() : null,
      latest_end_at: body.latest_end_at ? new Date(body.latest_end_at).toISOString() : null,
      preferred_time: body.preferred_time || null,
      estimated_duration_minutes: body.estimated_duration_minutes ? Number(body.estimated_duration_minutes) : null,
      external_provider_name: body.external_provider_name || null,
      external_contact_type: body.external_contact_type || null,
      external_contact_value: body.external_contact_value || null,
      external_event_id: body.external_event_id || null,
      external_calendar_source: body.external_calendar_source || null,
      reschedule_allowed: Boolean(body.reschedule_allowed),
      reschedule_requires_approval: body.reschedule_requires_approval !== false,
      delegation_status: body.delegation_status || null,
      delegation_notes: body.delegation_notes || null,
    }

    const { data, error } = await supabase
      .from('anastasis_schedule_events')
      .insert(row)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Schedule event could not be saved.' },
      { status: 500 },
    )
  }
}
