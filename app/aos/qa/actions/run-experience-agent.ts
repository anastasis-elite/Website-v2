'use server'

import { MockPlatformAdapter } from '../adapters/mock-platform-adapter'
import { runAgent } from '../runners/agent-runner'

// Internal AOS QA tooling only. This action uses the mock adapter and must not expose secrets.
export async function runExperienceAgentAction(input?: { count?: number; seed?: string }) {
  return runAgent({
    mode: 'experience',
    count: input?.count,
    seed: input?.seed,
    adapter: new MockPlatformAdapter(),
  })
}
