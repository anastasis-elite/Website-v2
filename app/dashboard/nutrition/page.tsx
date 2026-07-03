import NutritionDashboardClient from './NutritionDashboardClient'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import { getPhoenixRecipeRecommendations } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'

export default async function NutritionPage() {
  const { supabase, client, user } = await getDashboardContext()
  const safetyFlags = await getRecentSafetyFlags(supabase, client.client_id)
  if (safetyFlags.length) return <SafetyEscalationNotice flags={safetyFlags} />
  const logic=await getProgramLogicForClient({supabase,user,client})
  const recipes=logic.program==='phoenix'?getPhoenixRecipeRecommendations({logic,client}):[]
  return <NutritionDashboardClient logic={logic} recipes={recipes} />
}
