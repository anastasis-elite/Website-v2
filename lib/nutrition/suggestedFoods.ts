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
  barcode?: string | null
  grams_per_serving?: number | null
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
  cholesterol_mg?: number | null
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
  servingGrams: number
  contribution: string
  reason: string
  calories: number
  protein: number
  carbs: number
  fats: number
  score: number
}

export type SuggestedFoodRecommendationEffect = {
  key: string
  priorityBoost: number
  reason: string
  nutrients: string[]
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

function validServingGrams(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const grams = Number(value)
  return Number.isFinite(grams) && grams > 0 ? grams : null
}

function bestServing(food: SuggestedFoodCandidate) {
  const options = [...(food.food_serving_options || [])].sort((a, b) =>
    Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) ||
    numeric(a.sort_order) - numeric(b.sort_order),
  )
  for (const option of options) {
    const grams = validServingGrams(option.grams)
    if (grams) return { label: option.label?.trim() || `${grams} g`, grams }
  }

  // Catalog weights substantiate a portion; names such as "1 large egg" do not.
  // Do not infer a weight from a label or assume a 100 g fallback.
  const grams = validServingGrams(food.grams_per_serving)
  return grams ? { label: `${grams} g`, grams } : null
}

const nutrientFields = [
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg',
  'potassium_mg', 'magnesium_mg', 'calcium_mg', 'iron_mg', 'zinc_mg',
  'selenium_mcg', 'cholesterol_mg', 'choline_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
  'vitamin_d_mcg', 'vitamin_e_mg', 'vitamin_k_mcg', 'b1_mg', 'b2_mg', 'b3_mg',
  'b5_mg', 'b6_mg', 'b9_mcg', 'b12_mcg',
] as const satisfies ReadonlyArray<keyof SuggestedFoodCandidate>

function portionNutrients(food: SuggestedFoodCandidate, grams: number) {
  const portion = { ...food }
  for (const key of nutrientFields) portion[key] = numeric(food[key]) * grams / 100
  return portion
}

const animalFoodPattern = /\b(?:eggs?|chicken|turkey|duck|poultry|beef|pork|lamb|veal|meat|venison|bison|buffalo|elk|deer|rabbit|goat|goose|quail|pheasant|fish|salmon|tuna|cod|tilapia|trout|mackerel|haddock|halibut|pollock|flounder|catfish|herring|sardines|shrimp|prawns?|shellfish|seafood|oysters?|clams?|mussels?|scallops?|crab|lobster|squid|octopus)\b/i
const pulseOrGrainPattern = /\b(?:beans?|lentils?|chickpeas?|garbanzo|peas?|pulses?|soybeans?|rice|pasta|noodles?|quinoa|barley|millet|buckwheat|couscous)\b/i
const cookingMixPattern = /\b(?:flour|dough|batter|pancakes?|waffles?|cake|muffins?|biscuits?|soup|gravy|stuffing|pudding|pizza|lasagna)\b/i

function requiresPreparation(name: string) {
  // Preparation is a suggestion boundary only. The catalog remains available to
  // food logging and recipes. Raw fruit/nuts and dried fruit are ready-to-eat.
  if (/\bunprepared\b|\b(?:requires?|needs?)\s+(?:cooking|preparation)\b|\b0\s*%\s*moisture\b/i.test(name)) return true
  const dried = /\b(?:dry|dried|dehydrated|powder(?:ed)?)\b/i.test(name)
  if (/\beggs?\b/i.test(name) && dried) return true
  if (/\b(?:dough|batter)\b/i.test(name) && !/\b(?:baked|cooked)\b/i.test(name)) return true
  if (/\bflour\b/i.test(name) && !/\b(?:tortillas?|bread|baked|cooked)\b/i.test(name)) return true
  if (/\bpowder(?:ed)?\b/i.test(name)) return true
  const fruitOrNuts = /\b(?:fruits?|nuts?|apricots?|prunes?|raisins?|dates?|figs?|peaches?|pears?|apples?|bananas?|mango(?:es)?|cranberries|blueberries|cherries|coconuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|peanuts?|hazelnuts?|macadamias?)\b/i.test(name)
  const cookingFood = animalFoodPattern.test(name) || pulseOrGrainPattern.test(name) || cookingMixPattern.test(name)
  // Catalog dried-fruit entries can explicitly say "uncooked". That does not
  // require cooking, and a dry roasted trail mix is already ready to eat.
  const readyFruitOrNuts = (fruitOrNuts || /\btrail\s+mix\b/i.test(name)) && !cookingFood
  if (/\buncooked\b/i.test(name) && !readyFruitOrNuts) return true
  if (dried && /\bmix\b/i.test(name) && !readyFruitOrNuts) return true

  // A cooked/canned/roasted entry supplies its own prepared nutrient values.
  // Never turn dry weights into cooked weights or relabel a dry catalog entry.
  const prepared = /\b(?:cooked|boiled|steamed|canned|roasted|baked|fried|ready[ -]to[ -]eat)\b/i.test(name)
  if (prepared) return false
  const raw = /\braw\b/i.test(name)
  const pulsesOrGrains = pulseOrGrainPattern.test(name)
  if (pulsesOrGrains && (dried || raw && !/\b(?:green|snap|snow|wax|string)\b/i.test(name))) return true
  return raw && animalFoodPattern.test(name)
}

function foodIdentityKeys(food: SuggestedFoodCandidate) {
  const name = food.name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return [`name:${name}`, ...(food.barcode?.trim() ? [`barcode:${food.barcode.trim()}`] : [])]
}

