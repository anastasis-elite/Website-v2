import NutritionDashboardClient from './NutritionDashboardClient'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import { getPhoenixRecipeRecommendations } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getTierCapabilities } from '@/lib/entitlements'

export default async function NutritionPage() {
  const { supabase, client, user } = await getDashboardContext()
  const safetyFlags = await getRecentSafetyFlags(supabase, client.client_id)
  if (safetyFlags.length) return <SafetyEscalationNotice flags={safetyFlags} />
  const logic=await getProgramLogicForClient({supabase,user,client})
  if (process.env.NODE_ENV === 'development') {
    console.info('[AOS Nutrition route] resolved tier', {
      clientId: client.client_id,
      clientProgram: client.program,
      logicProgram: logic.program,
    })
  }
  const recipes=getTierCapabilities(logic.program).nutritionRecommendedMeal?getPhoenixRecipeRecommendations({logic,client}):[]
  return <NutritionDashboardClient logic={logic} recipes={recipes} />
}
