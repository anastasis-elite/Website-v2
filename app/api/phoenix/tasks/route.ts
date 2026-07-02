import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const taskPattern = /^[a-z0-9-]{1,80}$/

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const clientId = String(body.clientId || '')
  const taskIds = (Array.isArray(body.taskIds) ? body.taskIds : [body.taskId])
    .map((value: unknown) => String(value || ''))
    .filter((value: string) => taskPattern.test(value))
  const completed = body.completed !== false
  if (!clientId || !taskIds.length) return NextResponse.json({ error: 'Invalid task request.' }, { status: 400 })

  const { data: client } = await supabase
    .from('clients')
    .select('client_id')
    .eq('client_id', clientId)
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  if (completed) {
    const { error } = await supabase.from('phoenix_daily_task_completions').upsert(
      taskIds.map((taskId: string) => ({ user_id: user.id, client_id: clientId, log_date: today, task_id: taskId, completed_at: new Date().toISOString() })),
      { onConflict: 'user_id,client_id,log_date,task_id' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('phoenix_daily_task_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .eq('log_date', today)
      .in('task_id', taskIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, taskIds, completed })
}
