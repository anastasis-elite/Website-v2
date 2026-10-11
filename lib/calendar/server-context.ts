import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMobileRequestContext } from '@/lib/mobile/auth'
import { ProviderError } from './providers/types'

export class CalendarHttpError extends Error {
 constructor(public status: number, message: string) { super(message) }
}
export async function calendarContext(request: Request) {
 // Cookie mutations require a same-origin browser request. Bearer requests use verified mobile sessions.
 const bearer = request.headers.get('authorization')?.startsWith('Bearer ')
 if(!bearer && !['GET','HEAD'].includes(request.method)) {
  const origin = request.headers.get('origin')
  if(!origin || origin !== new URL(request.url).origin) throw new CalendarHttpError(403,'Open calendar settings on Anastasis to perform this action.')
 }
 let supabase: any, user: any, client: any
 if(bearer) {
  const context = await createMobileRequestContext(request)
  if('error' in context) throw new CalendarHttpError(context.status || 401,'Sign in to manage your calendars.')
  ;({supabase,user,client}=context)
 } else {
  supabase=await createClient()
  const result=await supabase.auth.getUser()
  user=result.data.user
  if(result.error || !user) throw new CalendarHttpError(401,'Sign in to manage your calendars.')
  const resultClient=await supabase.from('clients').select('*').eq('auth_user_id',user.id).maybeSingle()
  if(resultClient.error) throw new CalendarHttpError(503,'Your account could not be loaded.')
  client=resultClient.data
 }
 return {supabase,user,client,admin:createAdminClient()}
}
export function calendarError(error: unknown) {
 if(error instanceof CalendarHttpError) return NextResponse.json({error:error.message},{status:error.status})
 if(error instanceof ProviderError) {
  const status=error.code==='conflict'?409:error.code==='rate_limited'?429:['read_only','permission_denied'].includes(error.code)?403:error.code==='reconnect_required'?401:error.code==='invalid_input'?400:503
  return NextResponse.json({error:error.message,code:error.code},{status,headers:error.retryAfterSeconds?{'Retry-After':String(error.retryAfterSeconds)}:undefined})
 }
 // Never emit database or provider payloads, credentials, event text, or exception stack to logs/analytics.
 return NextResponse.json({error:'Calendar service is temporarily unavailable. Check the connection settings and try again.'},{status:503})
}
export function checkDb(result: {error?: any}) { if(result.error) throw new CalendarHttpError(503,'Calendar data could not be saved. Try again.') }
export function googleConfig() {
 const clientId=process.env.GOOGLE_CALENDAR_CLIENT_ID,clientSecret=process.env.GOOGLE_CALENDAR_CLIENT_SECRET,redirectUri=process.env.GOOGLE_CALENDAR_REDIRECT_URI
 if(!clientId || !clientSecret || !redirectUri) throw new CalendarHttpError(503,'Google Calendar needs administrator setup.')
 return {clientId,clientSecret,redirectUri}
}
