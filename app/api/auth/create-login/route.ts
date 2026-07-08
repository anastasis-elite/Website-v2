import { NextResponse } from 'next/server'
import { isClientOnboardingComplete } from '@/lib/dashboard/isClientOnboardingComplete'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/auth/rateLimit'
import { validateClientInvitation } from '@/lib/auth/clientInvitations'

export const runtime = 'nodejs'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createAdminClient()

    const { email, password, client_id, token } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const clientId=String(client_id||'').trim()

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing client reference.' },
        { status: 400 }
      )
    }

    if (!token) return NextResponse.json({ error: 'This invitation is missing or invalid.' }, { status: 400 })
    const requestKey = `${req.headers.get('x-forwarded-for') || 'unknown'}:${normalizedEmail}`
    const allowed = await enforceRateLimit({ supabase: supabaseAdmin, scope: 'create_login', key: requestKey, limit: 5, windowMinutes: 15 })
    if (!allowed) return NextResponse.json({ error: 'Too many login creation attempts. Try again later.' }, { status: 429 })

    const {data:client,error:clientError}=await supabaseAdmin.from('clients').select('client_id,email,login_email,auth_user_id,program,onboarding_completed,birthdate,address_line_1,city,state,postal_code').eq('client_id',clientId).maybeSingle()
    if(clientError)return NextResponse.json({error:'Unable to validate this invitation.'},{status:500})
    const invitedEmail=String(client?.email||client?.login_email||'').trim().toLowerCase()
    if(!client||invitedEmail!==normalizedEmail)return NextResponse.json({error:'This login link does not match the invited client and email.'},{status:403})
    if(client.auth_user_id)return NextResponse.json({error:'A login already exists for this client. Sign in or reset your password instead.'},{status:409})
    const invitation = await validateClientInvitation({ supabase: supabaseAdmin, token: String(token), clientId, email: normalizedEmail })
    if (!invitation) return NextResponse.json({ error: 'This invitation is invalid, expired, or already used.' }, { status: 410 })

    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          client_id:clientId,
          program:client.program,
        },
      })

    if (createError) {
      const duplicate=/already|registered|exists|duplicate/i.test(createError.message)
      return NextResponse.json(
        { error: duplicate?'An account already exists for this email. Sign in or reset your password, then contact support if it is not connected.':'Unable to create your login. Please try again.' },
        { status: duplicate?409:400 }
      )
    }

    const userId = userData.user?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'User was not created.' },
        { status: 500 }
      )
    }

    const { error: updateClientError } = await supabaseAdmin
      .from('clients')
      .update({
        auth_user_id: userId,
        login_email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId)
      .is('auth_user_id',null)
      .select('client_id')
      .maybeSingle()

    if (updateClientError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: updateClientError.message },
        { status: 500 }
      )
    }

    const {data:boundClient}=await supabaseAdmin.from('clients').select('client_id').eq('client_id',clientId).eq('auth_user_id',userId).maybeSingle()
    if(!boundClient){await supabaseAdmin.auth.admin.deleteUser(userId);return NextResponse.json({error:'The account could not be securely connected. Please request a new invitation.'},{status:409})}

    await supabaseAdmin.from('client_invitations').update({ consumed_at: new Date().toISOString() }).eq('id', invitation.id).is('consumed_at', null)

    return NextResponse.json({
      success: true,
      user_id: userId,
      redirect: isClientOnboardingComplete(client)?`/dashboard/program/${encodeURIComponent(client.program||'ignite')}`:'/dashboard/onboarding/profile',
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create login.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
