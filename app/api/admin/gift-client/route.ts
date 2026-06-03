import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

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

    if (adminSecret !== process.env.ADMIN_GIFT_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!email || !fullName || !program || !temporaryPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (temporaryPassword.length < 8) {
      return NextResponse.json(
        { error: 'Temporary password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase env vars' },
        { status: 500 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Missing Resend API key' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const normalizedEmail = email.toLowerCase().trim()
    const clientId = `AN-${Date.now()}`

    const months = Number(durationMonths || 12)
    const endsAt = new Date()
    endsAt.setMonth(endsAt.getMonth() + months)

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          program,
          access_type: 'gifted',
        },
      })

    if (authError || !authData.user) {
      console.error('GIFT AUTH ERROR:', authError)

      return NextResponse.json(
        {
          error: 'Auth user creation failed',
          details: authError?.message,
          code: authError?.code,
          status: authError?.status,
        },
        { status: 500 }
      )
    }

    const authUserId = authData.user.id

    const payload = {
      client_id: clientId,
      full_name: fullName,
      email: normalizedEmail,
      login_email: normalizedEmail,
      auth_user_id: authUserId,
      phone,
      program,
      subscription_status: 'gifted',
      verified_purchase: true,
      access: true,
      active: true,
      subscription_started_at: new Date().toISOString(),
      subscription_ends_at: endsAt.toISOString(),
    }

    const { error: clientError } = await supabase
      .from('clients')
      .insert(payload)

    if (clientError) {
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 }
      )
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://anastasiselite.com'

    const onboardingLink = `${appUrl}/onboarding/profile`

    const createLoginLink =
      `${appUrl}/create-login?client_id=${clientId}` +
      `&email=${encodeURIComponent(normalizedEmail)}` +
      `&program=${encodeURIComponent(program)}`

    const termsLinks = {
      terms: `${appUrl}/terms`,
      disclaimer: `${appUrl}/disclaimer`,
      conditions: `${appUrl}/conditions`,
      research: `${appUrl}/consent/research`,
    }

    const emailResult = await resend.emails.send({
      from: 'Anastasis <onboarding@anastasiselite.com>',
      to: normalizedEmail,
      subject: 'Welcome to Anastasis Elite',
      html: `
        <h1>Welcome to Anastasis Elite</h1>

        <p>Hi ${fullName},</p>

        <p>Your gifted Anastasis access has been activated.</p>

        <p><strong>Program:</strong> ${program}</p>

        <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>

        <p>
          After creating your login, begin onboarding here:
          <br />
          <a href="${onboardingLink}">
            Begin Your Onboarding
          </a>
        </p>

        <hr />

        <p>Please review the following:</p>

        <ul>
          <li><a href="${termsLinks.terms}">Terms of Use</a></li>
          <li><a href="${termsLinks.disclaimer}">Disclaimer</a></li>
          <li><a href="${termsLinks.conditions}">Conditions</a></li>
          <li><a href="${termsLinks.research}">Research Consent</a></li>
        </ul>

        <p>
          Your progress, photos, and personal information are private.
        </p>
      `,
    })

    if (emailResult.error) {
      console.error('RESEND EMAIL ERROR:', emailResult.error)

      return NextResponse.json(
        {
          error: 'Client was created, but email failed to send.',
          details: emailResult.error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      clientId,
      createLoginLink,
      emailSent: true,
    })
  } catch (error) {
    console.error('GIFT CLIENT ROUTE ERROR:', error)

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
