import 'server-only'
import { randomUUID } from 'node:crypto'
import { seal, unseal } from './crypto'
import { checkDb, CalendarHttpError, googleConfig } from './server-context'
import { discoverGoogleCalendars, refreshGoogleCredentials, syncGoogleCalendar } from './providers/google'
import { discoverICloudCalendars, syncICloudCalendar } from './providers/icloud'
import type { GoogleCredentials, ICloudCredentials, ProviderCalendar, ProviderEvent, SyncWindow } from './providers/types'
import { ProviderError } from './providers/types'
import { expandProviderEvents } from './providers/ical'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'
import type { ScheduleEvent } from '@/lib/schedule/types'

export async function allRows(build: () => any): Promise<any[]> {
 const rows:any[]=[]
 for(let offset=0;;offset+=500) {
  const result=await build().order('id').range(offset,offset+499);checkDb(result)
  rows.push(...result.data||[])
  if((result.data||[]).length<500) return rows
 }
}

export const syncWindow = (): SyncWindow => ({start:new Date(Date.now()-30*86400000).toISOString(),end:new Date(Date.now()+366*86400000).toISOString()})
export async function ownedConnection(admin:any,userId:string,id:string) {
 const result=await admin.from('calendar_connections').select('*').eq('id',id).eq('user_id',userId).maybeSingle();checkDb(result)
 if(!result.data) throw new CalendarHttpError(404,'Calendar connection not found.')
 return result.data
}
export async function credentialsFor(admin:any,connection:any) {
 const result=await admin.from('calendar_credentials').select('encrypted_value').eq('connection_id',connection.id).eq('user_id',connection.user_id).maybeSingle();checkDb(result)
 if(!result.data) throw new ProviderError('reconnect_required','Reconnect this calendar account.')
 let creds=unseal<GoogleCredentials|ICloudCredentials>(result.data.encrypted_value,`${connection.user_id}:${connection.id}`)
 if(connection.provider==='google' && (creds as GoogleCredentials).expiresAt <= Date.now()+60000) {
  creds=await refreshGoogleCredentials(googleConfig(),creds as GoogleCredentials)
  checkDb(await admin.from('calendar_credentials').update({encrypted_value:seal(creds,`${connection.user_id}:${connection.id}`)}).eq('connection_id',connection.id).eq('user_id',connection.user_id))
 }
 return creds
}
export async function linkAccount(admin:any,userId:string,provider:string,accountId:string,label:string,credentials:GoogleCredentials|ICloudCredentials) {
 const previous=await admin.from('calendar_connections').select('*').eq('user_id',userId).eq('provider',provider).eq('provider_account_id',accountId).maybeSingle();checkDb(previous)
 const id=previous.data?.id||randomUUID(),lease=randomUUID()
 const encrypted=seal(credentials,`${userId}:${id}`)
 if(previous.data) {
  const claim=await admin.rpc('claim_calendar_sync',{p_id:id,p_user:userId,p_lease:lease});checkDb(claim)
  if(!claim.data) throw new CalendarHttpError(409,'Calendar refresh or another change is in progress. Reconnect again shortly.')
 }
 try {
  const result=await admin.from('calendar_connections').upsert({id,user_id:userId,provider,provider_account_id:accountId,account_label:label,status:'connected',error_code:null,error_message:null,next_sync_at:new Date().toISOString()}, {onConflict:'user_id,provider,provider_account_id'}).select('*').single();checkDb(result)
  const connection=result.data
  checkDb(await admin.from('calendar_credentials').upsert({connection_id:connection.id,user_id:userId,encrypted_value:encrypted}))
  return connection
 } finally {if(previous.data) await admin.from('calendar_connections').update({lease_id:null,lease_until:null}).eq('id',id).eq('user_id',userId).eq('lease_id',lease)}
}
export const providerCalendar = (row:any):ProviderCalendar => ({id:row.provider_calendar_id,name:row.name,timeZone:row.timezone,writable:row.writable,metadata:row.metadata})
export async function discoverCalendars(admin:any,connection:any,creds:GoogleCredentials|ICloudCredentials) {
 const list=connection.provider==='google'?await discoverGoogleCalendars(creds as GoogleCredentials):await discoverICloudCalendars(creds as ICloudCredentials)
 const previous=await admin.from('connected_calendars').select('*').eq('connection_id',connection.id).eq('user_id',connection.user_id);checkDb(previous)
 for(const cal of list) {
  const old=previous.data?.find((c:any)=>c.provider_calendar_id===cal.id)
  checkDb(await admin.from('connected_calendars').upsert({...(old?{id:old.id}:{}),connection_id:connection.id,user_id:connection.user_id,provider_calendar_id:cal.id,name:cal.name,timezone:cal.timeZone,writable:cal.writable,selected:old?.selected??false,metadata:cal.metadata||{}},{onConflict:'connection_id,provider_calendar_id'}))
 }
 for(const old of previous.data||[]) if(!list.some(c=>c.id===old.provider_calendar_id)) checkDb(await admin.from('connected_calendars').delete().eq('id',old.id).eq('user_id',connection.user_id))
 return list
}
export async function syncConnection(admin:any,userId:string,id:string) {
 const connection=await ownedConnection(admin,userId,id),lease=randomUUID()
 if(connection.status==='reconnect_required') throw new ProviderError('reconnect_required','Reconnect this account to restore access.')
 const claim=await admin.rpc('claim_calendar_sync',{p_id:id,p_user:userId,p_lease:lease});checkDb(claim)
 if(!claim.data) {
  if(connection.status==='reconnect_required') throw new ProviderError('reconnect_required','Reconnect this account to restore access.')
  throw new CalendarHttpError(409,'A refresh is already running. Try again shortly.')
 }
 try {
  const creds=await credentialsFor(admin,connection)
  await discoverCalendars(admin,connection,creds)
  const selected=await admin.from('connected_calendars').select('*').eq('connection_id',id).eq('user_id',userId).eq('selected',true);checkDb(selected)
  for(const calendar of selected.data||[]) {
   const result=connection.provider==='google'?await syncGoogleCalendar(creds as GoogleCredentials,providerCalendar(calendar),syncWindow(),calendar.sync_token||undefined):await syncICloudCalendar(creds as ICloudCredentials,providerCalendar(calendar),syncWindow(),calendar.sync_token||undefined)
   // Verify the lease still owns the account before persisting a provider response. Disconnect cascades foreign keys.
   const alive=await admin.from('calendar_connections').update({lease_until:new Date(Date.now()+4*60000).toISOString()}).eq('id',id).eq('user_id',userId).eq('lease_id',lease).select('id').maybeSingle();checkDb(alive)
   if(!alive.data) throw new CalendarHttpError(409,'The connection changed during refresh.')
   if(!result.reset && result.deletedIds.length) {
    const cached=await allRows(()=>admin.from('calendar_events').select('id,provider_event_id,provider_payload').eq('calendar_id',calendar.id).eq('user_id',userId))
    const removed=new Set(result.deletedIds),incoming=new Set(result.events.map(event=>event.id))
    const stale=cached.filter((e:any)=>!incoming.has(e.provider_event_id)&&(removed.has(e.provider_event_id)||removed.has(e.provider_payload?.recurringEventId)||removed.has(e.provider_payload?.metadata?.resourceId))).map((e:any)=>e.id)
    for(let i=0;i<stale.length;i+=100) checkDb(await admin.from('calendar_events').delete().eq('user_id',userId).in('id',stale.slice(i,i+100)))
   }
   for(let i=0;i<result.events.length;i+=100) {
    const rows=result.events.slice(i,i+100).map(event=>({user_id:userId,calendar_id:calendar.id,provider_event_id:event.id,provider_payload:event,etag:event.etag||event.updatedAt||'unknown',synced_at:new Date().toISOString()}))
    if(rows.length) checkDb(await admin.from('calendar_events').upsert(rows,{onConflict:'calendar_id,provider_event_id'}))
   }
   if(result.reset) {
    const cached=await allRows(()=>admin.from('calendar_events').select('id,provider_event_id').eq('calendar_id',calendar.id).eq('user_id',userId))
    const ids=new Set(result.events.map(e=>e.id)),stale=cached.filter((e:any)=>!ids.has(e.provider_event_id)).map((e:any)=>e.id)
    for(let i=0;i<stale.length;i+=100) checkDb(await admin.from('calendar_events').delete().eq('user_id',userId).in('id',stale.slice(i,i+100)))
   }
   checkDb(await admin.from('connected_calendars').update({sync_token:result.nextSyncToken||null,last_synced_at:new Date().toISOString()}).eq('id',calendar.id).eq('user_id',userId))
  }
  checkDb(await admin.from('calendar_connections').update({status:'connected',last_synced_at:new Date().toISOString(),next_sync_at:new Date(Date.now()+15*60000).toISOString(),failure_count:0,error_code:null,error_message:null,lease_id:null,lease_until:null}).eq('id',id).eq('user_id',userId).eq('lease_id',lease))
 } catch(error) {
  const code=error instanceof ProviderError?error.code:'temporary_failure'
  const wait=error instanceof ProviderError&&error.retryAfterSeconds?error.retryAfterSeconds:Math.min(21600,60*2**Math.min(connection.failure_count||0,8))
  await admin.from('calendar_connections').update({status:code==='reconnect_required'?'reconnect_required':'error',error_code:code,error_message:error instanceof ProviderError?error.message:'Calendar refresh failed. Try refreshing again.',next_sync_at:new Date(Date.now()+wait*1000).toISOString(),failure_count:(connection.failure_count||0)+1,lease_id:null,lease_until:null}).eq('id',id).eq('user_id',userId).eq('lease_id',lease)
  throw error
 }
}
export async function listCalendarState(admin:any,userId:string) {
 const [connections,calendars,prefs]=await Promise.all([admin.from('calendar_connections').select('id,provider,account_label,status,last_synced_at,error_message').eq('user_id',userId),admin.from('connected_calendars').select('id,connection_id,provider_calendar_id,name,timezone,writable,selected').eq('user_id',userId),admin.from('calendar_preferences').select('*').eq('user_id',userId).maybeSingle()]);[connections,calendars,prefs].forEach(checkDb)
 return {connections:(connections.data||[]).map((connection:any)=>({...connection,calendars:(calendars.data||[]).filter((c:any)=>c.connection_id===connection.id)})),preferences:prefs.data||{default_calendar_id:null,timezone:'America/Chicago',preferred_start:'07:00',preferred_end:'21:00',buffer_minutes:10},icloud_configured:Boolean(process.env.CALENDAR_CREDENTIAL_ENCRYPTION_KEY),google_configured:Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID&&process.env.GOOGLE_CALENDAR_CLIENT_SECRET&&process.env.GOOGLE_CALENDAR_REDIRECT_URI&&process.env.CALENDAR_CREDENTIAL_ENCRYPTION_KEY)}
}
export function eventInstants(event:ProviderEvent, displayTimezone=event.timeZone) {
 return event.allDay?{start_at:zonedDateTimeToUtc(event.start,'00:00',displayTimezone).toISOString(),end_at:zonedDateTimeToUtc(event.end,'00:00',displayTimezone).toISOString()}:{start_at:new Date(event.start).toISOString(),end_at:new Date(event.end).toISOString()}
}
export async function listUnifiedEvents(db:any,userId:string,start:string,end:string,displayTimezone='America/Chicago') {
 start=new Date(start).toISOString();end=new Date(end).toISOString()
 const [cached,calendars,connections,internal]=await Promise.all([allRows(()=>db.from('calendar_events').select('*').eq('user_id',userId)),db.from('connected_calendars').select('*').eq('user_id',userId).eq('selected',true),db.from('calendar_connections').select('id,provider,account_label').eq('user_id',userId),allRows(()=>db.from('anastasis_schedule_events').select('*').eq('user_id',userId).or(`and(start_at.lt.${end},end_at.gt.${start}),and(adjusted_start_at.lt.${end},adjusted_end_at.gt.${start})`))]);[calendars,connections].forEach(checkDb)
 const events:any[]=[]
 const rows=cached
 for(const calendar of [null,...calendars.data||[]]) {
  const list=rows.filter((r:any)=>r.calendar_id===(calendar?.id??null)),raw=list.map((r:any)=>r.provider_payload as ProviderEvent)
  const expanded=expandProviderEvents(raw,{start:new Date(Date.parse(start)-2*86400000).toISOString(),end:new Date(Date.parse(end)+2*86400000).toISOString()})
  for(const event of expanded) {
   if(event.status==='cancelled') continue
   const masterId=String(event.metadata?.resourceId||event.recurringEventId||event.id)
   const row=list.find((r:any)=>r.provider_event_id===masterId)||list.find((r:any)=>r.provider_event_id===event.id)
   if(!row) continue
   const master=row.provider_payload as ProviderEvent,connection=connections.data?.find((c:any)=>c.id===calendar?.connection_id)
   const instant=eventInstants(event,displayTimezone),series=eventInstants(master,displayTimezone)
   if(instant.start_at>=end||instant.end_at<=start) continue
   events.push({id:row.id,calendar_id:calendar?.id??null,title:event.title,description:event.description||'',location:event.location||'',...instant,timezone:event.timeZone,all_day:event.allDay,start_date:event.allDay?event.start:null,end_date:event.allDay?event.end:null,recurrence:master.recurrence||[],reminders:(event.reminders||[]).map(r=>r.minutes),reminders_default:event.metadata?.remindersUseDefault===true,source_label:calendar?`${connection?.provider==='google'?'Google':'iCloud'} · ${calendar.name}`:'Anastasis',writable:!row.provider_payload.recurringEventId&&(calendar?calendar.writable:true),etag:row.etag,event_type:row.event_type,external_event_id:calendar?row.provider_event_id:null,provider_calendar_id:calendar?.provider_calendar_id,calendar_provider:connection?.provider,ical_uid:event.uid,busy:event.busy,recurring_event_id:event.recurringEventId||null,occurrence_start:event.originalStart||null,edit_scope:'series',series_start_at:series.start_at,series_end_at:series.end_at,series_start_date:master.allDay?master.start:null,series_end_date:master.allDay?master.end:null})
  }
 }
 for(const event of internal) {
  const effectiveStart=event.adjusted_start_at||event.start_at,effectiveEnd=event.adjusted_end_at||event.end_at
  if(['cancelled','skipped'].includes(event.status)||Date.parse(effectiveStart)>=Date.parse(end)||Date.parse(effectiveEnd)<=Date.parse(start)) continue
  events.push({...event,start_at:effectiveStart,end_at:effectiveEnd,calendar_id:null,source_label:event.external_calendar_source||'Anastasis',writable:!event.external_event_id&&!event.external_calendar_source,etag:event.updated_at||event.created_at||'legacy',location:'',recurrence:[],reminders:[],legacy:true})
 }
 return {events:events.sort((a,b)=>a.start_at.localeCompare(b.start_at)),calendars:calendars.data||[]}
}
export async function importedScheduleEvents(db:any,userId:string,clientId:string,start:string,end:string,displayTimezone='America/Chicago'):Promise<ScheduleEvent[]> {
 // Additive feature may be deployed before migration; keep internal dashboard available during rollout.
 const result=await db.from('calendar_events').select('id').eq('user_id',userId).limit(1)
 if(result.error?.code==='42P01'||result.error?.code==='PGRST205') return []
 checkDb(result)
 const {events}=await listUnifiedEvents(db,userId,start,end,displayTimezone)
 return events.filter(e=>!e.legacy).map(event=>({...event,calendar_event_id:event.id,id:`calendar:${event.id}:${event.occurrence_start||event.start_at}`,user_id:userId,client_id:clientId,source:event.calendar_id?'external_calendar':'manual',status:'scheduled',completed_at:null,flexibility_type:'fixed',priority:'medium',required:true,movable:false,approval_required:true,earliest_start_at:null,latest_end_at:null,preferred_time:null,estimated_duration_minutes:null,external_provider_name:null,external_contact_type:null,external_contact_value:null,external_calendar_source:event.calendar_id?event.source_label:null,reschedule_allowed:false,reschedule_requires_approval:true,last_reschedule_requested_at:null,delegation_status:null,delegation_notes:null,adaptive_reason:null,adjusted_start_at:null,adjusted_end_at:null,adjusted_duration_minutes:null,action_route:event.calendar_id?'/dashboard/schedule':undefined,title:event.title,event_type:event.event_type||'personal'} as ScheduleEvent))
}
