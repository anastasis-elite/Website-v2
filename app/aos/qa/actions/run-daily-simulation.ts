'use server'

import { MockPlatformAdapter } from '../adapters/mock-platform-adapter'
import { runDailySimulation } from '../runners/daily-simulation-runner'

// Internal AOS QA tooling only. This action uses the mock adapter and must not expose secrets.
export async function runDailySimulationAction(input?: { count?: number; seed?: string }) {
  return runDailySimulation({
    count: input?.count,
    seed: input?.seed,
    adapter: new MockPlatformAdapter(),
  })
}
