import { NextResponse } from 'next/server'
import { isSorenessRegionKey } from '@/lib/recovery/sorenessRegions'
import { createClient } from '@/lib/supabase/server'
import { getClientLocalDate } from '@/lib/timezone'

const rating = (value:unknown)=>Math.max(1,Math.min(10,Math.round(Number(value)||5)))

async function updateOrInsertByClientDate(supabase: any, table: string, payload: Record<string, unknown>) {
  const { data: updated, error: updateError } = await supabase
    .from(table)
    .update(payload)
    .eq('client_id', payload.client_id)
    .eq('log_date', payload.log_date)
    .select('id')
    .maybeSingle()

  if (updateError) return { error: updateError }
  if (updated) return { error: null }

  const { error: insertError } = await supabase.from(table).insert(payload)
  return { error: insertError }
}

export async function POST(request:Request){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const body=await request.json(); const {data:client}=await supabase.from('clients').select('client_id,timezone,onboarding_data,state').eq('client_id',body.clientId).eq('auth_user_id',user.id).maybeSingle()
  if(!client)return NextResponse.json({error:'Client not found.'},{status:404})
  const today=getClientLocalDate(client)
  const sorenessLevel = rating(body.soreness)
  const submittedRegions = Array.isArray(body.sorenessRegions) ? body.sorenessRegions : []
  const validatedSorenessRegions = sorenessLevel <= 5
    ? []
    : Array.from(new Set(submittedRegions.filter(isSorenessRegionKey)))
  if(sorenessLevel>5&&validatedSorenessRegions.length===0)return NextResponse.json({error:'Select where you are experiencing soreness.'},{status:400})
  const {error}=await updateOrInsertByClientDate(supabase,'recovery_logs',{client_id:client.client_id,auth_user_id:user.id,log_date:today,sleep_hours:Math.max(0,Math.min(12,Number(body.sleepHours)||0)),sleep_quality:rating(body.sleepQuality),stress_level:rating(body.stress),soreness_level:sorenessLevel,soreness_regions:validatedSorenessRegions,energy_level:rating(body.energy),mood_level:rating(body.mood),hunger_level:rating(body.hunger),notes:typeof body.notes==='string'?body.notes.trim()||null:null,check_in_completed_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  if(error)return NextResponse.json({error:error.message},{status:500})
  if(body.periodStarted){const {error:cycleError}=await updateOrInsertByClientDate(supabase,'cycle_logs',{client_id:client.client_id,auth_user_id:user.id,log_date:today,period_started:true,cycle_day:1,phase:'menstrual',updated_at:new Date().toISOString()});if(cycleError)return NextResponse.json({error:cycleError.message},{status:500})}
  return NextResponse.json({success:true})
}