const nutrientFieldByEffectKey: Record<string, keyof SuggestedFoodCandidate> = {
  protein: 'protein_g',
  fiber: 'fiber_g',
  iron: 'iron_mg',
  vitamin_c: 'vitamin_c_mg',
  potassium: 'potassium_mg',
  magnesium: 'magnesium_mg',
  sodium: 'sodium_mg',
  zinc: 'zinc_mg',
  b6: 'b6_mg',
}

const supplementNamePatterns = [
  /\bsupplement\b/i,
  /\btablet\b/i,
  /\bcapsule\b/i,
  /\bchewable\b/i,
  /\bdrop\b/i,
  /\biron pill\b/i,
  /\bferrous\b/i,
]

function physiologyEffectScore(food: SuggestedFoodCandidate, effects: SuggestedFoodRecommendationEffect[]) {
  let score = 0
  const reasons: string[] = []

  for (const effect of effects) {
    const matchingNutrients = effect.nutrients.filter((nutrient) => {
      const field = nutrientFieldByEffectKey[nutrient]
      return field ? numeric(food[field]) > 0 : false
    })

    if (!matchingNutrients.length) continue

    const nutrientScore = matchingNutrients.reduce((sum, nutrient) => {
      const field = nutrientFieldByEffectKey[nutrient]
      return sum + Math.min(1, numeric(field ? food[field] : 0) / 12)
    }, 0)

    score += nutrientScore * 12 * Math.max(0, effect.priorityBoost)
    reasons.push(effect.reason)
  }

  return {
    score,
    reason: reasons[0] || null,
  }
}

export function buildSuggestedFoods({
  remaining,
  candidates,
  loggedFoodIds,
  avoidTerms,
  recommendationEffects,
}: {
  remaining: NutritionRemainingSnapshot | null
  candidates: SuggestedFoodCandidate[]
  loggedFoodIds?: string[]
  avoidTerms?: string[]
  recommendationEffects?: SuggestedFoodRecommendationEffect[]
}): SuggestedFood[] {
  const logged = new Set(loggedFoodIds || [])
  const avoid = (avoidTerms || [])
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
  const caloriesRemaining = numeric(remaining?.calories_remaining)
  const proteinRemaining = numeric(remaining?.protein_remaining_g)
  const carbsRemaining = numeric(remaining?.carbs_remaining_g)
  const fatsRemaining = numeric(remaining?.fat_remaining_g)

  const isAvoided = (food: SuggestedFoodCandidate) => {
    const foodName = food.name.toLowerCase()
    const allergens = (food.allergens || []).map((allergen) => allergen.toLowerCase())
    return avoid.some((term) => foodName.includes(term) || allergens.includes(term))
  }
  // Duplicate records must not reintroduce a logged or avoided equivalent.
  const blockedKeys = new Set(candidates
    .filter((food) => food.name && (logged.has(food.id) || isAvoided(food)))
    .flatMap(foodIdentityKeys))

  const scored = candidates
    .filter((food) => {
      if (!food.id || !food.name || logged.has(food.id)) return false
      if (supplementNamePatterns.some((pattern) => pattern.test(food.name))) return false
      if (requiresPreparation(food.name)) return false
      return !isAvoided(food) && !foodIdentityKeys(food).some((key) => blockedKeys.has(key))
    })
    .map((candidate): SuggestedFood | null => {
      const serving = bestServing(candidate)
      if (!serving) return null
      // All scoring paths, including micro gaps and physiology, receive the
      // same portion values that drive the displayed nutrient contribution.
      const food = portionNutrients(candidate, serving.grams)
      const calories = numeric(food.calories)
      const protein = numeric(food.protein_g)
      const carbs = numeric(food.carbs_g)
      const fats = numeric(food.fat_g)
      if (calories <= 0) return null

      if (!remaining) {
        const fiber = numeric(food.fiber_g)
        return {
          foodId: food.id,
          name: food.name,
          serving: serving.label,
          servingGrams: serving.grams,
          contribution: protein >= 10 ? 'Protein option' : fiber >= 3 ? 'Fiber option' : 'Food option',
          reason: 'A starting option. Log intake to tailor suggestions to your remaining targets.',
          calories,
          protein,
          carbs,
          fats,
          score: Math.min(30, protein) * 1.8 + Math.min(12, fiber) * 3 + 1,
        }
      }

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

      const physiology = physiologyEffectScore(food, recommendationEffects || [])
      if (physiology.score > 0) {
        score += physiology.score
        contributions.push({
          label: 'current physiology support',
          value: physiology.score,
          unit: '',
          score: physiology.score,
        })
      }

      if (caloriesRemaining > 0 && calories <= caloriesRemaining) score += 10
      if (proteinRemaining > 8 && fatsRemaining <= 5 && protein >= 18 && fats <= 6) score += 18

      const best = contributions.sort((a, b) => b.score - a.score)[0]
      if (!best || score <= 0) return null

      const reason =
        physiology.reason && physiology.score >= best.score
          ? physiology.reason
          : best.label === 'protein'
          ? fatsRemaining <= 5 && fats <= 6
            ? 'Lean match for today’s protein gap'
            : 'Helps close today’s protein gap'
          : caloriesRemaining > 0 && calories <= caloriesRemaining
            ? `Supports your remaining ${best.label} needs`
            : 'Best match for today’s remaining targets'

      return {
        foodId: food.id,
        name: food.name,
        serving: serving.label,
        servingGrams: serving.grams,
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

  const identitiesById = new Map(candidates.filter(food => food.name).map(food => [food.id, foodIdentityKeys(food)]))
  const seen = new Set<string>()
  return scored.filter(food => {
    const keys = identitiesById.get(food.foodId) || []
    if (seen.has(`id:${food.foodId}`) || keys.some(key => seen.has(key))) return false
    seen.add(`id:${food.foodId}`)
    keys.forEach(key => seen.add(key))
    return true
  }).slice(0, 5)
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
