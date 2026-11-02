import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { drainPurchaseInvitations } from '@/lib/commerce/invitationDelivery'
import { deliverPendingConversions } from '@/lib/analytics/server'
import { drainMembershipReminders } from '@/lib/commerce/experienceReminderDelivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const admin = createAdminClient()
    const result = await drainPurchaseInvitations(admin, process.env.NEXT_PUBLIC_APP_URL || 'https://www.anastasiselite.com')
    await deliverPendingConversions(admin)
    const reminders = await drainMembershipReminders(admin, process.env.NEXT_PUBLIC_APP_URL || 'https://www.anastasiselite.com')
    return NextResponse.json({ ...result, reminders })
  } catch { return NextResponse.json({ error: 'Invitation retry service is unavailable.' }, { status: 503 }) }
}
