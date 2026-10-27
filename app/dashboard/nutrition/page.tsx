import DailyPlanCard from '@/components/DailyPlanCard'
import { getDailyScheduleState } from '@/lib/schedule/service'
import NutritionDashboardClient from './NutritionDashboardClient'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import { getPhoenixRecipeRecommendations } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getTierCapabilities } from '@/lib/entitlements'
import { parseNutritionLoggingIntent } from '@/lib/nutrition/loggingIntent'
import DirectNutritionEntry from '@/components/nutrition/DirectNutritionEntry'
import { readDirectEntryLog } from '@/lib/nutrition/directEntry'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { normalizeMealPeriod } from '@/lib/nutrition/mealPeriod'
import { seedRecipes } from '@/lib/nutrition/recipes/catalog'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'

export default async function NutritionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const loggingIntent = parseNutritionLoggingIntent(await searchParams)
  const { supabase, client, user } = await getDashboardContext()
  const safetyFlags = await getRecentSafetyFlags(supabase, client.client_id)
  if (safetyFlags.length) return <SafetyEscalationNotice flags={safetyFlags} />
  if (loggingIntent.action) {
    const logDate = getClientLocalDate(client)
    let initialLog = null
    let initialError = ''
    try { initialLog = await readDirectEntryLog(supabase, client.client_id, logDate) }
    catch { initialError = 'Today’s saved intake could not be loaded. You can still record water.' }
    const capabilities = getTierCapabilities(client.program)
    const avoid = String(client.allergies || client.intolerances || '').toLowerCase()
    const recipe = capabilities.nutritionRecommendedMeal ? seedRecipes.find(item => item.id === loggingIntent.recipeId && item.allergens.every(allergen => !avoid.includes(allergen))) : undefined
    return <DirectNutritionEntry key={`${client.client_id}:${logDate}:${loggingIntent.action}`} clientId={client.client_id}
      program={capabilities.tier} timezone={getClientTimeZone(client)} logDate={logDate} loggingIntent={loggingIntent}
      initialLog={initialLog} initialError={initialError}
      recipe={recipe ? { title: recipe.title, meal: normalizeMealPeriod(recipe.meal_type), ingredients: recipe.ingredients.map(item => `${item.quantity} ${item.name}`) } : undefined} />
  }
  const logic=await getProgramLogicForClient({supabase,user,client})
  if (process.env.NODE_ENV === 'development') {
    console.info('[AOS Nutrition route] resolved tier', {
      clientId: client.client_id,
      clientProgram: client.program,
      logicProgram: logic.program,
    })
  }
  const recipes=getTierCapabilities(logic.program).nutritionRecommendedMeal?getPhoenixRecipeRecommendations({logic,client}):[]
  const schedule = await getDailyScheduleState({ supabase, user, client, logic })
  return <PhoneAppFrame eyebrow={`Nutrition · ${logic.program}`} title="Nourish the life you’re building." subtitle="Clear targets. Less guesswork."><DailyPlanCard plan={schedule.dailyRecommendation!} schedule={schedule} compact /><NutritionDashboardClient logic={logic} recipes={recipes} loggingIntent={loggingIntent} /></PhoneAppFrame>
}
