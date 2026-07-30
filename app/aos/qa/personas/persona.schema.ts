import type { Equipment, SyntheticPersona, SyntheticScenario } from './persona.types'

export function validatePersona(persona: SyntheticPersona): string[] {
  const errors: string[] = []

  if (!persona.id) errors.push('Persona id is required.')
  if (persona.goals.length === 0) errors.push(`${persona.id} must have at least one goal.`)
  if (persona.availableEquipment.length === 0) errors.push(`${persona.id} must have at least one equipment option.`)
  if (!persona.availableEquipment.includes('bodyweight')) {
    errors.push(`${persona.id} must include bodyweight as the baseline equipment option.`)
  }
  if (!unique(persona.availableEquipment)) errors.push(`${persona.id} has duplicate equipment.`)
  if (persona.soreness < 0 || persona.soreness > 10) errors.push(`${persona.id} soreness must be 0-10.`)
  if (persona.sleepHours < 0 || persona.sleepHours > 14) errors.push(`${persona.id} sleep must be 0-14 hours.`)
  if (persona.stress < 0 || persona.stress > 10) errors.push(`${persona.id} stress must be 0-10.`)
  if (persona.availableSessionTimeMinutes < 10) {
    errors.push(`${persona.id} available session time must be at least 10 minutes.`)
  }

  return errors
}

export function validateScenario(scenario: SyntheticScenario, persona: SyntheticPersona): string[] {
  const errors: string[] = []

  if (!scenario.id) errors.push('Scenario id is required.')
  if (scenario.personaId !== persona.id) {
    errors.push(`${scenario.id} personaId does not match ${persona.id}.`)
  }
  if (scenario.targetMuscleGroups.length === 0) {
    errors.push(`${scenario.id} must target at least one muscle recovery group.`)
  }
  if (scenario.trainingDayType === 'standard' && persona.availableSessionTimeMinutes < 25) {
    errors.push(`${scenario.id} standard training day requires at least 25 minutes.`)
  }

  return errors
}

export function hasValidEquipmentConfiguration(equipment: Equipment[]): boolean {
  return equipment.length > 0 && equipment.includes('bodyweight') && unique(equipment)
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}
