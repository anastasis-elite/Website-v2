import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'
import { createClientInvitation } from '@/lib/auth/clientInvitations'
import { enforceRateLimit } from '@/lib/auth/rateLimit'

export const runtime = 'nodejs'

const validPrograms=new Set(['ember','ignite','phoenix'])
const escapeHtml=(value:string)=>value.replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]||character))

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      fullName,
      email,
      phone,
      program,
      durationMonths,
    } = body

    const admin = await getAOSAdminUser()
    if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 })

    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedFullName = String(fullName || '').trim()
    const normalizedPhone = String(phone || '').trim() || null

    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      !normalizedFullName ||
      !validPrograms.has(program)
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Missing Resend API key' },
        { status: 500 }
      )
    }
    const resend=new Resend(process.env.RESEND_API_KEY)

    const supabase = createAdminClient()
    const allowed = await enforceRateLimit({ supabase, scope: 'admin_gift_client', key: admin.id, limit: 10, windowMinutes: 15 })
    if (!allowed) return NextResponse.json({ error: 'Too many gift attempts. Try again later.' }, { status: 429 })

    const clientId = `AN-${crypto.randomUUID()}`

    const months = Math.max(1,Math.min(24,Number(durationMonths)||12))
    const endsAt = new Date()
    endsAt.setMonth(endsAt.getMonth() + months)

    const payload = {
      client_id: clientId,
      full_name: normalizedFullName,
      email: normalizedEmail,
      login_email: null,
      auth_user_id: null,
      phone: normalizedPhone,
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

    let invitation
    try {
      invitation = await createClientInvitation({ supabase, clientId, email: normalizedEmail })
    } catch (error) {
      await supabase.from('clients').delete().eq('client_id', clientId).is('auth_user_id', null)
      throw error
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://anastasiselite.com'

    const createLoginLink =
      `${appUrl}/create-login?client_id=${clientId}` +
      `&email=${encodeURIComponent(normalizedEmail)}` +
      `&program=${encodeURIComponent(program)}` +
      `&token=${encodeURIComponent(invitation.token)}`

    const termsLinks = {
      terms: `${appUrl}/terms`,
      healthDisclaimer: `${appUrl}/health-disclaimer`,
      aiDisclaimer: `${appUrl}/ai-disclaimer`,
      conditions: `${appUrl}/conditions`,
      research: `${appUrl}/consent/research`,
    }

    const emailResult = await resend.emails.send({
      from: 'Anastasis <onboarding@anastasiselite.com>',
      to: normalizedEmail,
      subject: 'Welcome to Anastasis Elite',
      html: `
        <h1>Welcome to Anastasis Elite</h1>

        <p>Hi ${escapeHtml(normalizedFullName)},</p>

        <p>Your gifted Anastasis access has been activated.</p>

        <p><strong>Program:</strong> ${escapeHtml(program)}</p>

        <p>
          Create your private login and choose your own password:
          <br />
          <a href="${createLoginLink}">
            Create Your Login
          </a>
        </p>

        <hr />

        <p>Please review the following:</p>

        <ul>
          <li><a href="${termsLinks.terms}">Terms of Use</a></li>
          <li><a href="${termsLinks.healthDisclaimer}">Health Disclaimer</a></li>
          <li><a href="${termsLinks.aiDisclaimer}">AI Disclaimer</a></li>
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
          clientId,
          createLoginLink,
          emailSent:false,
        },
        { status: 502 }
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
