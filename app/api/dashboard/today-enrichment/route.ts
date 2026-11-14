import { NextResponse } from 'next/server'
import { getTodayAccessContext, todayAccessError } from '@/lib/dashboard/todayAccess'
import { loadTodayEnrichment } from '@/lib/dashboard/loadTodayEnrichment'
import { DashboardLocalDayChangedError } from '@/lib/dashboard/logic/loadProgramLogicInputs'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const expected = {
      ownerUserId: query.get('ownerUserId'), clientId: query.get('clientId'), program: query.get('program'),
      date: query.get('date'), timezone: query.get('timezone'),
    }
    if (!expected.ownerUserId || !expected.clientId || !expected.program || !expected.date || !expected.timezone) {
      return NextResponse.json({ error: 'Refresh Today before loading your current guidance.' }, { status: 400, headers })
    }
    const context = await getTodayAccessContext({ program: expected.program })
    if (expected.ownerUserId !== context.user.id || expected.clientId !== context.client.client_id) {
      return NextResponse.json({ error: 'Your account changed. Refresh Today to continue.', redirect: '/dashboard' }, { status: 409, headers })
    }
    if (expected.date !== getClientLocalDate(context.client) || expected.timezone !== getClientTimeZone(context.client)) {
      return NextResponse.json({ error: 'Your local day changed. Refresh Today for current guidance.' }, { status: 409, headers })
    }
    const enrichment = await loadTodayEnrichment({ ...context, includePhotoPreviews: false })
    // This endpoint does not retry into a different member-local day. The client
    // must first obtain a new bootstrap so completion and recommendations agree.
    if (enrichment.date !== expected.date || enrichment.timezone !== expected.timezone) throw new DashboardLocalDayChangedError()
    return NextResponse.json(enrichment, { headers })
  } catch (error) {
    if (error instanceof DashboardLocalDayChangedError) {
      return NextResponse.json({ error: 'A new day has started. Refresh Today for current guidance.' }, { status: 409, headers })
    }
    return todayAccessError(error, 'Your current guidance could not be loaded. Please retry.')
  }
}
