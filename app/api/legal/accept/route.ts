import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  AI_DISCLAIMER_VERSION,
  FEATURE_CONSENT_VERSION,
  FEATURE_CONSENT_TYPES,
  HEALTH_DISCLAIMER_VERSION,
  PRIVACY_VERSION,
  RESEARCH_CONSENT_VERSION,
  TERMS_VERSION,
  type FeatureConsentType,
} from '@/lib/legal/config'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.terms || !body.privacy || !body.healthDisclaimer || !body.aiDisclaimer) {
    return NextResponse.json({ error: 'All required legal acknowledgments must be accepted.' }, { status: 400 })
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
  const userAgent = request.headers.get('user-agent')
  const source = String(body.source || 'legal_acceptance_page').slice(0, 120)

  const featureConsents = body.featureConsents || {}
  const consentRows = FEATURE_CONSENT_TYPES.flatMap((consentType) => {
    const value = featureConsents[consentType as FeatureConsentType]
    if (typeof value !== 'boolean') return []
    return [{
      user_id: user.id, consent_type: consentType, granted: value,
      consent_version: consentType === 'anonymized_research_use' ? RESEARCH_CONSENT_VERSION : FEATURE_CONSENT_VERSION,
      ip_address: ipAddress, user_agent: userAgent, acceptance_source: source,
    }]
  })
  if (body.researchConsent && !('anonymized_research_use' in featureConsents)) {
    consentRows.push({ user_id: user.id, consent_type: 'anonymized_research_use', granted: true, consent_version: RESEARCH_CONSENT_VERSION, ip_address: ipAddress, user_agent: userAgent, acceptance_source: source })
  }
  if (consentRows.length) {
    const { error: consentError } = await supabase.from('feature_consent_events').insert(consentRows)
    if (consentError) return NextResponse.json({ error: consentError.message }, { status: 500 })
  }

  const { error } = await supabase.from('legal_acceptances').insert({
    user_id: user.id,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    health_disclaimer_version: HEALTH_DISCLAIMER_VERSION,
    ai_disclaimer_version: AI_DISCLAIMER_VERSION,
    research_consent_version: body.researchConsent ? RESEARCH_CONSENT_VERSION : null,
    ip_address: ipAddress,
    user_agent: userAgent,
    acceptance_source: source,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, redirect: '/dashboard' })
}
