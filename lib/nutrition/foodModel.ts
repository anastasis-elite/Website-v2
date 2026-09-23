export const foodWithNutritionSelect = `
  id,
  name,
  brand,
  barcode,
  barcode_format,
  default_serving_amount,
  default_serving_unit,
  grams_per_serving,
  food_nutrients (
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sodium_mg,
    potassium_mg,
    magnesium_mg,
    calcium_mg,
    iron_mg,
    zinc_mg,
    selenium_mcg,
    cholesterol_mg,
    choline_mg,
    vitamin_a_mcg,
    vitamin_c_mg,
    vitamin_d_mcg,
    vitamin_e_mg,
    vitamin_k_mcg,
    b1_mg,
    b2_mg,
    b3_mg,
    b5_mg,
    b6_mg,
    b9_mcg,
    b12_mcg
  )
`

type NutritionRow = Record<string, number | string | null | undefined>

type FoodRow = {
  food_nutrients?: NutritionRow | NutritionRow[] | null
  [key: string]: unknown
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export function flattenFoodNutrition<T extends FoodRow>(food: T) {
  const nutrients = firstRelated(food.food_nutrients) || {}
  const { brand, ...rest } = food
  delete rest.food_nutrients

  return {
    ...rest,
    brand,
    brandName: brand,
    ...nutrients,
  }
}

export function flattenFoodsNutrition<T extends FoodRow>(foods: T[] | null | undefined) {
  return (foods || []).map((food) => flattenFoodNutrition(food))
}

export function gramsPerServing(servingSize: unknown, servingUnit: unknown) {
  const size = Number(servingSize || 1)
  const safeSize = Number.isFinite(size) && size > 0 ? size : 1
  const unit = String(servingUnit || 'serving').trim().toLowerCase()

  return ['g', 'gram', 'grams'].includes(unit) ? safeSize : 100
}

export function per100gNutrient(value: unknown, servingGrams: number) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.round((parsed * 1000) / servingGrams) / 10)
}
