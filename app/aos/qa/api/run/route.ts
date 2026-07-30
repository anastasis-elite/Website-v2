import { NextResponse } from 'next/server'
import { MockPlatformAdapter } from '../../adapters/mock-platform-adapter'
import { runAgent } from '../../runners/agent-runner'
import type { AgentRunnerMode } from '../../runners/runner.types'

export const dynamic = 'force-dynamic'

// Internal AOS QA tooling only. This endpoint runs against the mock adapter by default.
export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request)
    const mode = parseMode(body.mode)
    const count = parseOptionalNumber(body.count)
    const seed = parseOptionalString(body.seed)
    const report = await runAgent({
      mode,
      count,
      seed,
      adapter: new MockPlatformAdapter(),
    })

    return NextResponse.json({ ok: true, report })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown QA run error.',
      },
      { status: 400 },
    )
  }
}

function parseMode(value: unknown): AgentRunnerMode {
  if (value === 'functional' || value === 'logic' || value === 'experience' || value === 'all') return value
  return 'all'
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => ({}))
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function parseOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
