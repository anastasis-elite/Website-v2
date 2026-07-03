export async function getSleepStatusForDashboard(supabase:any,clientId:string,dashboardDate:string){
  const {data:dated}=await supabase.from('sleep_logs').select('*').eq('client_id',clientId).eq('log_date',dashboardDate).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  let row=dated
  if(!row){const start=`${dashboardDate}T00:00:00.000Z`,end=`${dashboardDate}T23:59:59.999Z`;const {data:created}=await supabase.from('sleep_logs').select('*').eq('client_id',clientId).gte('created_at',start).lte('created_at',end).order('created_at',{ascending:false}).limit(1).maybeSingle();row=created}
  return {logged:Boolean(row),durationHours:row?Number(row.duration_hours):null,quality:row?Number(row.quality):null,bedtime:row?.bedtime||null,wakeTime:row?.wake_time||null,dashboardDate,record:row||null}
}
