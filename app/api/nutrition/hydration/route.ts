import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClientLocalDate } from '@/lib/timezone'
import { readDirectEntryLog } from '@/lib/nutrition/directEntry'
import { calculateClientNutritionTargets } from '@/lib/nutrition/targetService'

// Read-only: opening water entry must never create a nutrition log or intake.
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return reply({ error: 'Unauthorized' }, 401)
    const params = new URL(request.url).searchParams
    const clientId = params.get('clientId') || ''
    const logDate = params.get('logDate') || ''
    if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return reply({ error: 'A client and local logging day are required.' }, 400)
    const { data: client, error } = await supabase.from('clients').select('*')
      .eq('client_id', clientId).eq('auth_user_id', user.id).maybeSingle()
    if (error) return reply({ error: 'Today’s hydration could not be loaded.' }, 500)
    if (!client) return reply({ error: 'Client not found.' }, 404)
    const stale = () => reply({ error: 'The logging day changed. Reload to open today’s water entry.' }, 409)
    if (getClientLocalDate(client) !== logDate) return stale()
    let log = await readDirectEntryLog(supabase, clientId, logDate)
    const saved = Number(log?.water_oz)
    let target = saved
    if (!Number.isFinite(saved) || saved <= 0) {
      target = (await calculateClientNutritionTargets({ supabase, clientId, failOnReadError: true })).water
      // Another control may have saved a real daily target during calculation.
      log = await readDirectEntryLog(supabase, clientId, logDate)
      const confirmedTarget = Number(log?.water_oz)
      if (Number.isFinite(confirmedTarget) && confirmedTarget > 0) target = confirmedTarget
    }
    if (getClientLocalDate(client) !== logDate) return stale()
    const consumed = log ? Number(log.water_consumed_oz) : 0
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(consumed) || consumed < 0) {
      return reply({ error: 'Today’s hydration target or saved intake could not be confirmed.' }, 500)
    }
    return reply({ clientId, logDate, target, consumed })
  } catch {
    return reply({ error: 'Today’s hydration target and saved intake could not be loaded. Please retry.' }, 500)
  }
}
