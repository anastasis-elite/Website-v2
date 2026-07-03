import { buildCapacityDose } from './capacityFilter'
import { rankClientCues } from './cueEngine'
import type { WorkoutOSContext,WorkoutOSPrescription } from './types'

export function runWorkoutOS(context:WorkoutOSContext):WorkoutOSPrescription{
  const dose=buildCapacityDose(context);const canTrain=!context.redFlag
  const adjustmentLevel=context.redFlag?'level_4_rest_or_red_flag':dose.level==='very_low'||dose.level==='low'?'level_3_recovery_training':dose.level==='medium'?'level_1_slight_modify':'level_0_full_plan'
  const allowLoadProgression=dose.level==='high'&&context.proteinConsistent&&context.performanceStable&&context.hydrationPercent>=70
  const allowEnduranceProgression=dose.level==='high'&&context.microsConsistent&&context.performanceStable
  return {displayWorkout:true,canTrain,adjustmentLevel,dose,structuralModifier:context.structural.modifier,goal:context.goal,clientCues:rankClientCues(context),internalRationale:[`structural:${context.structural.modifier}`,`capacity:${dose.level}`,`goal:${context.goal}`,`fuel:${context.fuelStatus}`,`recovery:${context.recoveryStatus}`],allowLoadProgression,allowEnduranceProgression}
}
