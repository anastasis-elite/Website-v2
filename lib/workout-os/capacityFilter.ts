import type { CapacityDose,WorkoutOSContext } from './types'

export function buildCapacityDose(context:WorkoutOSContext):CapacityDose{
  const veryLow=context.redFlag||context.recoveryStatus==='full_recovery_or_red_flag'
  const low=!veryLow&&(context.capacityStatus==='low_capacity'||context.recoveryStatus==='active_recovery'||context.fuelStatus==='depleted')
  const medium=!veryLow&&!low&&(context.capacityStatus==='moderate_capacity'||context.recoveryStatus==='modify_workout'||['under_fueled','slightly_under_fueled','unknown_needs_input'].includes(context.fuelStatus))
  const level=veryLow?'very_low':low?'low':medium?'medium':'high'
  const base={high:{sets:5,reps:8,rpe:'RPE 8',restSeconds:90,keepAccessories:true,keepFinisher:true},medium:{sets:4,reps:8,rpe:'RPE 7',restSeconds:105,keepAccessories:true,keepFinisher:false},low:{sets:3,reps:6,rpe:'RPE 5–6',restSeconds:120,keepAccessories:false,keepFinisher:false},very_low:{sets:2,reps:5,rpe:'Technique effort',restSeconds:120,keepAccessories:false,keepFinisher:false}}[level]
  const time=context.timeAvailable<=10?10:context.timeAvailable<=20?20:45
  return {...base,level,timeMinutes:time,keepAccessories:time>=45&&base.keepAccessories,keepFinisher:time>=45&&base.keepFinisher}
}
