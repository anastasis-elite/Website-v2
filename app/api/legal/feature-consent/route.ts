import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FEATURE_CONSENT_TYPES, type FeatureConsentType } from '@/lib/legal/config'
import { authorizeComplianceOperation, ComplianceAccessError } from '@/lib/legal/complianceContext'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid feature consent event.' }, { status: 400 })
    if (!FEATURE_CONSENT_TYPES.includes(body.consentType as FeatureConsentType) || typeof body.granted !== 'boolean') {
      return NextResponse.json({ error: 'Invalid feature consent event.' }, { status: 400 })
    }
    const { user, client, admin } = await authorizeComplianceOperation(supabase,
      body.userId === undefined && body.user_id === undefined ? undefined : String(body.userId ?? body.user_id),
      body.clientId === undefined && body.client_id === undefined ? undefined : String(body.clientId ?? body.client_id))
    const forwarded = request.headers.get('x-forwarded-for')
    const { error } = await admin.from('feature_consent_events').insert({
      user_id: user.id,
      consent_type: body.consentType,
      granted: body.granted,
      consent_version: String(body.version || 'v1.0').slice(0, 40),
      ip_address: forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent'),
      acceptance_source: String(body.source || 'feature_consent_api').slice(0, 120),
      metadata: {
        ...(body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}),
        client_id: client.client_id,
        program: client.program,
      },
    })
    if (error) return NextResponse.json({ error: 'Your consent could not be recorded. Try again.' }, { status: 503 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof ComplianceAccessError ? error.message : 'Your consent could not be recorded. Try again.' },
      { status: error instanceof ComplianceAccessError ? error.status : 503 })
  }
}
