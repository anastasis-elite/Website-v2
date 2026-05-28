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

  const body = await request.json()

  const {
    clientId,
    symptomTypeId,
    bodyRegionId,
    severity,
    notes,
    startedMinutesAfterMeal,
    durationMinutes,
  } = body

  if (!clientId || !symptomTypeId) {
    return NextResponse.json(
      { error: 'Missing client or symptom.' },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('client_symptom_logs').insert({
    client_id: clientId,
    auth_user_id: user.id,
    symptom_type_id: symptomTypeId,
    body_region_id: bodyRegionId || null,
    severity: severity ? Number(severity) : null,
    started_minutes_after_meal: startedMinutesAfterMeal
      ? Number(startedMinutesAfterMeal)
      : null,
    duration_minutes: durationMinutes ? Number(durationMinutes) : null,
    notes: notes || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
