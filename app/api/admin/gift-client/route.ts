import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      adminSecret,
      fullName,
      email,
      phone,
      program,
      durationMonths,
      temporaryPassword,
    } = body

    if (
      adminSecret !== process.env.ADMIN_GIFT_SECRET
    ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase env vars' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    )

    const clientId = `AN-${Date.now()}`

    const months =
      Number(durationMonths || 12)

    const endsAt = new Date()

    endsAt.setMonth(
      endsAt.getMonth() + months
    )

    if (!temporaryPassword || temporaryPassword.length < 8) {
  return NextResponse.json(
    { error: 'Temporary password must be at least 8 characters.' },
    { status: 400 }
  )
}

const { data: authData, error: authError } =
  await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      program,
      access_type: 'gifted',
    },
  })

if (authError || !authData.user) {
  return NextResponse.json(
    {
      error: 'Auth user creation failed',
      details: authError?.message,
    },
    { status: 500 }
  )
}

const authUserId = authData.user.id
    
    const payload = {
      client_id: clientId,
      full_name: fullName,
      email,
      login_email: email,
      auth_user_id: authUserId,
      phone,
      program,
      subscription_status: 'gifted',
      verified_purchase: true,
      access: true,
      active: true,
      subscription_started_at:
        new Date().toISOString(),
      subscription_ends_at:
        endsAt.toISOString(),
    }

    const { error } = await supabase
      .from('clients')
      .insert(payload)

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      )
    }

    const createLoginLink =
      `/create-login?client_id=${clientId}` +
      `&email=${encodeURIComponent(email)}` +
      `&program=${encodeURIComponent(program)}`

    const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://anastasiselite.com'

const dashboardLink =
  `${appUrl}/dashboard`

const termsLinks = {
  terms: `${appUrl}/terms`,
  disclaimer: `${appUrl}/disclaimer`,
  conditions: `${appUrl}/conditions`,
  media: `${appUrl}/consent/media`,
  research: `${appUrl}/consent/research`,
}

await fetch(`${appUrl}/api/email/send`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: email,
    subject: 'Welcome to Anastasis Elite',
    html: `
      <h1>Welcome to Anastasis Elite</h1>

      <p>Your gifted access has been activated.</p>

      <p><strong>Program:</strong> ${program}</p>

      <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>

      <p>
        <a href="${dashboardLink}">
          Access Your Dashboard
        </a>
      </p>

      <hr />

      <p>Please review the following:</p>

      <ul>
        <li><a href="${termsLinks.terms}">Terms of Use</a></li>
        <li><a href="${termsLinks.disclaimer}">Disclaimer</a></li>
        <li><a href="${termsLinks.conditions}">Conditions</a></li>
        <li><a href="${termsLinks.media}">Media Consent</a></li>
        <li><a href="${termsLinks.research}">Research Consent</a></li>
      </ul>
    `,
  }),
})
    
    return NextResponse.json({
      success: true,
      clientId,
      createLoginLink,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gift client failed',
      },
      { status: 500 }
    )
  }
}
