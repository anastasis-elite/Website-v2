import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRevenueReport } from '@/lib/aos/revenue/getRevenueReport'
import { isAOSAdmin } from '@/lib/aos/isAOSAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAOSAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    return NextResponse.json({ success: true, report: await getRevenueReport() })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Revenue report failed.' }, { status: 500 })
  }
}
