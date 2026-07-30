import type { PersonaScenario, SyntheticPersona, SyntheticScenario } from './persona.types'
import { validateScenario } from './persona.schema'

export function generateScenarios(personas: SyntheticPersona[]): PersonaScenario[] {
  return personas.map((persona, index) => {
    const scenario = createScenario(persona, index)
    const errors = validateScenario(scenario, persona)

    if (errors.length > 0) {
      throw new Error(`Invalid generated scenario ${scenario.id}: ${errors.join(' ')}`)
    }

    return { persona, scenario }
  })
}

function createScenario(persona: SyntheticPersona, index: number): SyntheticScenario {
  const needsRecovery = persona.soreness > 7 || persona.availableSessionTimeMinutes < 25
  const trainingDayType = needsRecovery ? 'recovery' : 'standard'
  const targetMuscleGroups = chooseTargets(persona, index)

  return {
    id: `scenario-${persona.id.replace('persona-', '')}`,
    personaId: persona.id,
    trainingDayType,
    requestedAction:
      index % 5 === 0 ? 'complete-check-in' : index % 3 === 0 ? 'adjust-session' : 'generate-workout',
    targetMuscleGroups,
    expectedPrimaryOutcome:
      trainingDayType === 'recovery'
        ? 'Return a recovery-forward session with a next step.'
        : 'Return a training session that follows Constitution workout expectations.',
  }
}

function chooseTargets(persona: SyntheticPersona, index: number): SyntheticScenario['targetMuscleGroups'] {
  const ordered = Object.entries(persona.muscleRecovery)
    .sort((left, right) => left[1] - right[1])
    .map(([group]) => group as keyof SyntheticPersona['muscleRecovery'])

  return index % 2 === 0 ? [ordered[0]] : [ordered[0], ordered[1]]
}
