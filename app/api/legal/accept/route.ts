import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizeComplianceOperation, ComplianceAccessError } from '@/lib/legal/complianceContext'
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
  try {
    const supabase = await createClient()

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !['terms','privacy','healthDisclaimer','aiDisclaimer'].every(key => body[key] === true)) {
      return NextResponse.json({ error: 'All required legal acknowledgments must be accepted.' }, { status: 400 })
    }
    if (body.featureConsents !== undefined && (!body.featureConsents || typeof body.featureConsents !== 'object' || Array.isArray(body.featureConsents))) {
      return NextResponse.json({ error: 'Choose valid feature consent preferences.' }, { status: 400 })
    }
    const { user, client, admin } = await authorizeComplianceOperation(supabase,
      body.userId === undefined && body.user_id === undefined ? undefined : String(body.userId ?? body.user_id),
      body.clientId === undefined && body.client_id === undefined ? undefined : String(body.clientId ?? body.client_id))

    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent')
    const source = String(body.source || 'legal_acceptance_page').slice(0, 120)

    const featureConsents = body.featureConsents || {}
    const researchGranted = typeof featureConsents.anonymized_research_use === 'boolean'
      ? featureConsents.anonymized_research_use : body.researchConsent === true
    const consentRows = FEATURE_CONSENT_TYPES.flatMap((consentType) => {
      const value = featureConsents[consentType as FeatureConsentType]
      if (typeof value !== 'boolean') return []
      return [{
        user_id: user.id, consent_type: consentType, granted: value,
        consent_version: consentType === 'anonymized_research_use' ? RESEARCH_CONSENT_VERSION : FEATURE_CONSENT_VERSION,
        ip_address: ipAddress, user_agent: userAgent, acceptance_source: source,
        metadata: { client_id: client.client_id, program: client.program },
      }]
    })
    if (researchGranted && !('anonymized_research_use' in featureConsents)) {
      consentRows.push({ user_id: user.id, consent_type: 'anonymized_research_use', granted: true, consent_version: RESEARCH_CONSENT_VERSION, ip_address: ipAddress, user_agent: userAgent, acceptance_source: source,
        metadata: { client_id: client.client_id, program: client.program } })
    }
    if (consentRows.length) {
      const { error: consentError } = await admin.from('feature_consent_events').insert(consentRows)
      if (consentError) return NextResponse.json({ error: 'Your consent could not be recorded. Try again.' }, { status: 503 })
    }

    const { error } = await admin.from('legal_acceptances').insert({
      user_id: user.id,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      health_disclaimer_version: HEALTH_DISCLAIMER_VERSION,
      ai_disclaimer_version: AI_DISCLAIMER_VERSION,
      research_consent_version: researchGranted ? RESEARCH_CONSENT_VERSION : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      acceptance_source: source,
    })
    if (error) return NextResponse.json({ error: 'Your legal acceptance could not be recorded. Try again.' }, { status: 503 })

    return NextResponse.json({ success: true, redirect: '/dashboard' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof ComplianceAccessError ? error.message : 'Your legal acceptance could not be recorded. Try again.' },
      { status: error instanceof ComplianceAccessError ? error.status : 503 })
  }
}
