import type {
  AdherenceHistory,
  AgeRange,
  Equipment,
  ExperienceLevel,
  HydrationLevel,
  MenstrualCycleContext,
  MuscleRecovery,
  SyntheticPersona,
  TrainingGoal,
} from './persona.types'
import { validatePersona } from './persona.schema'

type SeededRandom = {
  next(): number
  integer(min: number, max: number): number
  pick<T>(values: readonly T[]): T
}

const ageRanges: AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64']
const goals: TrainingGoal[] = ['strength', 'hypertrophy', 'fat-loss', 'mobility', 'return-to-training']
const experienceLevels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced']
const equipment: Equipment[] = ['dumbbells', 'barbell', 'cables', 'bands', 'machines', 'kettlebell']
const hydrationLevels: HydrationLevel[] = ['low', 'adequate', 'high']
const adherenceHistories: AdherenceHistory[] = ['low', 'moderate', 'high']
const menstrualCycleContexts: MenstrualCycleContext[] = [
  'not-applicable',
  'follicular',
  'ovulatory',
  'luteal',
  'menstrual',
  'unknown',
]

export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed)

  return {
    next() {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    },
    integer(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min
    },
    pick(values) {
      return values[this.integer(0, values.length - 1)]
    },
  }
}

export function generatePersonas(input: { count: number; seed: string }): SyntheticPersona[] {
  const random = createSeededRandom(input.seed)
  const personas: SyntheticPersona[] = []

  for (let index = 0; index < input.count; index += 1) {
    const persona = createPersona(index, random, input.seed)
    const errors = validatePersona(persona)

    if (errors.length > 0) {
      throw new Error(`Invalid generated persona ${persona.id}: ${errors.join(' ')}`)
    }

    personas.push(persona)
  }

  return personas
}

function createPersona(index: number, random: SeededRandom, seed: string): SyntheticPersona {
  const availableEquipment = createEquipment(random)
  const soreness = random.integer(0, 10)
  const stress = random.integer(0, 10)
  const sessionTime = random.pick([20, 30, 40, 45, 60, 75])
  const muscleRecovery: MuscleRecovery = {
    upper: random.integer(20, 100),
    lower: random.integer(20, 100),
    core: random.integer(20, 100),
  }

  return {
    id: `persona-${sanitizeSeed(seed)}-${String(index + 1).padStart(3, '0')}`,
    ageRange: random.pick(ageRanges),
    goals: createGoals(random),
    experienceLevel: random.pick(experienceLevels),
    scheduleConstraints: createScheduleConstraints(random, sessionTime),
    availableEquipment,
    injuriesOrLimitations: createLimitations(random),
    soreness,
    sleepHours: random.integer(45, 95) / 10,
    stress,
    menstrualCycleContext: random.pick(menstrualCycleContexts),
    workoutHistory: createWorkoutHistory(random),
    muscleRecovery,
    compensatoryMuscles: createCompensatoryMuscles(random),
    nutritionContext: createNutritionContext(random),
    hydration: random.pick(hydrationLevels),
    availableSessionTimeMinutes: sessionTime,
    adherenceHistory: random.pick(adherenceHistories),
  }
}

function createEquipment(random: SeededRandom): Equipment[] {
  const count = random.integer(0, 3)
  const selected = new Set<Equipment>(['bodyweight'])

  while (selected.size < count + 1) {
    selected.add(random.pick(equipment))
  }

  return Array.from(selected).sort()
}

function createGoals(random: SeededRandom): TrainingGoal[] {
  const first = random.pick(goals)
  const second = random.pick(goals)
  return first === second ? [first] : [first, second].sort()
}

function createScheduleConstraints(random: SeededRandom, sessionTime: number): string[] {
  const constraints = ['work schedule', 'family obligations', 'travel', 'limited training window']
  return [`${sessionTime}-minute session`, random.pick(constraints)]
}

function createLimitations(random: SeededRandom): string[] {
  const limitationOptions = ['knee sensitivity', 'shoulder limitation', 'low-back history', 'none reported']
  const limitation = random.pick(limitationOptions)
  return limitation === 'none reported' ? [] : [limitation]
}

function createWorkoutHistory(random: SeededRandom): string[] {
  return [`${random.integer(0, 4)} sessions in last 7 days`, `${random.integer(2, 14)} training age months`]
}

function createCompensatoryMuscles(random: SeededRandom): string[] {
  const options = ['hip flexors', 'upper traps', 'low back', 'calves', 'none flagged']
  const selected = random.pick(options)
  return selected === 'none flagged' ? [] : [selected]
}

function createNutritionContext(random: SeededRandom): string[] {
  const options = ['protein target missed', 'consistent meals', 'travel meals', 'low appetite', 'normal intake']
  return [random.pick(options)]
}

function hashSeed(seed: string): number {
  let hash = 2166136261

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function sanitizeSeed(seed: string): string {
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'seed'
}
