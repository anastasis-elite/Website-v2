import AdaptiveNutritionDashboard from '@/components/AdaptiveNutritionDashboard'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'

export default function NutritionDashboardClient({logic,recipes}:{logic:ProgramLogicOutput;recipes:PhoenixRecipe[]}) {
  return <AdaptiveNutritionDashboard program={logic.program} logic={logic} recipes={recipes} />
}
