import type { CapacityStatus,FuelStatus,RecoveryStatus,WorkoutAdjustmentLevel } from '@/lib/dashboard/logic/types'

export type GoalObjective='fat_loss'|'muscle_gain'|'strength'|'athletic_performance'|'glute_growth'|'upper_body_development'|'recomposition'|'endurance'|'postpartum_rebuilding'|'general_capacity'
export type StructuralFilter={modifier:number;internalSignals:string[];movementEmphasis:string[];avoidTags:string[];preferredTags:string[];generatedAt:string}
export type CapacityDose={level:'high'|'medium'|'low'|'very_low';sets:number;reps:number;rpe:string;restSeconds:number;timeMinutes:number;keepAccessories:boolean;keepFinisher:boolean}
export type WorkoutOSContext={capacityStatus:CapacityStatus;recoveryStatus:RecoveryStatus;fuelStatus:FuelStatus;hydrationPercent:number;soreness:number|null;symptomSeverity:'none'|'mild'|'moderate'|'severe';timeAvailable:number;goal:GoalObjective;structural:StructuralFilter;redFlag:boolean;proteinConsistent:boolean;microsConsistent:boolean;performanceStable:boolean}
export type WorkoutOSPrescription={displayWorkout:true;canTrain:boolean;adjustmentLevel:WorkoutAdjustmentLevel;dose:CapacityDose;structuralModifier:number;goal:GoalObjective;clientCues:string[];internalRationale:string[];allowLoadProgression:boolean;allowEnduranceProgression:boolean}
