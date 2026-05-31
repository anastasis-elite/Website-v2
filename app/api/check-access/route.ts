import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const clientId = body.client_id || body.clientId || ''
    const email = body.email || ''

    if (!clientId && !email) {
      return NextResponse.json(
        { error: 'Missing client_id or email.' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase.from('clients').select('*').limit(1)

    if (clientId) {
      query = query.eq('client_id', clientId)
    } else {
      query = query.eq('email', email)
    }

    const { data: clients, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Access check failed.', details: error.message },
        { status: 500 }
      )
    }

    const client = clients?.[0]

    if (!client) {
      return NextResponse.json({
        access: false,
        client_id: clientId,
        email,
        program: body.program || '',
        verified_purchase: false,
        subscription_status: '',
        redirect: '',
      })
    }

    const subscriptionStatus =
      client.subscription_status || client.status || ''

    const hasAccess =
      client.access === true ||
      client.active === true ||
      client.verified_purchase === true ||
      ['active', 'trialing', 'paid', 'gifted'].includes(
        String(subscriptionStatus).toLowerCase()
      )

    return NextResponse.json({
      access: hasAccess,
      client_id: client.client_id,
      email: client.email,
      program: client.program || body.program || '',
      verified_purchase: Boolean(
        client.verified_purchase || hasAccess
      ),
      subscription_status: subscriptionStatus,
      redirect: hasAccess ? '/dashboard' : '',
    })
  } catch (error) {
    console.error('CHECK ACCESS ERROR:', error)

    const message =
      error instanceof Error ? error.message : 'Unable to check access'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
