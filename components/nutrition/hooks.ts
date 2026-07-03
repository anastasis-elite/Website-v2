'use client'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
export function useNutritionEngine(data:ProgramLogicOutput){return data.nutrition}
export function useFuelReadinessEngine(data:ProgramLogicOutput){return data.fuelReadiness}
export function usePhoenixRecipes(recipes:PhoenixRecipe[]){return recipes}
