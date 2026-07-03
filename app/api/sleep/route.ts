import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateSleepHours } from '@/lib/sleep/calculateSleepHours'

const clamp=(value:unknown,min:number,max:number)=>Math.max(min,Math.min(max,Number(value)||0))

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const body=await request.json();const {data:client}=await supabase.from('clients').select('client_id').eq('client_id',body.clientId).eq('auth_user_id',user.id).maybeSingle()
  if(!client)return NextResponse.json({error:'Client not found.'},{status:404})
  const today=new Date().toISOString().slice(0,10);const calculated=calculateSleepHours(String(body.bedtime||''),String(body.wakeTime||''));const duration=clamp(calculated??body.durationHours,0,24);const quality=Math.round(clamp(body.quality,1,10));const now=new Date().toISOString()
  const sleep={user_id:user.id,client_id:client.client_id,log_date:today,duration_hours:duration,quality,bedtime:body.bedtime||null,wake_time:body.wakeTime||null,notes:String(body.notes||'').trim()||null,updated_at:now}
  const {error}=await supabase.from('sleep_logs').upsert(sleep,{onConflict:'user_id,client_id,log_date'})
  if(error)return NextResponse.json({error:error.message},{status:500})
  const {error:recoveryError}=await supabase.from('recovery_logs').upsert({client_id:client.client_id,auth_user_id:user.id,log_date:today,sleep_hours:duration,sleep_quality:quality,updated_at:now},{onConflict:'client_id,log_date'})
  if(recoveryError)return NextResponse.json({error:recoveryError.message},{status:500})
  return NextResponse.json({success:true,sleep})
}
