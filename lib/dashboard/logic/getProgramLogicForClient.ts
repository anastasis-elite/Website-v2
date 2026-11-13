import 'server-only'

import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getCurrentProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { getProgramLogicEngine } from './getProgramLogicEngine'
import { normalizeProgramTier } from '@/lib/entitlements'
import type { DashboardRequestReads } from '@/lib/dashboard/requestReads'

export async function getProgramLogicForClient({supabase,user,client,dailyPlan:providedDailyPlan,requestReads}:{supabase:any;user:any;client:any;dailyPlan?:Awaited<ReturnType<typeof getDailyExecutionPlan>>;requestReads?:DashboardRequestReads}){
  const program=normalizeProgramTier(client.program)
  const [dailyPlan,monthlyAssessment,{data:output}]=await Promise.all([providedDailyPlan||getDailyExecutionPlan({supabase,client,requestReads}),getMonthlyAssessmentStatus(supabase,client),supabase.from('program_outputs').select('*').eq('client_id',client.client_id).eq('program',program).order('generated_at',{ascending:false}).limit(1).maybeSingle()])
  const cycleStatus=getCycleStatus(client)
  const {todaysWorkout,adjustedExercises,cycleAdjustment}=await getCurrentProgramWorkout({supabase,user,client,output})
  return getProgramLogicEngine({supabase,user,client,program,dailyPlan,cycleStatus,cycleAdjustment,plannedWorkout:todaysWorkout,plannedExercises:adjustedExercises,monthlyAssessmentsDueCount:monthlyAssessment.due?1:0,requestReads})
}
