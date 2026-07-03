import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const rating = (value:unknown)=>Math.max(1,Math.min(10,Math.round(Number(value)||5)))

export async function POST(request:Request){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const body=await request.json(); const {data:client}=await supabase.from('clients').select('client_id').eq('client_id',body.clientId).eq('auth_user_id',user.id).maybeSingle()
  if(!client)return NextResponse.json({error:'Client not found.'},{status:404})
  const today=new Date().toISOString().slice(0,10)
  const {error}=await supabase.from('recovery_logs').upsert({client_id:client.client_id,auth_user_id:user.id,log_date:today,sleep_hours:Math.max(0,Math.min(12,Number(body.sleepHours)||0)),sleep_quality:rating(body.sleepQuality),stress_level:rating(body.stress),soreness_level:rating(body.soreness),energy_level:rating(body.energy),mood_level:rating(body.mood),hunger_level:rating(body.hunger),notes:typeof body.notes==='string'?body.notes.trim()||null:null,check_in_completed_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'client_id,log_date'})
  if(error)return NextResponse.json({error:error.message},{status:500})
  if(body.periodStarted){const {error:cycleError}=await supabase.from('cycle_logs').upsert({client_id:client.client_id,auth_user_id:user.id,log_date:today,period_started:true,cycle_day:1,phase:'menstrual',updated_at:new Date().toISOString()},{onConflict:'client_id,log_date'});if(cycleError)return NextResponse.json({error:cycleError.message},{status:500})}
  return NextResponse.json({success:true})
}
