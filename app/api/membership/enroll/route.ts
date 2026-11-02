import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email_confirmed_at) return NextResponse.json({ error: 'Verify your email before joining Community.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'fullName') || typeof body.fullName !== 'string' || !body.fullName.trim() || body.fullName.trim().length > 120) return NextResponse.json({ error: 'Provide your name. Membership grants cannot be supplied in this request.' }, { status: 400 })
  const { data, error } = await supabase.rpc('enroll_free_community', { p_full_name: body.fullName.trim() })
  if (error) return NextResponse.json({ error: 'Your Community profile could not be saved. Please retry.' }, { status: 503 })
  return NextResponse.json({ success: true, clientId: data?.client_id, redirect: '/dashboard/community' })
}
