import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const responses=new Set(['love_it','looks_good','too_much_today','too_easy','not_feeling_workout'])
const programs=new Set(['ember','ignite','phoenix'])

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const body=await request.json()
  if(!body.clientId||!body.assignedWorkoutId||!responses.has(body.response)||!programs.has(body.program))return NextResponse.json({error:'Invalid workout feedback.'},{status:400})
  const {data:client}=await supabase.from('clients').select('client_id,program').eq('client_id',body.clientId).eq('auth_user_id',user.id).maybeSingle()
  if(!client||client.program!==body.program)return NextResponse.json({error:'Client not found.'},{status:404})
  const today=new Date().toISOString().slice(0,10)
  const {error}=await supabase.from('workout_plan_feedback').upsert({user_id:user.id,client_id:client.client_id,feedback_date:today,assigned_workout_id:String(body.assignedWorkoutId).slice(0,160),workout_title:typeof body.workoutTitle==='string'?body.workoutTitle.slice(0,160):null,program:body.program,response:body.response,note:typeof body.note==='string'?body.note.trim().slice(0,1000)||null:null,updated_at:new Date().toISOString()},{onConflict:'user_id,feedback_date,assigned_workout_id'})
  return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({success:true,offerLighter:['too_much_today','not_feeling_workout'].includes(body.response)})
}
