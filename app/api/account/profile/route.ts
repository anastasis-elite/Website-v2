import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { data: client } = await supabase.from('clients').select('birthdate_updated_once,birthdate').eq('auth_user_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const update: Record<string, unknown> = {
    address_line_1: String(body.addressLine1 || '').trim() || null,
    address_line_2: String(body.addressLine2 || '').trim() || null,
    city: String(body.city || '').trim() || null,
    state: String(body.state || '').trim() || null,
    postal_code: String(body.postalCode || '').trim() || null,
    country: String(body.country || 'US').trim(),
    reproductive_status: String(body.reproductiveStatus || 'not_tracking'),
    last_period_start: body.lastPeriodStart || null,
    average_cycle_length: Math.max(18, Math.min(60, Number(body.averageCycleLength) || 28)),
  }
  if (!client.birthdate_updated_once && body.birthdate && body.birthdate !== client.birthdate) {
    update.birthdate = body.birthdate
    update.birthdate_updated_once = true
  }
  const { error } = await supabase.from('clients').update(update).eq('auth_user_id', user.id)
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true })
}
