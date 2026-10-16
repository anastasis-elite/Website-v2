import { NextResponse } from 'next/server'
import { createMobileRequestContext } from '@/lib/mobile/auth'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { mutatePersistedScheduleEvent, ScheduleMutationError } from '@/lib/schedule/mutations'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await createMobileRequestContext(request)
    if ('error' in context) return NextResponse.json({ error: context.error }, { status: context.status })
    const { id } = await params
    const event = await mutatePersistedScheduleEvent(context, id, 'complete', await request.json().catch(() => ({})))
    invalidateDailyPlan()
    return NextResponse.json({ success: true, event })
  } catch (error) {
    return NextResponse.json({ error: error instanceof ScheduleMutationError ? error.message : 'Event could not be completed.' }, { status: error instanceof ScheduleMutationError ? error.status : 500 })
  }
}
