import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TERMS_VERSION } from '@/lib/legal/config'
import { CAPACITY_AUDIT_VERSION, normalizeCapacityAudit } from '@/lib/capacityAudit'
export const runtime='nodejs'
export async function POST(req:Request){
 let audit:ReturnType<typeof normalizeCapacityAudit>
 try{audit=normalizeCapacityAudit(await req.json())}
 catch(error){return NextResponse.json({error:error instanceof SyntaxError?'Enter a valid submission.':error instanceof Error?error.message:'Check your answers.'},{status:400})}
 try{
  const supabase=createAdminClient();const submittedAt=new Date().toISOString()
  const payload={status:'new',full_name:audit.fullName,email:audit.email,applicant_acknowledged_terms:true,terms_version:TERMS_VERSION,capacity_score:audit.score,recommended_program:audit.recommendedProgram,audit_version:CAPACITY_AUDIT_VERSION,...audit.answers,email_consent:audit.emailConsent,submitted:'capacity_audit',submitted_at:submittedAt,application_data:{fullName:audit.fullName,email:audit.email,...audit.answers,email_consent:audit.emailConsent,agreement:true,capacity_score:audit.score,recommended_program:audit.recommendedProgram,audit_version:CAPACITY_AUDIT_VERSION,timestamp:submittedAt}}
  const {data,error}=await supabase.from('applications').insert(payload).select('id, recommended_program').single()
  if(error || !data?.id)return NextResponse.json({error:'Your Capacity Audit could not be saved. Please try again.'},{status:500})
  return NextResponse.json({success:true,auditId:data.id,capacityScore:audit.score,recommendedProgram:audit.recommendedProgram,redirect:`/audit/results/${data.id}`})
 }catch{return NextResponse.json({error:'The Capacity Audit is temporarily unavailable. Please try again.'},{status:503})}
}
