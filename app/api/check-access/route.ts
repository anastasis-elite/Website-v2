import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveMembership, parseMembershipTier } from '@/lib/membership/policy'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid access request.' }, { status: 400 })
  const { data: client, error } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Access could not be verified.' }, { status: 503 })
  const requestedClient = body.client_id || body.clientId
  if ((requestedClient && requestedClient !== client?.client_id) || (body.email && String(body.email).trim().toLowerCase() !== String(user.email || '').toLowerCase())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const tier = parseMembershipTier(client?.program)
  const access = hasActiveMembership(client) && (tier !== 'free' || Boolean(user.email_confirmed_at))
  return NextResponse.json({ access, client_id: client?.client_id || null, program: tier, subscription_status: client?.subscription_status || null,
    redirect: access ? tier === 'free' ? '/dashboard/community' : tier === 'tracker' ? '/dashboard/tracker' : '/dashboard' : '/dashboard/account' },
  { headers: { 'Cache-Control': 'private, no-store' } })
}
