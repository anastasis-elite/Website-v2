import 'server-only'
import { randomBytes, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calendarContext, calendarError, CalendarHttpError, checkDb, googleConfig } from './server-context'
import { digest, seal, unseal } from './crypto'
import { allRows, credentialsFor, discoverCalendars, linkAccount, listCalendarState, listUnifiedEvents, ownedConnection, providerCalendar, syncConnection } from './service'
import { googleAuthorizationUrl, exchangeGoogleCode, googleAccountIdentity, revokeGoogleCredentials, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from './providers/google'
import { discoverICloudCalendars, createICloudEvent, updateICloudEvent, deleteICloudEvent } from './providers/icloud'
import { buildICalendar } from './providers/ical'
import { ProviderError, type EventDraft, type ProviderEvent, type GoogleCredentials, type ICloudCredentials } from './providers/types'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'
import { getOpenWindows } from '@/lib/schedule/engine'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { getClientTimeZone } from '@/lib/timezone'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { getCommitmentCalendarRange } from '@/lib/schedule/commitmentCalendar'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const isValidDate = (value:string) => datePattern.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value
export function validTimezone(value:unknown) {try {new Intl.DateTimeFormat('en',{timeZone:String(value)});return String(value)}catch{throw new CalendarHttpError(400,'Choose a valid IANA time zone.')}}
export function validatedDraft(body:any):EventDraft {
 const title=String(body.title||'').trim(),timeZone=validTimezone(body.timezone||'America/Chicago'),allDay=body.all_day===true
 if(!title||title.length>200) throw new CalendarHttpError(400,'Add a title of up to 200 characters.')
 const start=String(allDay?body.start_date:body.start_at),end=String(allDay?body.end_date:body.end_at)
 if(allDay&&(!isValidDate(start)||!isValidDate(end))) throw new CalendarHttpError(400,'Choose valid all-day dates. The end date is exclusive.')
 if(!allDay&&(!/(Z|[+-]\d\d:\d\d)$/.test(start)||!/(Z|[+-]\d\d:\d\d)$/.test(end))) throw new CalendarHttpError(400,'Timed events require a time zone offset.')
 if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)) throw new CalendarHttpError(400,'The end must be after the start.')
 const recurrence=body.recurrence||[]
 if(!Array.isArray(recurrence)||recurrence.length>20||recurrence.some((r:any)=>typeof r!=='string'||r.length>1000||! /^(RRULE|EXDATE|RDATE)(;[^:\r\n]+)?:[^\r\n]+$/.test(r))) throw new CalendarHttpError(400,'Choose a valid repeating schedule.')
 const reminders=body.reminders||[]
 if(!Array.isArray(reminders)||reminders.length>5||reminders.some((r:any)=>!Number.isInteger(r)||r<0||r>40320)) throw new CalendarHttpError(400,'Choose valid reminder minutes.')
 const description=String(body.description||'').trim(),location=String(body.location||'').trim()
 if(description.length>8000||location.length>1000) throw new CalendarHttpError(400,'Shorten the notes or location.')
 const draft:EventDraft={title,description,location,start,end,timeZone,allDay,recurrence,useDefaultReminders:body.reminders_default===true,reminders:reminders.map((minutes:number)=>({method:'popup' as const,minutes})),busy:true}
 // Validate RFC5545 before persisting internal events; invalid rules must not break future calendar reads.
 buildICalendar(draft,'validation@anastasis')
 return draft
}
const ok = (data:unknown) => NextResponse.json(data,{headers:{'Cache-Control':'no-store'}})
const changed = (data:unknown) => { invalidateDailyPlan(); return ok(data) }
export const stateGET = async(request:Request) => {try{const c=await calendarContext(request);return ok(await listCalendarState(c.admin,c.user.id))}catch(e){return calendarError(e)}}
export async function googleConnect(request:Request) {
 try {
  const {admin,user}=await calendarContext(request),state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url')
  const config=googleConfig(),cookieStore=await cookies()
  checkDb(await admin.from('calendar_oauth_states').insert({state_hash:digest(state),user_id:user.id,encrypted_verifier:seal(verifier,user.id),expires_at:new Date(Date.now()+600000).toISOString()}))
  cookieStore.set('calendar_oauth_state',digest(state),{httpOnly:true,secure:config.redirectUri.startsWith('https:'),sameSite:'lax',path:'/api/calendars/google',maxAge:600})
  return ok({url:googleAuthorizationUrl(config,state,verifier)})
 }catch(e){return calendarError(e)}
}
export async function googleCallback(request:Request) {
 const redirect=new URL('/dashboard/settings/calendars',request.url)
 try {
  const {admin,user}=await calendarContext(request),url=new URL(request.url),state=url.searchParams.get('state')||'',cookieStore=await cookies()
  const stateHash=digest(state)
  if(!state||cookieStore.get('calendar_oauth_state')?.value!==stateHash) throw new CalendarHttpError(403,'Calendar linking session expired.')
  cookieStore.delete('calendar_oauth_state')
  const result=await admin.from('calendar_oauth_states').delete().eq('state_hash',stateHash).eq('user_id',user.id).gt('expires_at',new Date().toISOString()).select('encrypted_verifier').maybeSingle();checkDb(result)
  if(!result.data) throw new CalendarHttpError(403,'Calendar linking session expired.')
  const code=url.searchParams.get('code')
  if(!code||url.searchParams.has('error')) throw new CalendarHttpError(400,'Calendar access was not granted.')
  const creds=await exchangeGoogleCode(googleConfig(),code,unseal<string>(result.data.encrypted_verifier,user.id)),identity=await googleAccountIdentity(creds)
  const connection=await linkAccount(admin,user.id,'google',identity.id,identity.email,creds)
  await discoverCalendars(admin,connection,creds)
  await syncConnection(admin,user.id,connection.id)
  invalidateDailyPlan()
  redirect.searchParams.set('calendar_connected','1')
 }catch {redirect.searchParams.set('calendar_error','Google Calendar was not connected. Try connecting again from this signed-in browser.')}
 return NextResponse.redirect(redirect)
}
export async function icloudConnect(request:Request) {
 try {
  const {admin,user}=await calendarContext(request),body=await request.json(),email=String(body.email||'').trim().toLowerCase(),password=String(body.app_password||'').trim()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||! /^[a-z]{4}(-[a-z]{4}){3}$/i.test(password)) throw new CalendarHttpError(400,'Use your Apple Account email and a generated app-specific password (xxxx-xxxx-xxxx-xxxx).')
  const credentials={username:email,appSpecificPassword:password}
  // Authenticate and discover before persisting any account or credential.
  await discoverICloudCalendars(credentials)
  const connection=await linkAccount(admin,user.id,'icloud',email,email,credentials)
  await discoverCalendars(admin,connection,credentials)
  await syncConnection(admin,user.id,connection.id)
  return changed({success:true})
 }catch(e){return calendarError(e)}
}
export async function connectionPATCH(request:Request,id:string) {
 let leaseContext:{admin:any;userId:string;leaseId:string}|undefined
 try {
  const {admin,user}=await calendarContext(request),connection=await ownedConnection(admin,user.id,id)
  if(connection.status==='reconnect_required') throw new ProviderError('reconnect_required','Reconnect this account before selecting calendars.')
  const body=await request.json(),ids=body.selected_calendar_ids
  if(!Array.isArray(ids)||ids.some(v=>typeof v!=='string')) throw new CalendarHttpError(400,'Select calendars to read.')
  const leaseId=randomUUID(),claim=await admin.rpc('claim_calendar_sync',{p_id:id,p_user:user.id,p_lease:leaseId});checkDb(claim)
  if(!claim.data) throw new CalendarHttpError(409,'Calendar refresh or another change is in progress. Try again shortly.')
  leaseContext={admin,userId:user.id,leaseId}
  const found=await admin.from('connected_calendars').select('*').eq('connection_id',id).eq('user_id',user.id);checkDb(found)
  if(ids.some(v=>!found.data?.some((c:any)=>c.id===v))) throw new CalendarHttpError(404,'Calendar not found.')
  for(const cal of found.data||[]) {
   const selected=ids.includes(cal.id)
   checkDb(await admin.from('connected_calendars').update({selected,sync_token:selected&&!cal.selected?null:cal.sync_token}).eq('id',cal.id).eq('user_id',user.id))
   if(!selected) {
    checkDb(await admin.from('calendar_events').delete().eq('calendar_id',cal.id).eq('user_id',user.id))
    checkDb(await admin.from('calendar_preferences').update({default_calendar_id:null}).eq('user_id',user.id).eq('default_calendar_id',cal.id))
   }
  }
  if('default_calendar_id' in body) await savePreferences(admin,user.id,{default_calendar_id:body.default_calendar_id})
  checkDb(await admin.from('calendar_connections').update({lease_id:null,lease_until:null,next_sync_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id).eq('lease_id',leaseId))
  leaseContext=undefined
  await syncConnection(admin,user.id,id)
  return changed({success:true})
 }catch(e){return calendarError(e)}
 finally {if(leaseContext) await leaseContext.admin.from('calendar_connections').update({lease_id:null,lease_until:null}).eq('id',id).eq('user_id',leaseContext.userId).eq('lease_id',leaseContext.leaseId)}
}
export async function connectionSync(request:Request,id:string) {try{const c=await calendarContext(request);await syncConnection(c.admin,c.user.id,id);return changed({success:true})}catch(e){return calendarError(e)}}
export async function connectionDELETE(request:Request,id:string) {
 try {
  const {admin,user}=await calendarContext(request),connection=await ownedConnection(admin,user.id,id)
  let creds:GoogleCredentials|undefined
  // Do not refresh revoked credentials just to disconnect.
  const stored=await admin.from('calendar_credentials').select('encrypted_value').eq('connection_id',id).eq('user_id',user.id)
  if(connection.provider==='google'&&stored.data?.[0]) try{creds=unseal(stored.data[0].encrypted_value,`${user.id}:${id}`)}catch{}
  const deleted=await admin.rpc('disconnect_calendar',{p_id:id,p_user:user.id});checkDb(deleted)
  if(creds) try{await revokeGoogleCredentials(creds)}catch{/* Local access is stopped; Google account permissions can also be removed manually. */}
  return changed({success:true})
 }catch(e){return calendarError(e)}
}
async function savePreferences(admin:any,userId:string,body:any) {
 const row:any={user_id:userId}
 if('default_calendar_id' in body) {
  row.default_calendar_id=body.default_calendar_id||null
  if(row.default_calendar_id) {
   const cal=await admin.from('connected_calendars').select('id,writable,selected').eq('id',row.default_calendar_id).eq('user_id',userId).maybeSingle();checkDb(cal)
   if(!cal.data?.writable||!cal.data?.selected) throw new CalendarHttpError(400,'Choose a selected writable calendar.')
  }
 }
 if('timezone' in body) row.timezone=validTimezone(body.timezone)
 if('buffer_minutes' in body) {if(!Number.isInteger(body.buffer_minutes)||body.buffer_minutes<0||body.buffer_minutes>120) throw new CalendarHttpError(400,'Buffer must be 0–120 minutes.');row.buffer_minutes=body.buffer_minutes}
 const old=await admin.from('calendar_preferences').select('*').eq('user_id',userId).maybeSingle();checkDb(old)
 for(const key of ['preferred_start','preferred_end']) if(key in body) {if(!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(body[key])) throw new CalendarHttpError(400,'Choose valid preferred hours.');row[key]=body[key]}
 if(String(row.preferred_start||old.data?.preferred_start||'07:00')>=String(row.preferred_end||old.data?.preferred_end||'21:00')) throw new CalendarHttpError(400,'Preferred hours must end after they start.')
 checkDb(await admin.from('calendar_preferences').upsert({...old.data,...row}))
}
export async function preferencesPATCH(request:Request) {try{const c=await calendarContext(request);await savePreferences(c.admin,c.user.id,await request.json());return changed({success:true})}catch(e){return calendarError(e)}}
export async function eventsGET(request:Request) {
 try {const c=await calendarContext(request),url=new URL(request.url),start=url.searchParams.get('start')||new Date().toISOString(),end=url.searchParams.get('end')||new Date(Date.now()+31*86400000).toISOString()
  if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>400*86400000) throw new CalendarHttpError(400,'Choose a calendar range of up to 400 days.')
  const timezone=validTimezone(url.searchParams.get('timezone')||getClientTimeZone(c.client))
  const [events,commitments]=await Promise.all([
   listUnifiedEvents(c.admin,c.user.id,start,end,timezone),
   getCommitmentCalendarRange({supabase:c.supabase,user:c.user,client:c.client,start,end}),
  ])
  return ok({...events,...commitments})
 }catch(e){return calendarError(e)}
}
export async function availabilityGET(request:Request) {
 try {
  const c=await calendarContext(request),url=new URL(request.url),date=url.searchParams.get('date')||'',duration=Number(url.searchParams.get('duration')||30)
  if(!isValidDate(date)||!Number.isInteger(duration)||duration<5||duration>480) throw new CalendarHttpError(400,'Choose a valid day and duration (5–480 minutes).')
  const state=await listCalendarState(c.admin,c.user.id),prefs=state.preferences,tz=prefs.timezone||getClientTimeZone(c.client),start=zonedDateTimeToUtc(date,prefs.preferred_start,tz),end=zonedDateTimeToUtc(date,prefs.preferred_end,tz)
  const [result,daily,commitments]=await Promise.all([
   listUnifiedEvents(c.admin,c.user.id,start.toISOString(),end.toISOString(),tz),
   c.client?getDailyScheduleState({supabase:c.supabase,user:c.user,client:c.client,date,includeVirtualPlan:false}):Promise.resolve(null),
   getCommitmentCalendarRange({supabase:c.supabase,user:c.user,client:c.client,start:start.toISOString(),end:end.toISOString()}),
  ])
  if(daily?.unavailableSources?.length||commitments.commitmentsUnavailable) throw new CalendarHttpError(503,'Your full schedule could not be loaded. Try again before choosing an available time.')
  const busy=[...result.events.filter(e=>e.busy!==false),...(daily?.fixedEvents||[]),...commitments.commitmentEvents]
  const windows=getOpenWindows(busy as any,start,end,duration,prefs.buffer_minutes).map(window=>{const usableStart=Math.ceil(Math.max(Date.parse(window.start_at),Date.now())/60000)*60000;return {...window,start_at:new Date(usableStart).toISOString(),minutes:Math.max(0,Math.floor((Date.parse(window.end_at)-usableStart)/60000))}}).filter(w=>Date.parse(w.end_at)-Date.parse(w.start_at)>=duration*60000)
  return ok({windows,timezone:tz})
 }catch(e){return calendarError(e)}
}
async function writeOperation(admin:any,userId:string,body:any,method:string,id:string) {
 if(!uuid.test(body.idempotency_key||'')) throw new CalendarHttpError(400,'A valid idempotency key is required.')
 const hash=digest(JSON.stringify({method,id,body})),key=body.idempotency_key
 const inserted=await admin.from('calendar_write_operations').insert({user_id:userId,idempotency_key:key,request_hash:hash})
 if(inserted.error&&inserted.error.code!=='23505') checkDb(inserted)
 const result=await admin.from('calendar_write_operations').select('*').eq('user_id',userId).eq('idempotency_key',key).single();checkDb(result)
 if(result.data.request_hash!==hash) throw new CalendarHttpError(409,'This retry key was already used for a different change.')
 return {...result.data,retried:Boolean(inserted.error)}
}
export async function eventsWrite(request:Request,id?:string) {
 let leaseContext:{admin:any;userId:string;connectionId:string;leaseId:string}|undefined
 try {
  const {admin,user}=await calendarContext(request),body=await request.json(),method=request.method
  const operation=await writeOperation(admin,user.id,body,method,id||'new')
  if(operation.response) return changed(operation.response)
  let row:any,calendar:any,connection:any,creds:GoogleCredentials|ICloudCredentials|undefined,reconstructedDelete=false
  if(id) {
   const lookup=await admin.from('calendar_events').select('*').eq('id',id).eq('user_id',user.id).maybeSingle();checkDb(lookup);row=lookup.data
   if(!row && method==='DELETE' && operation.deletion_confirmed && operation.target_event_id===id) {
    const response={success:true,id,synced:operation.target_external===true}
    checkDb(await admin.from('calendar_write_operations').update({response}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key))
    return changed(response)
   }
   if(!row&&method==='DELETE'&&operation.retried&&operation.target_event_id===id&&operation.target_external===true&&operation.target_calendar_id&&operation.target_provider_event_id&&operation.target_provider_etag===body.expected_etag&&operation.connection_id) {
    // Only a server-recorded owned intent can survive a sync removing the imported row.
    // It contains mapping/version data, never appointment details or calendar credentials.
    row={id,user_id:user.id,calendar_id:operation.target_calendar_id,provider_event_id:operation.target_provider_event_id,etag:operation.target_provider_etag,provider_payload:{}}
    reconstructedDelete=true
   }
   if(!row) return await legacyWrite(admin,user.id,body,method,id)
   const updateKey=`${user.id}:${body.idempotency_key}`
   if(method==='PATCH'&&!row.calendar_id&&operation.retried&&row.provider_payload?.metadata?.anastasisUpdateOperation===updateKey) {
    const response={success:true,id,synced:Boolean(row.calendar_id)}
    checkDb(await admin.from('calendar_write_operations').update({response}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key))
    return changed(response)
   }
   if(!body.expected_etag||(body.expected_etag!==row.etag && !(method==='PATCH'&&operation.retried&&row.calendar_id))) throw new CalendarHttpError(409,'This event changed. Refresh and review it before editing.')
   if((row.provider_payload.recurrence?.length||row.provider_payload.recurringEventId)&&body.scope!=='series') throw new CalendarHttpError(400,'Confirm an edit to the entire recurring series.')
   if(row.provider_payload.recurringEventId) throw new CalendarHttpError(409,'Edit the original recurring series from its calendar.')
  }
  const calendarId=row?row.calendar_id:body.calendar_id||null
  if(calendarId) {
   const found=await admin.from('connected_calendars').select('*').eq('id',calendarId).eq('user_id',user.id).eq('selected',true).maybeSingle();checkDb(found);calendar=found.data
   if(!calendar) throw new CalendarHttpError(404,'Selected calendar not found.')
   if(!calendar.writable) throw new ProviderError('read_only','Choose a writable calendar.')
   connection=await ownedConnection(admin,user.id,calendar.connection_id)
   if(reconstructedDelete&&operation.connection_id!==connection.id) throw new CalendarHttpError(404,'The recorded calendar target is no longer available.')
   if(connection.status==='reconnect_required') throw new ProviderError('reconnect_required','Reconnect before saving this event.')
   const leaseId=randomUUID(),claim=await admin.rpc('claim_calendar_sync',{p_id:connection.id,p_user:user.id,p_lease:leaseId});checkDb(claim)
   if(!claim.data) throw new CalendarHttpError(409,'Calendar refresh or another change is in progress. Try again shortly.')
   leaseContext={admin,userId:user.id,connectionId:connection.id,leaseId}
   const currentCalendar=await admin.from('connected_calendars').select('*').eq('id',calendarId).eq('user_id',user.id).eq('selected',true).maybeSingle();checkDb(currentCalendar)
   if(!currentCalendar.data) throw new CalendarHttpError(409,'This calendar was deselected. Review your connected calendars.')
   calendar=currentCalendar.data
   if(!calendar.writable) throw new ProviderError('read_only','This calendar is read-only.')
   if(id) {
    const currentEvent=await admin.from('calendar_events').select('*').eq('id',id).eq('user_id',user.id).maybeSingle();checkDb(currentEvent)
    if(!currentEvent.data) {
     if(!reconstructedDelete) throw new CalendarHttpError(409,'This event changed during refresh. Review the latest event.')
    } else {
     if(currentEvent.data.etag!==body.expected_etag&&!(method==='PATCH'&&operation.retried)) throw new CalendarHttpError(409,'This event changed during refresh. Review the latest event.')
     if(reconstructedDelete&&(currentEvent.data.calendar_id!==operation.target_calendar_id||currentEvent.data.provider_event_id!==operation.target_provider_event_id)) throw new CalendarHttpError(409,'This calendar mapping changed. Refresh before deleting.')
     row=currentEvent.data
     reconstructedDelete=false
    }
   }
   checkDb(await admin.from('calendar_write_operations').update({connection_id:connection.id}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key))
   creds=await credentialsFor(admin,connection)
  }
  let event:ProviderEvent|undefined
  if(method==='DELETE') {
   // Persist the verified mapping before the external side effect. A later retry can
   // confirm provider 404/410 even if background synchronization has removed the row.
   const intent=await admin.from('calendar_write_operations').update({target_event_id:id,target_external:Boolean(calendar),target_calendar_id:calendar?calendarId:null,target_provider_event_id:calendar?row.provider_event_id:null,target_provider_etag:calendar?body.expected_etag:null}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key).select('idempotency_key').maybeSingle();checkDb(intent)
   if(!intent.data) throw new CalendarHttpError(409,'This calendar operation changed. Refresh before retrying.')
   if(calendar) {
    if(connection.provider==='google') await deleteGoogleEvent(creds as GoogleCredentials,providerCalendar(calendar),row.provider_event_id,body.expected_etag)
    else await deleteICloudEvent(creds as ICloudCredentials,providerCalendar(calendar),row.provider_event_id,body.expected_etag)
   }
   checkDb(await admin.from('calendar_write_operations').update({target_event_id:id,target_external:Boolean(calendar),deletion_confirmed:true}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key))
   const removed=await admin.from('calendar_events').delete().eq('id',id).eq('user_id',user.id).eq('etag',body.expected_etag).select('id').maybeSingle();checkDb(removed)
   if(!removed.data&&!reconstructedDelete) throw new CalendarHttpError(409,'This event changed during deletion. Refresh to review the current state.')
   if(calendar||row.provider_payload.recurrence?.length) {
    const siblings=await allRows(()=>admin.from('calendar_events').select('id,provider_event_id,provider_payload').eq('user_id',user.id).eq('calendar_id',row.calendar_id))
    const ids=siblings.filter(e=>e.provider_event_id===row.provider_event_id||e.provider_payload?.recurringEventId===row.provider_event_id||e.provider_payload?.metadata?.resourceId===row.provider_event_id).map(e=>e.id)
    for(let i=0;i<ids.length;i+=100) checkDb(await admin.from('calendar_events').delete().eq('user_id',user.id).in('id',ids.slice(i,i+100)))
   }
  } else {
   const draft=validatedDraft(body)
   if(row) draft.busy=row.provider_payload.busy
   if(calendar) {
    if(connection.provider==='google') event=id?await updateGoogleEvent(creds as GoogleCredentials,providerCalendar(calendar),row.provider_event_id,draft,body.expected_etag,undefined,`${user.id}:${body.idempotency_key}`):await createGoogleEvent(creds as GoogleCredentials,providerCalendar(calendar),draft,`${user.id}:${body.idempotency_key}`)
    else event=id?await updateICloudEvent(creds as ICloudCredentials,providerCalendar(calendar),row.provider_event_id,draft,body.expected_etag,undefined,`${user.id}:${body.idempotency_key}`):await createICloudEvent(creds as ICloudCredentials,providerCalendar(calendar),draft,`${user.id}:${body.idempotency_key}`)
   } else event={...draft,id:row?.provider_event_id||body.idempotency_key,calendarId:'internal',status:'confirmed',busy:draft.busy!==false,etag:randomUUID(),metadata:{...(row?.provider_payload?.metadata||{}),...(id?{anastasisUpdateOperation:`${user.id}:${body.idempotency_key}`}:{})}}
   const eventType=['workout','meal','recovery','personal','household','appointment','work','school','custom','sleep','assessment','check_in','hydration','medical','dental'].includes(body.event_type)?body.event_type:'personal'
   if(!event) throw new CalendarHttpError(503,'The provider did not confirm this event.')
   if(id&&method==='PATCH'&&operation.retried&&event.etag&&event.etag===row.etag&&row.event_type===eventType) {
    const response={success:true,id,synced:Boolean(calendar)}
    checkDb(await admin.from('calendar_write_operations').update({response}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key))
    return changed(response)
   }
   if(!row) {
    let previous=admin.from('calendar_events').select('id').eq('user_id',user.id).eq('provider_event_id',event.id)
    previous=calendarId?previous.eq('calendar_id',calendarId):previous.is('calendar_id',null)
    const found=await previous.maybeSingle();checkDb(found);row=found.data
   }
   if(!id && row) {
    const response={success:true,id:row.id,synced:Boolean(calendar)}
    checkDb(await admin.from('calendar_write_operations').update({response}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key))
    return changed(response)
   }
   const hash=digest(`${user.id}:${body.idempotency_key}`),scopedId=`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-9${hash.slice(17,20)}-${hash.slice(20,32)}`
   const values={user_id:user.id,calendar_id:calendarId,provider_event_id:event.id,provider_payload:event,event_type:eventType,etag:event.etag||event.updatedAt||randomUUID(),synced_at:new Date().toISOString()}
   const saved=id?await admin.from('calendar_events').update(values).eq('id',id).eq('user_id',user.id).eq('etag',row.etag).select('id').maybeSingle():await admin.from('calendar_events').upsert({id:row?.id||scopedId,...values},{onConflict:'id'}).select('id').single();checkDb(saved)
   if(!saved.data) throw new CalendarHttpError(409,'The event changed while saving. Refresh to review the current state.')
   row=saved.data
  }
  const response={success:true,id:row?.id||id,synced:Boolean(calendar)}
  checkDb(await admin.from('calendar_write_operations').update({response}).eq('user_id',user.id).eq('idempotency_key',body.idempotency_key))
  return changed(response)
 }catch(e){
  if(leaseContext && e instanceof ProviderError && ['reconnect_required','permission_denied','rate_limited','temporary_failure'].includes(e.code)) await leaseContext.admin.from('calendar_connections').update({status:e.code==='reconnect_required'?'reconnect_required':'error',error_code:e.code,error_message:e.message,next_sync_at:new Date(Date.now()+(e.retryAfterSeconds||60)*1000).toISOString()}).eq('id',leaseContext.connectionId).eq('user_id',leaseContext.userId).eq('lease_id',leaseContext.leaseId)
  return calendarError(e)
 }
 finally {if(leaseContext) await leaseContext.admin.from('calendar_connections').update({lease_id:null,lease_until:null}).eq('id',leaseContext.connectionId).eq('user_id',leaseContext.userId).eq('lease_id',leaseContext.leaseId)}
}
async function legacyWrite(admin:any,userId:string,body:any,method:string,id:string) {
 const result=await admin.from('anastasis_schedule_events').select('*').eq('id',id).eq('user_id',userId).maybeSingle();checkDb(result)
 const row=result.data
 if(!row) throw new CalendarHttpError(404,'Event not found.')
 if(row.external_event_id||row.external_calendar_source) throw new CalendarHttpError(409,'Manage this appointment through its original source.')
 if(body.expected_etag!==String(row.updated_at||row.created_at||'legacy')) throw new CalendarHttpError(409,'This event changed. Refresh and review it.')
 if(method==='DELETE') {
  const removed=await admin.from('anastasis_schedule_events').delete().eq('id',id).eq('user_id',userId).eq('updated_at',row.updated_at).select('id').maybeSingle();checkDb(removed)
  if(!removed.data) throw new CalendarHttpError(409,'This event changed during deletion. Refresh and review it.')
 }
 else {
  const draft=validatedDraft(body)
  if(draft.recurrence?.length||draft.reminders?.length||draft.location) throw new CalendarHttpError(400,'Create a new calendar event for recurrence, reminders or location.')
  const startAt=draft.allDay?zonedDateTimeToUtc(draft.start,'00:00',draft.timeZone).toISOString():draft.start
  const endAt=draft.allDay?zonedDateTimeToUtc(draft.end,'00:00',draft.timeZone).toISOString():draft.end
  // Retain the original schedule time when editing an already-rescheduled item.
  const timing=row.adjusted_start_at?{adjusted_start_at:startAt,adjusted_end_at:endAt,adjusted_duration_minutes:(Date.parse(endAt)-Date.parse(startAt))/60000}:{start_at:startAt,end_at:endAt}
  const edited=await admin.from('anastasis_schedule_events').update({title:draft.title,description:draft.description,...timing,timezone:draft.timeZone,all_day:draft.allDay,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).eq('updated_at',row.updated_at).select('id').maybeSingle();checkDb(edited)
  if(!edited.data) throw new CalendarHttpError(409,'This event changed during editing. Refresh and review it.')
 }
 const response={success:true,id,synced:false}
 checkDb(await admin.from('calendar_write_operations').update({response}).eq('user_id',userId).eq('idempotency_key',body.idempotency_key))
 return changed(response)
}
export async function cronGET(request:Request) {
 const secret=process.env.CRON_SECRET
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({error:'Unauthorized'},{status:401})
 try {
  const admin=createAdminClient(),now=new Date().toISOString(),due=await admin.from('calendar_connections').select('id,user_id').neq('status','reconnect_required').lte('next_sync_at',now).or(`lease_until.is.null,lease_until.lt.${now}`).order('next_sync_at').limit(10);checkDb(due)
  let synced=0,failed=0
  for(const row of due.data||[]) {try{await syncConnection(admin,row.user_id,row.id);synced++}catch{failed++}}
  checkDb(await admin.from('calendar_oauth_states').delete().lt('expires_at',now))
  if(synced) invalidateDailyPlan()
  return ok({synced,failed})
 }catch(e){return calendarError(e)}
}
