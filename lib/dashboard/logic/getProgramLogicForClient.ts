import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { getProgramLogicEngine } from './getProgramLogicEngine'
import type { ProgramTier } from './types'

export async function getProgramLogicForClient({supabase,user,client}:{supabase:any;user:any;client:any}){
  const program=(['ember','ignite','phoenix'].includes(client.program)?client.program:'ignite') as ProgramTier
  const [dailyPlan,monthlyAssessment]=await Promise.all([getDailyExecutionPlan({supabase,client}),getMonthlyAssessmentStatus(supabase,client.client_id)])
  const cycleStatus=getCycleStatus(client)
  const {data:output}=await supabase.from('program_outputs').select('*').eq('client_id',client.client_id).eq('program',program).order('generated_at',{ascending:false}).limit(1).maybeSingle()
  const {todaysWorkout,adjustedExercises,cycleAdjustment}=getProgramWorkout({client,output})
  return getProgramLogicEngine({supabase,user,client,program,dailyPlan,cycleStatus,cycleAdjustment,plannedWorkout:todaysWorkout,plannedExercises:adjustedExercises,monthlyAssessmentsDueCount:monthlyAssessment.due?1:0})
}
