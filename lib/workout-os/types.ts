import type { SorenessRegionKey } from '@/lib/recovery/sorenessRegions'
export type { SorenessRegionKey } from '@/lib/recovery/sorenessRegions'
import type {
  CapacityStatus,
  FuelStatus,
  RecoveryStatus,
  WorkoutAdjustmentLevel,
} from '@/lib/dashboard/logic/types'

export type GoalObjective =
  | 'fat_loss'
  | 'muscle_gain'
  | 'strength'
  | 'athletic_performance'
  | 'glute_growth'
  | 'upper_body_development'
  | 'recomposition'
  | 'endurance'
  | 'postpartum_rebuilding'
  | 'general_capacity'

export type StructuralFilter = {
  modifier: number
  internalSignals: string[]
  movementEmphasis: string[]
  avoidTags: string[]
  preferredTags: string[]
  generatedAt: string
}

export type CapacityDose = {
  level: 'high' | 'medium' | 'low' | 'very_low'
  sets: number
  reps: number
  rpe: string
  restSeconds: number
  timeMinutes: number
  keepAccessories: boolean
  keepFinisher: boolean
}

export type WorkoutOSContext = {
  capacityStatus: CapacityStatus
  recoveryStatus: RecoveryStatus
  fuelStatus: FuelStatus
  hydrationPercent: number
  soreness: number | null
  symptomSeverity: 'none' | 'mild' | 'moderate' | 'severe'
  timeAvailable: number
  goal: GoalObjective
  structural: StructuralFilter
  redFlag: boolean
  proteinConsistent: boolean
  microsConsistent: boolean
  performanceStable: boolean
}

export type WorkoutOSPrescription = {
  displayWorkout: true
  canTrain: boolean
  adjustmentLevel: WorkoutAdjustmentLevel
  dose: CapacityDose
  structuralModifier: number
  goal: GoalObjective
  clientCues: string[]
  internalRationale: string[]
  allowLoadProgression: boolean
  allowEnduranceProgression: boolean
}

export type CanonicalMuscle =
  | 'neck'
  | 'upper_traps'
  | 'shoulders'
  | 'chest'
  | 'upper_back'
  | 'lats'
  | 'rhomboids'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'lower_back'
  | 'core'
  | 'glutes'
  | 'hip_flexors'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves'
  | 'feet_ankles'

export type MuscleContributionMap = Partial<
  Record<CanonicalMuscle, number>
>

export type HistoricalRecoverySignal = {
  date: string
  checkInCompleted: boolean
  sleepHours: number | null
  stress: number | null
  energy: number | null
  soreness: number | null
  sorenessRegions: SorenessRegionKey[]
}

export type CapacityHistoryTrigger =
  | 'three_days_low_sleep'
  | 'three_days_high_stress'
  | 'three_days_low_energy'

export type WorkoutDayMode =
  | 'standard'
  | 'low_capacity'
  | 'low_fuel'
  | 'recovery_only'
  | 'starter'

export type CapacityHistoryResult = {
  level: 'standard' | 'low'
  workoutDayMode: Extract<
    WorkoutDayMode,
    'standard' | 'low_capacity'
  >
  exerciseTarget: 12 | 3
  recoveryTarget: 1 | 3
  triggers: CapacityHistoryTrigger[]
  completeDays: number
  historyComplete: boolean
}

export type RecoveryActionDuration =
  | {
      minutes: number
      minimumMinutes?: never
      maximumMinutes?: never
    }
  | {
      minutes?: never
      minimumMinutes: number
      maximumMinutes: number
    }

export type RecoveryAction = {
  id: string
  label: string
  duration: RecoveryActionDuration
}

export type CompensationProfile = {
  muscleLoadModifiers: MuscleContributionMap
  stimulusModifiers: MuscleContributionMap
  avoidTags: string[]
  preferredTags: string[]
  patternFlags: string[]
}

export type MuscleLoadResult = {
  intendedLoad: MuscleContributionMap
  compensatoryLoad: MuscleContributionMap
  effectiveStimulus: MuscleContributionMap
}

export type MuscleAvailabilityStatus =
  | 'available'
  | 'limited'
  | 'excluded'

export type MuscleAvailabilityEntry = {
  muscle: CanonicalMuscle
  status: MuscleAvailabilityStatus
  reasons: string[]
}

export type WorkoutExercise = {
  id?: string | number

  exercise?: string
  name?: string
  display_name?: string

  exercise_category?: string
  movement_type?: string
  category?: string
  type?: string

  sets?: number | string
  reps?: number | string
  target_reps?: number | string
  recommended_reps?: number | string
  baseline_reps?: number | string

  recommended_weight?: number | string
  baseline_weight?: number | string
  calculated_weight?: number | string

  selected_variant_id?: string
  selected_variant_name?: string
  selected_equipment?: string
  equipment?: string
  load_type?: string

  available_variants?: Array<{
    id: string
    name: string
    equipment: string
    load_type: string
    equipment_modifier: number
  }>

  duration_label?: string
  client_cues?: string[]
  rest_seconds?: number
  rpe_target?: string

  primary_muscles?: CanonicalMuscle[]
  secondary_muscles?: CanonicalMuscle[]
  intended_muscles?: CanonicalMuscle[]
  compensatory_muscles?: CanonicalMuscle[]

  tags?: string[]
  avoid_tags?: string[]
  preferred_tags?: string[]

  [key: string]: unknown
}

export type WorkoutModeDecisionInput = {
  capacityHistory: CapacityHistoryResult
  capacityStatus: CapacityStatus
  recoveryStatus: RecoveryStatus
  fuelStatus: FuelStatus
  redFlag: boolean
  hasPlannedWorkout: boolean
  hasStrengthExercises: boolean
}

export type WorkoutModeDecision = {
  mode: WorkoutDayMode
  reason: string
  adjustmentLevel: WorkoutAdjustmentLevel
}

export type WorkoutEngineInput = {
  date: string

  capacityHistory: CapacityHistoryResult
  recoverySignals: HistoricalRecoverySignal[]

  recoveryStatus: RecoveryStatus
  fuelStatus: FuelStatus
  redFlag: boolean

  plannedWorkout: Record<string, unknown> | null
  plannedExercises: WorkoutExercise[]

  sorenessExclusions: SorenessRegionKey[]
  compensationProfile?: CompensationProfile

  availableEquipment?: string[]
  structural?: StructuralFilter
  goal?: GoalObjective

  hydrationPercent?: number
  proteinConsistent?: boolean
  microsConsistent?: boolean
  performanceStable?: boolean
}

export type WorkoutEngineOutput = {
  mode: WorkoutDayMode
  title: string

  exercises: WorkoutExercise[]
  recoveryActions: RecoveryAction[]

  displayWorkout: boolean
  canTrain: boolean
  completionEligible: boolean

  adjustmentLevel: WorkoutAdjustmentLevel
  reason: string

  excludedMuscles: MuscleAvailabilityEntry[]
  capacityTriggers: CapacityHistoryTrigger[]
  rationale: string[]

  allowLoadProgression: boolean
  allowEnduranceProgression: boolean
}
