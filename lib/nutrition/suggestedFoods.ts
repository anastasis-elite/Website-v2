export type NutritionRemainingSnapshot = {
  calories_remaining?: number | null
  protein_remaining_g?: number | null
  carbs_remaining_g?: number | null
  fat_remaining_g?: number | null
  fiber_remaining_g?: number | null
  sodium_remaining_mg?: number | null
  potassium_remaining_mg?: number | null
  magnesium_remaining_mg?: number | null
  calcium_remaining_mg?: number | null
  iron_remaining_mg?: number | null
  zinc_remaining_mg?: number | null
  selenium_remaining_mcg?: number | null
  choline_remaining_mg?: number | null
  vitamin_a_remaining_mcg?: number | null
  vitamin_c_remaining_mg?: number | null
  vitamin_d_remaining_mcg?: number | null
  vitamin_e_remaining_mg?: number | null
  vitamin_k_remaining_mcg?: number | null
  b1_remaining_mg?: number | null
  b2_remaining_mg?: number | null
  b3_remaining_mg?: number | null
  b5_remaining_mg?: number | null
  b6_remaining_mg?: number | null
  b9_remaining_mcg?: number | null
  b12_remaining_mcg?: number | null
}

export type SuggestedFoodCandidate = {
  id: string
  name: string
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fiber_g?: number | null
  sodium_mg?: number | null
  potassium_mg?: number | null
  magnesium_mg?: number | null
  calcium_mg?: number | null
  iron_mg?: number | null
  zinc_mg?: number | null
  selenium_mcg?: number | null
  choline_mg?: number | null
  vitamin_a_mcg?: number | null
  vitamin_c_mg?: number | null
  vitamin_d_mcg?: number | null
  vitamin_e_mg?: number | null
  vitamin_k_mcg?: number | null
  b1_mg?: number | null
  b2_mg?: number | null
  b3_mg?: number | null
  b5_mg?: number | null
  b6_mg?: number | null
  b9_mcg?: number | null
  b12_mcg?: number | null
  allergens?: string[] | null
  food_serving_options?: Array<{
    label?: string | null
    grams?: number | null
    is_default?: boolean | null
    sort_order?: number | null
  }> | null
}

export type SuggestedFood = {
  foodId: string
  name: string
  serving: string | null
  contribution: string
  reason: string
  calories: number
  protein: number
  carbs: number
  fats: number
  score: number
}

type Gap = {
  key: keyof SuggestedFoodCandidate
  remainingKey: keyof NutritionRemainingSnapshot
  label: string
  unit: string
  weight: number
}

const gaps: Gap[] = [
  { key: 'protein_g', remainingKey: 'protein_remaining_g', label: 'protein', unit: 'g', weight: 3 },
  { key: 'fiber_g', remainingKey: 'fiber_remaining_g', label: 'fiber', unit: 'g', weight: 2.1 },
  { key: 'potassium_mg', remainingKey: 'potassium_remaining_mg', label: 'potassium', unit: 'mg', weight: 1.8 },
  { key: 'magnesium_mg', remainingKey: 'magnesium_remaining_mg', label: 'magnesium', unit: 'mg', weight: 1.7 },
  { key: 'calcium_mg', remainingKey: 'calcium_remaining_mg', label: 'calcium', unit: 'mg', weight: 1.5 },
  { key: 'iron_mg', remainingKey: 'iron_remaining_mg', label: 'iron', unit: 'mg', weight: 1.5 },
  { key: 'vitamin_d_mcg', remainingKey: 'vitamin_d_remaining_mcg', label: 'vitamin D', unit: 'mcg', weight: 1.5 },
  { key: 'vitamin_c_mg', remainingKey: 'vitamin_c_remaining_mg', label: 'vitamin C', unit: 'mg', weight: 1.2 },
  { key: 'choline_mg', remainingKey: 'choline_remaining_mg', label: 'choline', unit: 'mg', weight: 1.1 },
  { key: 'zinc_mg', remainingKey: 'zinc_remaining_mg', label: 'zinc', unit: 'mg', weight: 1 },
  { key: 'selenium_mcg', remainingKey: 'selenium_remaining_mcg', label: 'selenium', unit: 'mcg', weight: 1 },
  { key: 'vitamin_a_mcg', remainingKey: 'vitamin_a_remaining_mcg', label: 'vitamin A', unit: 'mcg', weight: 0.9 },
  { key: 'vitamin_e_mg', remainingKey: 'vitamin_e_remaining_mg', label: 'vitamin E', unit: 'mg', weight: 0.9 },
  { key: 'vitamin_k_mcg', remainingKey: 'vitamin_k_remaining_mcg', label: 'vitamin K', unit: 'mcg', weight: 0.9 },
  { key: 'b12_mcg', remainingKey: 'b12_remaining_mcg', label: 'B12', unit: 'mcg', weight: 0.9 },
]

