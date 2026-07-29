import type { SorenessRegionKey } from '@/lib/recovery/sorenessRegions'
import type { CapacityStatus,FuelStatus,RecoveryStatus,WorkoutAdjustmentLevel } from '@/lib/dashboard/logic/types'

export type GoalObjective='fat_loss'|'muscle_gain'|'strength'|'athletic_performance'|'glute_growth'|'upper_body_development'|'recomposition'|'endurance'|'postpartum_rebuilding'|'general_capacity'
export type StructuralFilter={modifier:number;internalSignals:string[];movementEmphasis:string[];avoidTags:string[];preferredTags:string[];generatedAt:string}
export type CapacityDose={level:'high'|'medium'|'low'|'very_low';sets:number;reps:number;rpe:string;restSeconds:number;timeMinutes:number;keepAccessories:boolean;keepFinisher:boolean}
export type WorkoutOSContext={capacityStatus:CapacityStatus;recoveryStatus:RecoveryStatus;fuelStatus:FuelStatus;hydrationPercent:number;soreness:number|null;symptomSeverity:'none'|'mild'|'moderate'|'severe';timeAvailable:number;goal:GoalObjective;structural:StructuralFilter;redFlag:boolean;proteinConsistent:boolean;microsConsistent:boolean;performanceStable:boolean}
export type WorkoutOSPrescription={displayWorkout:true;canTrain:boolean;adjustmentLevel:WorkoutAdjustmentLevel;dose:CapacityDose;structuralModifier:number;goal:GoalObjective;clientCues:string[];internalRationale:string[];allowLoadProgression:boolean;allowEnduranceProgression:boolean}

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

export type MuscleContributionMap = Partial<Record<CanonicalMuscle, number>>

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

export type WorkoutDayMode = 'standard' | 'low_capacity' | 'recovery_only'

export type CapacityHistoryResult = {
  level: 'standard' | 'low'
  workoutDayMode: Extract<WorkoutDayMode, 'standard' | 'low_capacity'>
  exerciseTarget: 12 | 3
  recoveryTarget: 1 | 3
  triggers: CapacityHistoryTrigger[]
  completeDays: number
  historyComplete: boolean
}

export type RecoveryActionDuration =
  | { minutes: number; minimumMinutes?: never; maximumMinutes?: never }
  | { minutes?: never; minimumMinutes: number; maximumMinutes: number }

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

export type MuscleAvailabilityStatus = 'available' | 'limited' | 'excluded'

export type MuscleAvailabilityEntry = {
  muscle: CanonicalMuscle
  status: MuscleAvailabilityStatus
  reasons: string[]
}

export type WorkoutEngineInput = {
  date: string
  capacityHistory: CapacityHistoryResult
  recoverySignals: HistoricalRecoverySignal[]
  sorenessExclusions: SorenessRegionKey[]
  compensationProfile?: CompensationProfile
}

export type WorkoutEngineOutput = {
  exercises: unknown[]
  recoveryActions: RecoveryAction[]
  excludedMuscles: MuscleAvailabilityEntry[]
  capacityTriggers: CapacityHistoryTrigger[]
  rationale: string[]
}
