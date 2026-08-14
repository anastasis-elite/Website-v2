import { NextResponse } from 'next/server'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { createMobileRequestContext } from '@/lib/mobile/auth'
import { buildMobileDailyState } from '@/lib/mobile/dailyState'

export async function GET(request: Request) {
  try {
    const context = await createMobileRequestContext(request)

    if ('error' in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      )
    }

    const logic = await getProgramLogicForClient(context)
    const dailyState = buildMobileDailyState(logic)

    return NextResponse.json({
      ...dailyState,
      user: {
        ...dailyState.user,
        id: context.user.id,
        clientId: context.client.client_id,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Mobile daily state could not be loaded.',
      },
      { status: 500 },
    )
  }
}
