import AdaptiveNutritionDashboard from '@/components/AdaptiveNutritionDashboard'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import type { NutritionLoggingIntent } from '@/lib/nutrition/loggingIntent'

export default function NutritionDashboardClient({logic,recipes,loggingIntent}:{logic:ProgramLogicOutput;recipes:PhoenixRecipe[];loggingIntent: NutritionLoggingIntent}) {
  return <AdaptiveNutritionDashboard key={logic.client.id} program={logic.program} logic={logic} recipes={recipes} loggingIntent={loggingIntent} />
}
