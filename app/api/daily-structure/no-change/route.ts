import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { client_id, action, previous_reviewed_at } = body

    if (!client_id) {
      return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
    }

    const nextReviewedAt =
      action === 'undo'
        ? previous_reviewed_at || null
        : new Date().toISOString()

    const { error } = await supabase
      .from('clients')
      .update({
        daily_structure_reviewed_at: nextReviewedAt,
      })
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      daily_structure_reviewed_at: nextReviewedAt,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Daily structure update failed',
      },
      { status: 500 }
    )
  }
}
