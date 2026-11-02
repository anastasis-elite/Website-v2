import { NextResponse } from 'next/server'
import { recordConversion } from '@/lib/analytics/server'
import { createClient } from '@/lib/supabase/server'
import { membershipCan } from '@/lib/membership/policy'
import { getClientLocalDate } from '@/lib/timezone'
import { memberManualMacroEntry, memberManualMacroEntryColumns, memberManualNutritionLog, memberManualNutritionLogColumns } from '@/lib/nutrition/memberNutrition'

const macroKeys = ['calories', 'protein', 'carbs', 'fats'] as const
const valueKeys = [...macroKeys, 'waterOz'] as const
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email_confirmed_at) return NextResponse.json({ error: 'Verify your email before recording entries.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).some(key => !['clientId', 'requestId', ...valueKeys].includes(key)) ||
    typeof body.clientId !== 'string' || !body.clientId.trim() || body.clientId.length > 200 ||
    typeof body.requestId !== 'string' || !uuid.test(body.requestId)) {
    return NextResponse.json({ error: 'Review the tracking entry before saving.' }, { status: 400 })
  }
  const values: Record<string, number> = {}
  for (const key of valueKeys) {
    if (body[key] === undefined) continue
    const value = body[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (key === 'waterOz' ? 10000 : 1000000) || (key === 'waterOz' && value === 0)) {
      return NextResponse.json({ error: 'Enter valid nonnegative actuals and a positive water amount when included.' }, { status: 400 })
    }
    values[key] = value
  }
  if (!Object.values(values).some(value => value > 0)) return NextResponse.json({ error: 'Record at least one positive actual amount.' }, { status: 400 })
  const { data: client, error } = await supabase.from('clients').select('client_id,program,timezone,state,onboarding_data,access,active,verified_purchase,subscription_ends_at,membership_expires_at')
    .eq('client_id', body.clientId).eq('auth_user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Your tracking account could not be loaded.' }, { status: 503 })
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  if (client.program !== 'tracker' || !membershipCan(client, 'nutritionTracking')) return NextResponse.json({ error: 'Tracker logging is not available for this membership.' }, { status: 403 })
  const result = await supabase.rpc('record_tracker_nutrition', { p_client_id: client.client_id, p_request_id: body.requestId.toLowerCase(), p_log_date: getClientLocalDate(client), p_values: values })
  if (result.error || !result.data) return NextResponse.json({ error: 'The tracking entry could not be confirmed. Retry with the same save identifier.' }, { status: result.error?.code === '23505' ? 409 : 503 })
  if (macroKeys.some(key => (values[key] || 0) > 0)) await recordConversion(supabase, { userId: user.id, event: 'first_nutrition_completed' })
  return NextResponse.json({ success: true, nutritionLog: memberManualNutritionLog(result.data, client.program) })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const clientId = new URL(request.url).searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'A client reference is required.' }, { status: 400 })
  const { data: client, error } = await supabase.from('clients').select('client_id,program,timezone,state,onboarding_data')
    .eq('client_id', clientId).eq('auth_user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Saved tracking could not be loaded.' }, { status: 503 })
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  if (!membershipCan(client, 'accountData')) return NextResponse.json({ error: 'Membership type could not be verified.' }, { status: 403 })
  // Reading the verified owner's actuals remains available after membership expiry.
  const { data: nutritionLog, error: logError } = await supabase.from('nutrition_logs').select(memberManualNutritionLogColumns)
    .eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('log_date', getClientLocalDate(client)).maybeSingle()
  if (logError) return NextResponse.json({ error: 'Saved tracking could not be loaded.' }, { status: 503 })
  if (!nutritionLog) return NextResponse.json({ nutritionLog: null, entries: [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  const { data: entries, error: entriesError } = await supabase.from('macro_entries').select(memberManualMacroEntryColumns).eq('nutrition_log_id', nutritionLog.id).eq('auth_user_id', user.id).order('created_at', { ascending: false })
  if (entriesError) return NextResponse.json({ error: 'Saved entries could not be loaded.' }, { status: 503 })
  return NextResponse.json({ nutritionLog: memberManualNutritionLog(nutritionLog, client.program), entries: (entries || []).map(memberManualMacroEntry) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
