import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId, action } = await request.json()

  if (!clientId || !action) {
    return NextResponse.json(
      { error: 'Missing client or action.' },
      { status: 400 }
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const updateData =
    action === 'period_started_today'
      ? {
          period_started: true,
          cycle_day: 1,
          phase: 'menstrual',
          log_date: today,
        }
      : action === 'ovulation_day'
        ? {
            ovulation_day: true,
            phase: 'ovulatory',
            log_date: today,
          }
        : null

  if (!updateData) {
    return NextResponse.json(
      { error: 'Invalid cycle action.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('cycle_logs')
    .upsert(
      {
        client_id: clientId,
        auth_user_id: user.id,
        ...updateData,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'client_id,log_date',
      }
    )
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    cycleLog: data,
  })
}
