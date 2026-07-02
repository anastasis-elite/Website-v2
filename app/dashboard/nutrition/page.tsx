import NutritionDashboardClient from './NutritionDashboardClient'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'

export default async function NutritionPage() {
  const { supabase, client } = await getDashboardContext()
  const safetyFlags = await getRecentSafetyFlags(supabase, client.client_id)
  if (safetyFlags.length) return <SafetyEscalationNotice flags={safetyFlags} />
  return <NutritionDashboardClient />
}
