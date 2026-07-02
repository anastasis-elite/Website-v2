import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FEATURE_CONSENT_TYPES, type FeatureConsentType } from '@/lib/legal/config'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!FEATURE_CONSENT_TYPES.includes(body.consentType as FeatureConsentType) || typeof body.granted !== 'boolean') {
    return NextResponse.json({ error: 'Invalid feature consent event.' }, { status: 400 })
  }
  const forwarded = request.headers.get('x-forwarded-for')
  const { error } = await supabase.from('feature_consent_events').insert({
    user_id: user.id,
    consent_type: body.consentType,
    granted: body.granted,
    consent_version: String(body.version || 'v1.0').slice(0, 40),
    ip_address: forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null,
    user_agent: request.headers.get('user-agent'),
    acceptance_source: String(body.source || 'feature_consent_api').slice(0, 120),
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
