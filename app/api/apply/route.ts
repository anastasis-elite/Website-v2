import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getApplicationRedirect } from '@/lib/applications/getApplicationRedirect'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
  address_verified: false,

  applicant_acknowledged_terms: true,
  terms_version: 'v1',

  application_data: body,
}

    const { data, error } = await supabase
      .from('applications')
      .insert(payload)
      .select()
      .single()

    if (error) {
  console.error('APPLICATION SAVE ERROR:', error)

  return NextResponse.json(
    {
      error: 'Application save failed',
      details: error.message,
      code: error.code,
      hint: error.hint,
    },
    { status: 500 }
  )
}

    return NextResponse.json({
  success: true,
  redirect: getApplicationRedirect({
    changeGoal:
      body.changeGoal ||
      body.goal ||
      body.whatAreYouHopingToChangeMostRightNow,

    supportReason:
      body.supportReason ||
      body.whyAreYouLookingForSupportNow ||
      body.currentStruggle,
  }),
})
  } catch (error) {
    console.error('Apply API error:', error)

    const message =
      error instanceof Error ? error.message : 'Application submission failed'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
