import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TERMS_VERSION } from '@/lib/legal/config'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type RecommendedProgram = 'ember' | 'ignite' | 'phoenix'

function normalizeRecommendedProgram(value: unknown): RecommendedProgram {
  if (value === 'ember' || value === 'ignite' || value === 'phoenix') {
    return value
  }

  return 'ignite'
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const recommendedProgram = normalizeRecommendedProgram(
      body.recommended_program
    )

    const capacityScore =
      typeof body.capacity_score === 'number'
        ? body.capacity_score
        : Number(body.capacity_score || 0)

    const payload = {
      status: 'new',

      full_name: body.fullName || body.full_name || null,
      email: body.email || null,
      phone: body.phone || null,

      address_line_1: body.addressLine1 || body.address_line_1 || null,
      address_line_2: body.addressLine2 || body.address_line_2 || null,
      city: body.city || null,
      state: body.state || null,
      postal_code: body.postalCode || body.postal_code || null,
      country: body.country || 'US',
      address_verified: body.address_verified ?? false,

      applicant_acknowledged_terms: Boolean(body.agreement),
      terms_version: TERMS_VERSION,

      capacity_score: capacityScore,
      recommended_program: recommendedProgram,
      audit_version: body.audit_version || 'capacity_snapshot_v1',

      energy_level: body.energy_level || null,
      overwhelm_level: body.overwhelm_level || null,
      time_available: body.time_available || null,
      support_level: body.support_level || null,
      current_season: body.current_season || null,

      email_consent: Boolean(body.email_consent),

      submitted: body.submitted || 'capacity_audit',
      submitted_at: body.timestamp || new Date().toISOString(),

      application_data: body,
    }

    const { data, error } = await supabase
      .from('applications')
      .insert(payload)
      .select('id, recommended_program')
      .single()

    if (error) {
      console.error('APPLICATION SAVE ERROR:', error)

      return NextResponse.json(
  {
    error: `Capacity Audit save failed: ${error.message}`,
    details: error.message,
    code: error.code,
    hint: error.hint,
  },
  { status: 500 }
)
    }

    return NextResponse.json({
      success: true,
      auditId: data.id,
      recommendedProgram: data.recommended_program || recommendedProgram,
      redirect: `/audit/results/${data.id}`,
    })
  } catch (error) {
    console.error('Apply API error:', error)

    const message =
      error instanceof Error ? error.message : 'Application submission failed'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
