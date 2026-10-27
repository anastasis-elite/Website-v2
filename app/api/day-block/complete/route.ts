import { getClientLocalDate } from '@/lib/timezone'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const allowedBlocks = new Set(['morning', 'midday', 'evening'])
const taskPattern = /^(morning|midday|evening)-[a-z0-9-]{1,70}$/

async function updateOrInsertRecoveryLog(supabase: any, payload: Record<string, unknown>) {
  const { data: updated, error: updateError } = await supabase
    .from('recovery_logs')
    .update(payload)
    .eq('client_id', payload.client_id)
    .eq('log_date', payload.log_date)
    .select('id')
    .maybeSingle()

  if (updateError) return { error: updateError }
  if (updated) return { error: null }

  const { error: insertError } = await supabase.from('recovery_logs').insert(payload)
  return { error: insertError }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const clientId = String(body.clientId || '')
  const block = String(body.block || '').toLowerCase()
  const completedTasks = (Array.isArray(body.completedTasks) ? body.completedTasks : [])
    .map((value: unknown) => String(value || '').toLowerCase())
    .filter((value: string) => taskPattern.test(value))

  if (!clientId || !allowedBlocks.has(block)) {
    return NextResponse.json({ error: 'Invalid day block.' }, { status: 400 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('client_id,timezone,state,onboarding_data')
    .eq('client_id', clientId)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const today = getClientLocalDate(client)
  if (body.logDate !== undefined && body.logDate !== today) {
    return NextResponse.json({ error: 'This block is for a different day. Reopen today’s schedule before logging.' }, { status: 409 })
  }
  const { data: existing, error: existingError } = await supabase
    .from('recovery_logs')
    .select('daily_tasks')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: 'Your saved completion could not be loaded. Please retry before saving this block.' }, { status: 503 })

  const existingTasks = Array.isArray(existing?.daily_tasks) ? existing.daily_tasks : []
  const mergedTasks = Array.from(new Set([...existingTasks, `${block}-complete`, ...completedTasks]))

  const { error } = await updateOrInsertRecoveryLog(supabase, {
    client_id: client.client_id,
    auth_user_id: user.id,
    log_date: today,
    daily_tasks: mergedTasks,
    updated_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateDailyPlan()

  return NextResponse.json({ success: true, block, completedTasks: mergedTasks })
}
