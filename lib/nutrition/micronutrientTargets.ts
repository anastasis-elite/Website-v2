// lib/nutrition/micronutrientTargets.ts

export type ScalingType = 'fixed' | 'calorie_scaled' | 'soft_scaled'

export type FemaleAgeGroup =
  | 'female_14_18'
  | 'female_19_30'
  | 'female_31_50'
  | 'female_51_70'
  | 'female_71_plus'

export type MicronutrientRule = {
  key: string
  label: string
  unit: 'mg' | 'mcg' | 'g'
  values: Record<FemaleAgeGroup, number>
  scalingType: ScalingType
  per1000Calories?: number
  scaleAboveCalories?: number
  maxScaleMultiplier?: number
  minimum?: number
  maximum?: number
}

export function getFemaleAgeGroup(age: number): FemaleAgeGroup {
  if (age < 19) return 'female_14_18'
  if (age <= 30) return 'female_19_30'
  if (age <= 50) return 'female_31_50'
  if (age <= 70) return 'female_51_70'
  return 'female_71_plus'
}

export const micronutrientRules: MicronutrientRule[] = [
  {
    key: 'fiber_g',
    label: 'Fiber',
    unit: 'g',
    values: {
      female_14_18: 25,
      female_19_30: 28,
      female_31_50: 25,
      female_51_70: 22,
      female_71_plus: 22,
    },
    scalingType: 'calorie_scaled',
    per1000Calories: 14,
    minimum: 22,
    maximum: 45,
  },
  {
    key: 'sodium_mg',
    label: 'Sodium',
    unit: 'mg',
    values: {
      female_14_18: 1500,
      female_19_30: 1500,
      female_31_50: 1500,
      female_51_70: 1500,
      female_71_plus: 1500,
    },
    scalingType: 'soft_scaled',
    scaleAboveCalories: 2200,
    maxScaleMultiplier: 1.35,
    minimum: 1500,
    maximum: 3000,
  },
  {
    key: 'potassium_mg',
    label: 'Potassium',
    unit: 'mg',
    values: {
      female_14_18: 2300,
      female_19_30: 2600,
      female_31_50: 2600,
      female_51_70: 2600,
      female_71_plus: 2600,
    },
    scalingType: 'soft_scaled',
    scaleAboveCalories: 2200,
    maxScaleMultiplier: 1.25,
    minimum: 2300,
    maximum: 4700,
  },
  {
    key: 'magnesium_mg',
    label: 'Magnesium',
    unit: 'mg',
    values: {
      female_14_18: 360,
      female_19_30: 310,
      female_31_50: 320,
      female_51_70: 320,
      female_71_plus: 320,
    },
    scalingType: 'soft_scaled',
    scaleAboveCalories: 2200,
    maxScaleMultiplier: 1.25,
    minimum: 310,
    maximum: 500,
  },
  {
    key: 'calcium_mg',
    label: 'Calcium',
    unit: 'mg',
    values: {
      female_14_18: 1300,
      female_19_30: 1000,
      female_31_50: 1000,
      female_51_70: 1200,
      female_71_plus: 1200,
    },
    scalingType: 'fixed',
    minimum: 1000,
    maximum: 1300,
  },
  {
    key: 'iron_mg',
    label: 'Iron',
    unit: 'mg',
    values: {
      female_14_18: 15,
      female_19_30: 18,
      female_31_50: 18,
      female_51_70: 8,
      female_71_plus: 8,
    },
    scalingType: 'fixed',
    minimum: 8,
    maximum: 27,
  },
  {
    key: 'choline_mg',
    label: 'Choline',
    unit: 'mg',
    values: {
      female_14_18: 400,
      female_19_30: 425,
      female_31_50: 425,
      female_51_70: 425,
      female_71_plus: 425,
    },
    scalingType: 'fixed',
    minimum: 400,
    maximum: 550,
  },
  {
    key: 'vitamin_c_mg',
    label: 'Vitamin C',
    unit: 'mg',
    values: {
      female_14_18: 65,
      female_19_30: 75,
      female_31_50: 75,
      female_51_70: 75,
      female_71_plus: 75,
    },
    scalingType: 'fixed',
    minimum: 65,
    maximum: 120,
  },
  {
    key: 'vitamin_d_mcg',
    label: 'Vitamin D',
    unit: 'mcg',
    values: {
      female_14_18: 15,
      female_19_30: 15,
      female_31_50: 15,
      female_51_70: 15,
      female_71_plus: 20,
    },
    scalingType: 'fixed',
    minimum: 15,
    maximum: 20,
  },
]

function applyScaling({
  base,
  rule,
  calories,
}: {
  base: number
  rule: MicronutrientRule
  calories: number
}) {
  if (rule.scalingType === 'fixed') return base

  if (rule.scalingType === 'calorie_scaled' && rule.per1000Calories) {
    return rule.per1000Calories * (calories / 1000)
  }

  if (rule.scalingType === 'soft_scaled') {
    const scaleAbove = rule.scaleAboveCalories || 2200

    if (calories <= scaleAbove) return base

    const rawMultiplier = calories / scaleAbove
    const cappedMultiplier = Math.min(
      rawMultiplier,
      rule.maxScaleMultiplier || 1.25
    )

    return base * cappedMultiplier
  }

  return base
}

export function getMicronutrientTarget({
  rule,
  age,
  calories,
}: {
  rule: MicronutrientRule
  age: number
  calories: number
}) {
  const ageGroup = getFemaleAgeGroup(age)
  const base = rule.values[ageGroup]

  let target = applyScaling({
    base,
    rule,
    calories,
  })

  if (typeof rule.minimum === 'number') {
    target = Math.max(target, rule.minimum)
  }

  if (typeof rule.maximum === 'number') {
    target = Math.min(target, rule.maximum)
  }

  return Math.round(target)
}

export function generateMicronutrientTargets({
  age,
  calories,
}: {
  age: number
  calories: number
}) {
  return micronutrientRules.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.key] = getMicronutrientTarget({
      rule,
      age,
      calories,
    })

    return acc
  }, {})
}
