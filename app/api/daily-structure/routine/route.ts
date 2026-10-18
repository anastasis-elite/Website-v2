import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { validateScheduleStructure } from '@/lib/assessment/validateScheduleStructure'
import { saveRoutinePreferences } from '@/lib/assessment/routinePreferences'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Please sign in to save your routine.' }, { status: 401 })
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.client_id !== 'string' || !body.client_id ||
      !Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0 || body.expected_revision >= Number.MAX_SAFE_INTEGER) {
      return NextResponse.json({ error: 'Refresh your routine before saving.' }, { status: 400 })
    }
    const validation = validateScheduleStructure(body)
    if ('error' in validation) return NextResponse.json({ error: validation.error }, { status: 400 })
    const result = await saveRoutinePreferences({ supabase, userId: user.id, clientId: body.client_id,
      expectedRevision: body.expected_revision, answers: validation.answers })
    if (!result.saved) return NextResponse.json({ error: result.status === 409
      ? 'Your routine changed on another screen. Refresh to review it before saving.'
      : 'Your routine could not be saved. Refresh and try again.' }, { status: result.status })
    invalidateDailyPlan()
    return NextResponse.json({ success: true, routine: result.routine })
  } catch {
    return NextResponse.json({ error: 'Your routine could not be saved. Check your connection and try again.' }, { status: 500 })
  }
}
