export function calculateExecutionScore({
  hydration, nutrition, workout, assessment, plan, recovery, sleep,
}: {
  hydration: number; nutrition: number; workout: boolean; assessment: boolean
  plan?: number | null; recovery: boolean; sleep?: boolean | null
}) {
  const clamp = (value:number)=>Math.max(0,Math.min(100,value))
  const checkIns = plan === null || plan === undefined ? (assessment?100:0) : ((assessment?100:0)+clamp(plan))/2
  const recoverySupport = sleep === null || sleep === undefined ? (recovery?100:0) : ((recovery?100:0)+(sleep?100:0))/2
  return Math.round(clamp(hydration)*.2 + clamp(nutrition)*.2 + (workout?100:0)*.25 + checkIns*.2 + recoverySupport*.15)
}

export function calculatePercentageExecutionScore({ hydration, nutrition, workout, assessment, recovery }: {
  hydration: number; nutrition: number; workout: number; assessment: number; recovery: number
}) {
  const clamp = (value:number)=>Math.max(0,Math.min(100,value))
  return Math.round(clamp(hydration)*.2 + clamp(nutrition)*.2 + clamp(workout)*.25 + clamp(assessment)*.2 + clamp(recovery)*.15)
}
