import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import { selectRecipesForContext, type Recipe } from './catalog'

export type PhoenixRecipe = Recipe & {
  reason: string
  macros: { protein: number; carbs: number; fats: number; calories: number }
  prepMinutes: number
  cookMinutes: number
  totalMinutes: number
  ingredientLines: string[]
  steps: string[]
}

export function getPhoenixRecipeRecommendations({logic,client}:{logic:ProgramLogicOutput;client:any}):PhoenixRecipe[]{
  const avoid=String(client.allergies||client.intolerances||'').toLowerCase()
  const filtered = selectRecipesForContext({ logic }).filter((recipe) =>
    recipe.allergens.every((allergen) => !avoid.includes(allergen)),
  )
  const lowAppetite=logic.recoveryCheck.energy!==null&&logic.recoveryCheck.energy<=3
  const needsCarbs=logic.nutrition.carbs.remaining>logic.nutrition.protein.remaining
  return filtered.slice(0,2).map((recipe) => ({
    ...recipe,
    reason: lowAppetite
      ? 'Low energy calls for a simple, easy-to-finish meal.'
      : needsCarbs && recipe.carbs_g >= recipe.protein_g
        ? 'Today’s remaining carbohydrates can support training and recovery.'
        : 'Protein is the clearest remaining nutrition priority.',
    macros: {
      protein: recipe.protein_g,
      carbs: recipe.carbs_g,
      fats: recipe.fat_g,
      calories: recipe.calories,
    },
    prepMinutes: recipe.prep_minutes,
    cookMinutes: recipe.cook_minutes,
    totalMinutes: recipe.total_minutes,
    ingredientLines: recipe.ingredients.map((item) => `${item.quantity} ${item.name}`),
    steps: recipe.instructions,
  }))
}