function numeric(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatAmount(value: number, unit: string) {
  const rounded = unit === 'g' ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded}${unit}`
}

function bestServing(food: SuggestedFoodCandidate) {
  const options = food.food_serving_options || []
  const option =
    options.find((item) => item.is_default) ||
    [...options].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))[0]

  return option?.label || null
}

export function buildSuggestedFoods({
  remaining,
  candidates,
  loggedFoodIds,
  avoidTerms,
}: {
  remaining: NutritionRemainingSnapshot | null
  candidates: SuggestedFoodCandidate[]
  loggedFoodIds?: string[]
  avoidTerms?: string[]
}): SuggestedFood[] {
  if (!remaining) return []

  const logged = new Set(loggedFoodIds || [])
  const avoid = (avoidTerms || [])
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
  const caloriesRemaining = numeric(remaining.calories_remaining)
  const proteinRemaining = numeric(remaining.protein_remaining_g)
  const carbsRemaining = numeric(remaining.carbs_remaining_g)
  const fatsRemaining = numeric(remaining.fat_remaining_g)

  const scored = candidates
    .filter((food) => {
      if (!food.id || !food.name || logged.has(food.id)) return false

      const foodName = food.name.toLowerCase()
      const allergens = (food.allergens || []).map((allergen) => allergen.toLowerCase())

      return avoid.every((term) => !foodName.includes(term) && !allergens.includes(term))
    })
    .map((food) => {
      const calories = numeric(food.calories)
      const protein = numeric(food.protein_g)
      const carbs = numeric(food.carbs_g)
      const fats = numeric(food.fat_g)
      if (calories <= 0) return null

      let score = 0
      const contributions: Array<{ label: string; value: number; unit: string; score: number }> = []

      if (proteinRemaining > 8 && protein > 0) {
        const fit = Math.min(protein, proteinRemaining) / proteinRemaining
        const efficiency = protein / Math.max(calories, 1)
        const proteinScore = fit * 46 + efficiency * 260
        score += proteinScore
        contributions.push({ label: 'protein', value: protein, unit: 'g', score: proteinScore })
      }

      if (caloriesRemaining > 0) {
        const calorieOverage = Math.max(0, calories - caloriesRemaining)
        score -= (calorieOverage / Math.max(caloriesRemaining, 1)) * 42
      } else if (calories > 80) {
        score -= 35
      }

      if (carbsRemaining <= 8 && carbs > 18) score -= 32
      else if (carbsRemaining > 0 && carbs > carbsRemaining * 1.35) score -= 18

      if (fatsRemaining <= 5 && fats > 9) score -= 32
      else if (fatsRemaining > 0 && fats > fatsRemaining * 1.35) score -= 18

      for (const gap of gaps) {
        const remainingValue = numeric(remaining[gap.remainingKey])
        const contribution = numeric(food[gap.key])
        if (remainingValue <= 0 || contribution <= 0) continue

        const fit = Math.min(contribution, remainingValue) / remainingValue
        const gapScore = fit * 32 * gap.weight
        score += gapScore
        contributions.push({
          label: gap.label,
          value: contribution,
          unit: gap.unit,
          score: gapScore,
        })
      }

      if (caloriesRemaining > 0 && calories <= caloriesRemaining) score += 10
      if (proteinRemaining > 8 && fatsRemaining <= 5 && protein >= 18 && fats <= 6) score += 18

      const best = contributions.sort((a, b) => b.score - a.score)[0]
      if (!best || score <= 0) return null

      const reason =
        best.label === 'protein'
          ? fatsRemaining <= 5 && fats <= 6
            ? 'Lean match for today’s protein gap'
            : 'Helps close today’s protein gap'
          : caloriesRemaining > 0 && calories <= caloriesRemaining
            ? `Supports your remaining ${best.label} needs`
            : 'Best match for today’s remaining targets'

      return {
        foodId: food.id,
        name: food.name,
        serving: bestServing(food),
        contribution: best.label === 'protein' ? `+${formatAmount(best.value, best.unit)} protein` : best.label,
        reason,
        calories,
        protein,
        carbs,
        fats,
        score,
      }
    })
    .filter((food): food is SuggestedFood => Boolean(food))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, 5)
}

export function hasMeaningfulNutritionGaps(remaining: NutritionRemainingSnapshot | null) {
  if (!remaining) return false
  return (
    numeric(remaining.calories_remaining) > 120 ||
    numeric(remaining.protein_remaining_g) > 10 ||
    numeric(remaining.carbs_remaining_g) > 18 ||
    numeric(remaining.fat_remaining_g) > 7 ||
    gaps.some((gap) => numeric(remaining[gap.remainingKey]) > 0)
  )
}
