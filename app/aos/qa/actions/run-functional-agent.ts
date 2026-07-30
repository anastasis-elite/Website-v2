'use server'

import { MockPlatformAdapter } from '../adapters/mock-platform-adapter'
import { runAgent } from '../runners/agent-runner'

// Internal AOS QA tooling only. This action uses the mock adapter and must not expose secrets.
export async function runFunctionalAgentAction(input?: { count?: number; seed?: string }) {
  return runAgent({
    mode: 'functional',
    count: input?.count,
    seed: input?.seed,
    adapter: new MockPlatformAdapter(),
  })
}
