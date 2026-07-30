export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type Equipment =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'cables'
  | 'bands'
  | 'machines'
  | 'kettlebell'
export type TrainingGoal = 'strength' | 'hypertrophy' | 'fat-loss' | 'mobility' | 'return-to-training'
export type TrainingDayType = 'standard' | 'recovery'
export type HydrationLevel = 'low' | 'adequate' | 'high'
export type AdherenceHistory = 'low' | 'moderate' | 'high'
export type MenstrualCycleContext = 'not-applicable' | 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | 'unknown'

export type MuscleRecovery = {
  upper: number
  lower: number
  core: number
}

export type SyntheticPersona = {
  id: string
  ageRange: AgeRange
  goals: TrainingGoal[]
  experienceLevel: ExperienceLevel
  scheduleConstraints: string[]
  availableEquipment: Equipment[]
  injuriesOrLimitations: string[]
  soreness: number
  sleepHours: number
  stress: number
  menstrualCycleContext: MenstrualCycleContext
  workoutHistory: string[]
  muscleRecovery: MuscleRecovery
  compensatoryMuscles: string[]
  nutritionContext: string[]
  hydration: HydrationLevel
  availableSessionTimeMinutes: number
  adherenceHistory: AdherenceHistory
}

export type SyntheticScenario = {
  id: string
  personaId: string
  trainingDayType: TrainingDayType
  requestedAction: 'generate-workout' | 'complete-check-in' | 'adjust-session'
  targetMuscleGroups: Array<keyof MuscleRecovery>
  expectedPrimaryOutcome: string
}

export type PersonaScenario = {
  persona: SyntheticPersona
  scenario: SyntheticScenario
}
