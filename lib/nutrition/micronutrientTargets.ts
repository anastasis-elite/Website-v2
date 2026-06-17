export type ScalingType = 'fixed' | 'calorie_scaled' | 'activity_scaled'

export type MicronutrientRule = {
  key: string
  label: string
  unit: 'mg' | 'mcg' | 'g'
  baseTarget: number
  scalingType: ScalingType
  per1000Calories?: number
  minimum?: number
  maximum?: number
}

export const micronutrientRules: MicronutrientRule[] = [
  {
    key: 'fiber_g',
    label: 'Fiber',
    unit: 'g',
    baseTarget: 25,
    scalingType: 'calorie_scaled',
    per1000Calories: 14,
    minimum: 25,
    maximum: 45,
  },
  {
    key: 'sodium_mg',
    label: 'Sodium',
    unit: 'mg',
    baseTarget: 1500,
    scalingType: 'activity_scaled',
    minimum: 1500,
    maximum: 3000,
  },
  {
    key: 'potassium_mg',
    label: 'Potassium',
    unit: 'mg',
    baseTarget: 2600,
    scalingType: 'calorie_scaled',
    per1000Calories: 1300,
    minimum: 2600,
    maximum: 4700,
  },
  {
    key: 'magnesium_mg',
    label: 'Magnesium',
    unit: 'mg',
    baseTarget: 320,
    scalingType: 'calorie_scaled',
    per1000Calories: 160,
    minimum: 320,
    maximum: 500,
  },
  {
    key: 'calcium_mg',
    label: 'Calcium',
    unit: 'mg',
    baseTarget: 1000,
    scalingType: 'fixed',
    minimum: 1000,
    maximum: 1200,
  },
  {
    key: 'iron_mg',
    label: 'Iron',
    unit: 'mg',
    baseTarget: 18,
    scalingType: 'fixed',
    minimum: 18,
    maximum: 27,
  },
  {
    key: 'choline_mg',
    label: 'Choline',
    unit: 'mg',
    baseTarget: 425,
    scalingType: 'fixed',
    minimum: 425,
    maximum: 550,
  },
  {
    key: 'vitamin_c_mg',
    label: 'Vitamin C',
    unit: 'mg',
    baseTarget: 75,
    scalingType: 'fixed',
    minimum: 75,
    maximum: 120,
  },
  {
    key: 'vitamin_d_mcg',
    label: 'Vitamin D',
    unit: 'mcg',
    baseTarget: 15,
    scalingType: 'fixed',
    minimum: 15,
    maximum: 20,
  },
]

export function getMicronutrientTarget({
  rule,
  calories,
  activityMultiplier = 1,
}: {
  rule: MicronutrientRule
  calories: number
  activityMultiplier?: number
}) {
  let target = rule.baseTarget

  if (rule.scalingType === 'calorie_scaled' && rule.per1000Calories) {
    target = rule.per1000Calories * (calories / 1000)
  }

  if (rule.scalingType === 'activity_scaled') {
    target = rule.baseTarget * activityMultiplier
  }

  if (typeof rule.minimum === 'number') {
    target = Math.max(target, rule.minimum)
  }

  if (typeof rule.maximum === 'number') {
    target = Math.min(target, rule.maximum)
  }

  return Math.round(target)
}

export function generateMicronutrientTargets({
  calories,
  activityMultiplier = 1,
}: {
  calories: number
  activityMultiplier?: number
}) {
  return micronutrientRules.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.key] = getMicronutrientTarget({
      rule,
      calories,
      activityMultiplier,
    })

    return acc
  }, {})
}
