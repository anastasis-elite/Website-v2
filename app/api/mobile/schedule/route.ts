import { NextResponse } from 'next/server'
import { createMobileRequestContext } from '@/lib/mobile/auth'
import { getDailyScheduleState } from '@/lib/schedule/service'

export async function GET(request: Request) {
  try {
    const context = await createMobileRequestContext(request)

    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const url = new URL(request.url)
    const schedule = await getDailyScheduleState({
      supabase: context.supabase,
      user: context.user,
      client: context.client,
      date: url.searchParams.get('date') || undefined,
    })

    return NextResponse.json({ success: true, schedule })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mobile schedule could not be loaded.' },
      { status: 500 },
    )
  }
}
