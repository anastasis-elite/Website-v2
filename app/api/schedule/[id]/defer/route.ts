import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { dashboardApiError } from '@/lib/dashboard/apiError'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { mutatePersistedScheduleEvent, ScheduleMutationError, refreshedScheduleAfterMutation } from '@/lib/schedule/mutations'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getDashboardContext(), { id } = await params
    const event = await mutatePersistedScheduleEvent(context, id, 'move', await request.json())
    invalidateDailyPlan()
    const schedule = await refreshedScheduleAfterMutation(context).catch(() => undefined)
    return NextResponse.json({ success: true, event, schedule })
  } catch (error) {
    if (error instanceof ScheduleMutationError) return NextResponse.json({ error: error.message }, { status: error.status })
    return dashboardApiError(error, 'Your schedule change could not be saved.')
  }
}
