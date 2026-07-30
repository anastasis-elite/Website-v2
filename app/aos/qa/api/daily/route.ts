import { NextResponse } from 'next/server'
import { MockPlatformAdapter } from '../../adapters/mock-platform-adapter'
import { runDailySimulation } from '../../runners/daily-simulation-runner'

export const dynamic = 'force-dynamic'

// Internal AOS QA tooling only. External scheduling must be configured outside this boundary later.
export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request)
    const count = typeof body.count === 'number' ? body.count : undefined
    const seed = typeof body.seed === 'string' && body.seed.trim() ? body.seed.trim() : undefined
    const result = await runDailySimulation({
      count,
      seed,
      adapter: new MockPlatformAdapter(),
    })

    return NextResponse.json({ ok: true, report: result.report })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown daily simulation error.',
      },
      { status: 400 },
    )
  }
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => ({}))
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
