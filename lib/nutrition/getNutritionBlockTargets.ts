type NutritionTargets = {
  calories: number
  protein: number
  carbs: number
  fats: number
  fiber_target_g?: number
  sodium_target_mg?: number
  potassium_target_mg?: number
  magnesium_target_mg?: number
  calcium_target_mg?: number
  iron_target_mg?: number
  choline_target_mg?: number
}

export type NutritionBlockKey =
  | 'morning'
  | 'midday'
  | 'evening'
  | 'other'

export type NutritionBlockTargets = {
  block: NutritionBlockKey
  label: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sodium_mg: number
  potassium_mg: number
  magnesium_mg: number
  calcium_mg: number
  iron_mg: number
  choline_mg: number
}

const blockRatios: Record<NutritionBlockKey, number> = {
  morning: 0.3,
  midday: 0.4,
  evening: 0.3,
  other: 0,
}

const blockLabels: Record<NutritionBlockKey, string> = {
  morning: 'Morning',
  midday: 'Midday',
  evening: 'Evening',
  other: 'Flexible',
}

function round(value: number | null | undefined) {
  return Math.round(Number(value || 0))
}

export function getNutritionBlockTargets(
  targets: NutritionTargets
): Record<NutritionBlockKey, NutritionBlockTargets> {
  const createBlock = (
    block: NutritionBlockKey
  ): NutritionBlockTargets => {
    const ratio = blockRatios[block]

    return {
      block,
      label: blockLabels[block],

      calories: round(targets.calories * ratio),
      protein_g: round(targets.protein * ratio),
      carbs_g: round(targets.carbs * ratio),
      fat_g: round(targets.fats * ratio),

      fiber_g: round((targets.fiber_target_g || 30) * ratio),
      sodium_mg: round((targets.sodium_target_mg || 2300) * ratio),
      potassium_mg: round((targets.potassium_target_mg || 4700) * ratio),
      magnesium_mg: round((targets.magnesium_target_mg || 320) * ratio),
      calcium_mg: round((targets.calcium_target_mg || 1000) * ratio),
      iron_mg: round((targets.iron_target_mg || 18) * ratio),
      choline_mg: round((targets.choline_target_mg || 425) * ratio),
    }
  }

  return {
    morning: createBlock('morning'),
    midday: createBlock('midday'),
    evening: createBlock('evening'),
    other: createBlock('other'),
  }
}
