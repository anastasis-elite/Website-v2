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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload = {
      ...body,
      source: 'application',
      status: 'new',
      submitted_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('applications')
      .insert(payload)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: 'Application save failed',
          details: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      application: data,
      redirect: '/apply/thank-you',
    })
  } catch (error) {
    console.error('Apply API error:', error)

    const message =
      error instanceof Error ? error.message : 'Application submission failed'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
