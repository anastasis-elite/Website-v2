import { NextResponse } from 'next/server'
import { getTodayAccessContext, todayAccessError, todayAccessExpectation, TodayAccessError } from '@/lib/dashboard/todayAccess'
import { loadTodayBootstrap } from '@/lib/dashboard/todayBootstrap'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const expected = todayAccessExpectation(request)
    const context = await getTodayAccessContext(expected)
    const bootstrap = await loadTodayBootstrap(context)
    if (expected.date && bootstrap.date !== expected.date || expected.timezone && bootstrap.timezone !== expected.timezone) {
      throw new TodayAccessError('Your local day or timezone changed. Open Today again.', 409, `/dashboard/program/${context.program}`)
    }
    return NextResponse.json({ bootstrap }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return todayAccessError(error, 'Your check-in status could not be loaded. Try again.')
  }
}
