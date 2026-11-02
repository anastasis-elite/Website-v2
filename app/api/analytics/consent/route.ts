import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { persistAnalyticsContext, validateAnalyticsContext } from '@/lib/analytics/checkoutContext'

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json().catch(() => null)
  const context = validateAnalyticsContext(body)
  if (!context) return NextResponse.json({ error: 'Choose an analytics preference.' }, { status: 400 })
  const { data, error } = await persistAnalyticsContext(createAdminClient(), context, user?.id)
  return error ? NextResponse.json({ error: 'Analytics preference could not be saved.' }, { status: 503 }) : NextResponse.json({ success: true, applied: data === true })
}
