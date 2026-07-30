import type { PlatformAdapter } from '../adapters/adapter.types'
import type { PersonaScenario } from '../personas/persona.types'
import type { QaReport } from '../reports/report.types'

export type AgentRunnerMode = 'functional' | 'logic' | 'experience' | 'all'

export type AgentRunnerInput = {
  mode: AgentRunnerMode
  count?: number
  seed?: string
  adapter: PlatformAdapter
}

export type DailySimulationInput = {
  count?: number
  seed?: string
  adapter: PlatformAdapter
  concurrency?: number
}

export type ScenarioRunResult = {
  personaScenario: PersonaScenario
  completed: boolean
  error?: string
}

export type DailySimulationResult = {
  report: QaReport
}
