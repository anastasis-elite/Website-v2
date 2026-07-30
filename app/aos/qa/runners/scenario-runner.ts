import type { PersonaScenario } from '../personas/persona.types'
import type { ScenarioRunResult } from './runner.types'

export async function runScenarioSafely(
  personaScenario: PersonaScenario,
  run: (personaScenario: PersonaScenario) => Promise<void>,
): Promise<ScenarioRunResult> {
  try {
    await run(personaScenario)
    return { personaScenario, completed: true }
  } catch (error) {
    return {
      personaScenario,
      completed: false,
      error: error instanceof Error ? error.message : 'Unknown scenario runner error.',
    }
  }
}

export async function runWithConcurrency<T, Result>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = []
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1))

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await task(items[currentIndex])
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
