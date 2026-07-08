import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAvailableWindows } from '@/lib/schedule/getAvailableWindows'

const blockTypes = new Set(['sleep','work','school_dropoff','school_pickup','commute','appointment','other'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId, blocks } = await request.json()
  const { data: client } = await supabase.from('clients').select('client_id').eq('client_id', clientId).eq('auth_user_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  if (!Array.isArray(blocks) || blocks.length > 100) return NextResponse.json({ error: 'Invalid schedule.' }, { status: 400 })
  const rows = blocks.map((block: any) => ({
    user_id: user.id,
    client_id: client.client_id,
    block_type: String(block.block_type || ''),
    label: String(block.label || '').trim() || null,
    days_of_week: Array.isArray(block.days_of_week) ? block.days_of_week.map(Number).filter((day: number) => day >= 0 && day <= 6) : [],
    start_time: String(block.start_time || ''),
    end_time: String(block.end_time || ''),
    active: true,
  }))
  if (rows.some((row: any) => !blockTypes.has(row.block_type) || !/^\d{2}:\d{2}/.test(row.start_time) || !/^\d{2}:\d{2}/.test(row.end_time) || !row.days_of_week.length)) return NextResponse.json({ error: 'Each schedule block needs a type, day, start, and end time.' }, { status: 400 })
  const { error: deleteError } = await supabase.from('client_schedule_blocks').delete().eq('client_id', client.client_id).eq('user_id', user.id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  if (rows.length) {
    const { error } = await supabase.from('client_schedule_blocks').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const windows = Object.fromEntries([0,1,2,3,4,5,6].map((day) => [day, getAvailableWindows(rows, day, 10)]))
  return NextResponse.json({ success: true, availableWindows: windows })
}
