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
    .select('client_id')
    .eq('client_id', clientId)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('recovery_logs')
    .select('daily_tasks')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()

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

  return NextResponse.json({ success: true, block, completedTasks: mergedTasks })
}
