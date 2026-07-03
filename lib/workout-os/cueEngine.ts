import { structuralCues } from './structuralFilter'
import type { WorkoutOSContext } from './types'

const forbidden=/\b(fix|correct|posture|pelvis|rounded|collapse|compensation|you have|because your)\b/i
export function rankClientCues(context:WorkoutOSContext){
  const capacity=context.recoveryStatus==='modify_workout'||context.capacityStatus==='low_capacity'?['Today’s goal is smooth movement.','Leave a few reps in reserve.','Take your time between sets.']:['Control every rep.','Own the lowering phase.','Move with intention.']
  return Array.from(new Set([...structuralCues(context.structural),...capacity,'Breathe before moving.'])).filter((cue)=>!forbidden.test(cue)).slice(0,3)
}
