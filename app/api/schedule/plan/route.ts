import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { dashboardApiError } from '@/lib/dashboard/apiError'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { mutateVirtualScheduleEvent, ScheduleMutationError, refreshedScheduleAfterMutation } from '@/lib/schedule/mutations'

export async function POST(request: Request) {
  try {
    const context = await getDashboardContext()
    const event = await mutateVirtualScheduleEvent(context, await request.json())
    invalidateDailyPlan()
    const schedule = await refreshedScheduleAfterMutation(context).catch(() => undefined)
    return NextResponse.json({ success: true, event, schedule })
  } catch (error) {
    if (error instanceof ScheduleMutationError) return NextResponse.json({ error: error.message }, { status: error.status })
    return dashboardApiError(error, 'Your schedule change could not be saved.')
  }
}
