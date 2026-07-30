import type { PersonaScenario } from '../persona.types'

export const examplePersonaScenarios: PersonaScenario[] = [
  {
    persona: {
      id: 'persona-example-high-soreness',
      ageRange: '35-44',
      goals: ['strength', 'return-to-training'],
      experienceLevel: 'intermediate',
      scheduleConstraints: ['45-minute session', 'work schedule'],
      availableEquipment: ['bodyweight', 'dumbbells', 'bands'],
      injuriesOrLimitations: ['low-back history'],
      soreness: 8,
      sleepHours: 5.8,
      stress: 7,
      menstrualCycleContext: 'unknown',
      workoutHistory: ['3 sessions in last 7 days', '18 training age months'],
      muscleRecovery: { upper: 72, lower: 38, core: 61 },
      compensatoryMuscles: ['hip flexors'],
      nutritionContext: ['protein target missed'],
      hydration: 'low',
      availableSessionTimeMinutes: 45,
      adherenceHistory: 'moderate',
    },
    scenario: {
      id: 'scenario-example-high-soreness',
      personaId: 'persona-example-high-soreness',
      trainingDayType: 'standard',
      requestedAction: 'generate-workout',
      targetMuscleGroups: ['lower'],
      expectedPrimaryOutcome: 'High soreness should trigger additional assessment before normal training guidance.',
    },
  },
]
