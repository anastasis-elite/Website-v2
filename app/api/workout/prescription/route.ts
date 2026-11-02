import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveSelectedPrescription } from '@/lib/workout/resolveSelectedPrescription'

export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['exerciseId', 'variantId'].includes(key)) ||
      typeof body.exerciseId !== 'string' || typeof body.variantId !== 'string' || body.exerciseId.length > 200 || body.variantId.length > 200) {
      return json({ status: 'unavailable', message: 'Choose an exercise and its equipment variant.' }, 400)
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ status: 'blocked', message: 'Sign in before choosing a prescription.' }, 401)
    const result = await resolveSelectedPrescription({ supabase, user, exerciseId: body.exerciseId, variantId: body.variantId })
    return json(result.response, result.httpStatus)
  } catch {
    return json({ status: 'unavailable', message: 'Recommendation unavailable. Your saved inputs could not be confirmed. Retry when connected.' }, 503)
  }
}
