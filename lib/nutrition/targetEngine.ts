export const NUTRITION_FORMULA_VERSION = 'nutrition-target-v2.0.0'

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
} as const

export const GOAL_MODIFIERS = {
  weight_loss: 0.85,
  recomp: 1,
  bulk: 1.1,
} as const

export const DEFAULT_MACRO_PERCENTAGES = {
  weight_loss: { protein: 40, carbs: 30, fats: 30 },
  recomp: { protein: 30, carbs: 45, fats: 25 },
  bulk: { protein: 25, carbs: 50, fats: 25 },
} as const

// Safeguards are minimum adult targets, expressed as configurable nutrition policy.
export const MACRO_SAFEGUARDS = {
  proteinGPerKgLeanMass: {
    weight_loss: 2.2,
    recomp: 1.8,
    bulk: 1.6,
  },
  proteinGPerKgBodyWeightFallback: {
    weight_loss: 1.8,
    recomp: 1.6,
    bulk: 1.4,
  },
  minimumFatGramsAdultWomen: 50,
  minimumUsableWearableDays: 7,
  preferredWearableDays: 14,
  maximumHealthMetricAgeDays: 21,
  activeEnergyOutlierMultiplier: 2.5,
} as const

export type NormalizedNutritionGoal = 'weight_loss' | 'recomp' | 'bulk'
export type ActivityLevel = keyof typeof ACTIVITY_FACTORS
export type CalculationMode = 'assessment' | 'wearable'
export type CalculationStatus = 'estimated' | 'calibrating' | 'personalized' | 'manual_override'
export type MetabolicSex = 'male' | 'female'

export type WearableDayInput = {
  date: string
  activeEnergyKcal: number | null
  restingEnergyKcal?: number | null
  workoutEnergyKcal?: number | null
  steps?: number | null
  workoutType?: string | null
  workoutDurationMinutes?: number | null
  dataSource?: string | null
}

export type NutritionTargetInput = {
  age: number | null
  metabolicSex?: MetabolicSex | null
  heightCm: number | null
  weightKg: number | null
  bodyFatPercent?: number | null
  goalValue?: string | null
  assessedActivityLevel?: string | null
  trainingFrequencyDaysPerWeek?: number | null
  trainingDurationMinutes?: number | null
  wearableConnected?: boolean
  wearablePermissionDenied?: boolean
  wearableDays?: WearableDayInput[]
  manualOverride?: {
    calories: number
    protein: number
    carbs: number
    fats: number
    reason?: string | null
  } | null
  calculatedAt?: Date
}

export type NutritionTargetResult = {
  formulaVersion: string
  calculationMode: CalculationMode
  calculationStatus: CalculationStatus
  statusLabel: string
  statusDescription: string
  bmr: number
  estimatedTdee: number
  goalAdjustedCalories: number
  calories: number
  protein: number
  carbs: number
  fats: number
  proteinPercent: number
  carbsPercent: number
  fatsPercent: number
  bmi: number | null
  bodyFatPercentUsed: number | null
  leanBodyMassKg: number | null
  fatMassKg: number | null
  activityFactor: number | null
  rollingActiveEnergy: number | null
  rollingRestingEnergy: number | null
  rollingWearableTdee: number | null
  goalModifier: number
  normalizedGoal: NormalizedNutritionGoal
  defaultMacroPercentages: { protein: number; carbs: number; fats: number }
  finalMacroPercentages: { protein: number; carbs: number; fats: number }
  safeguardAdjusted: boolean
  safeguardsApplied: string[]
  dataDateRange: { start: string | null; end: string | null; usableDays: number }
  lastCalculatedAt: string
  inputs: {
    age: number | null
    metabolicSex: MetabolicSex
    heightCm: number | null
    weightKg: number | null
    goalValue: string | null
    assessedActivityLevel: ActivityLevel
    trainingFrequencyDaysPerWeek: number | null
    trainingDurationMinutes: number | null
  }
}

function round(value: number, places = 0) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function poundsToKg(weightLbs: number) {
  return weightLbs * 0.45359237
}

export function inchesToCm(heightIn: number) {
  return heightIn * 2.54
}

export function normalizeGoal(goalValue?: string | null): NormalizedNutritionGoal {
  const normalized = String(goalValue || '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')

  if (['fat_loss', 'weight_loss', 'lose_weight', 'cut'].includes(normalized)) return 'weight_loss'
  if (['muscle_building', 'muscle_gain', 'bulk', 'bulking', 'build_muscle'].includes(normalized)) return 'bulk'
  return 'recomp'
}

export function normalizeActivityLevel(value?: string | null, trainingDays?: number | null): ActivityLevel {
  const normalized = String(value || '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')

  if (normalized in ACTIVITY_FACTORS) return normalized as ActivityLevel
  if (['light', 'lightly', 'some_experience'].includes(normalized)) return 'lightly_active'
  if (['moderate', 'consistent'].includes(normalized)) return 'moderately_active'
  if (['high', 'advanced'].includes(normalized)) return 'very_active'

  const days = finiteNumber(trainingDays)
  if (days === null || days <= 1) return 'sedentary'
  if (days <= 3) return 'lightly_active'
  if (days <= 4) return 'moderately_active'
  if (days <= 5) return 'very_active'
  return 'extremely_active'
}

export function validBodyFatPercent(value?: number | null) {
  const percent = finiteNumber(value)
  return percent !== null && percent >= 5 && percent <= 60 ? percent : null
}

export function calculateBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null
  const heightM = heightCm / 100
  return round(weightKg / (heightM * heightM), 1)
}

export function calculateBodyComposition(weightKg: number | null, bodyFatPercent?: number | null) {
  const validPercent = validBodyFatPercent(bodyFatPercent)
  if (!weightKg || weightKg <= 0 || validPercent === null) {
    return { bodyFatPercentUsed: null, fatMassKg: null, leanBodyMassKg: null }
  }

  const fatMassKg = weightKg * (validPercent / 100)
  return {
    bodyFatPercentUsed: validPercent,
    fatMassKg,
    leanBodyMassKg: weightKg - fatMassKg,
  }
}

export function calculateRestingEnergy({
  age,
  metabolicSex,
  heightCm,
  weightKg,
  leanBodyMassKg,
}: {
  age: number | null
  metabolicSex: MetabolicSex
  heightCm: number | null
  weightKg: number | null
  leanBodyMassKg: number | null
}) {
  if (leanBodyMassKg && leanBodyMassKg > 0) {
    return 370 + 21.6 * leanBodyMassKg
  }

  if (!age || !heightCm || !weightKg) return 2000 / ACTIVITY_FACTORS.lightly_active
  const sexAdjustment = metabolicSex === 'male' ? 5 : -161
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment
}

function usableWearableDays(days: WearableDayInput[], calculatedAt: Date) {
  const todayTime = Date.UTC(
    calculatedAt.getUTCFullYear(),
    calculatedAt.getUTCMonth(),
    calculatedAt.getUTCDate(),
  )
  const byDate = new Map<string, WearableDayInput>()

  for (const day of days) {
    const activeEnergyKcal = finiteNumber(day.activeEnergyKcal)
    if (activeEnergyKcal === null || activeEnergyKcal <= 0) continue
    if (activeEnergyKcal > 3500) continue

    const date = new Date(`${day.date}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || date.getTime() > todayTime) continue
    const ageDays = (todayTime - date.getTime()) / 86400000
    if (ageDays < 1 || ageDays > MACRO_SAFEGUARDS.maximumHealthMetricAgeDays) continue

    const existing = byDate.get(day.date)
    if (!existing || activeEnergyKcal > Number(existing.activeEnergyKcal || 0)) {
      byDate.set(day.date, { ...day, activeEnergyKcal })
    }
  }

  const sorted = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 3) return sorted

  const activeValues = sorted.map((day) => Number(day.activeEnergyKcal || 0)).sort((a, b) => a - b)
  const median = activeValues[Math.floor(activeValues.length / 2)] || 0
  if (median <= 0) return sorted

  return sorted.filter(
    (day) => Number(day.activeEnergyKcal || 0) <= median * MACRO_SAFEGUARDS.activeEnergyOutlierMultiplier,
  )
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((total, value) => total + value, 0) / usable.length
}

function allocateMacros({
  calories,
  goal,
  weightKg,
  leanBodyMassKg,
}: {
  calories: number
  goal: NormalizedNutritionGoal
  weightKg: number | null
  leanBodyMassKg: number | null
}) {
  const template = DEFAULT_MACRO_PERCENTAGES[goal]
  let proteinCalories = calories * (template.protein / 100)
  let fatCalories = calories * (template.fats / 100)
  const safeguardsApplied: string[] = []

  const proteinFloorGrams = leanBodyMassKg
    ? leanBodyMassKg * MACRO_SAFEGUARDS.proteinGPerKgLeanMass[goal]
    : weightKg
      ? weightKg * MACRO_SAFEGUARDS.proteinGPerKgBodyWeightFallback[goal]
      : 0

  if (proteinCalories / 4 < proteinFloorGrams) {
    proteinCalories = proteinFloorGrams * 4
    safeguardsApplied.push('protein_floor')
  }

  if (fatCalories / 9 < MACRO_SAFEGUARDS.minimumFatGramsAdultWomen) {
    fatCalories = MACRO_SAFEGUARDS.minimumFatGramsAdultWomen * 9
    safeguardsApplied.push('fat_floor')
  }

  if (proteinCalories + fatCalories > calories) {
    const maxProteinCalories = Math.max(0, calories - fatCalories)
    proteinCalories = Math.min(proteinCalories, maxProteinCalories)
  }

  const carbCalories = Math.max(0, calories - proteinCalories - fatCalories)
  const finalProteinPercent = (proteinCalories / calories) * 100
  const finalCarbsPercent = (carbCalories / calories) * 100
  const finalFatsPercent = (fatCalories / calories) * 100

  return {
    proteinGrams: proteinCalories / 4,
    carbsGrams: carbCalories / 4,
    fatsGrams: fatCalories / 9,
    finalMacroPercentages: {
      protein: round(finalProteinPercent, 1),
      carbs: round(finalCarbsPercent, 1),
      fats: round(finalFatsPercent, 1),
    },
    safeguardsApplied,
  }
}

function statusFor(mode: CalculationMode, status: CalculationStatus) {
  if (status === 'manual_override') {
    return {
      statusLabel: 'Manually overridden target',
      statusDescription: 'Using the active manual nutrition target.',
    }
  }
  if (status === 'calibrating') {
    return {
      statusLabel: 'Calibrating to your activity',
      statusDescription: 'Your assessment target remains active while Anastasis learns your activity.',
    }
  }
  if (mode === 'wearable') {
    return {
      statusLabel: 'Wearable-informed nutrition target',
      statusDescription: 'Based on your recent connected activity data.',
    }
  }
  return {
    statusLabel: 'Estimated nutrition target',
    statusDescription: 'Based on your assessment until connected activity data is available.',
  }
}

export function calculateNutritionTargets(input: NutritionTargetInput): NutritionTargetResult {
  const calculatedAt = input.calculatedAt || new Date()
  const metabolicSex: MetabolicSex = input.metabolicSex === 'male' ? 'male' : 'female'
  const normalizedGoal = normalizeGoal(input.goalValue)
  const assessedActivityLevel = normalizeActivityLevel(
    input.assessedActivityLevel,
    input.trainingFrequencyDaysPerWeek,
  )
  const weightKg = input.weightKg && input.weightKg > 0 ? input.weightKg : null
  const heightCm = input.heightCm && input.heightCm > 0 ? input.heightCm : null
  const bmi = calculateBmi(weightKg, heightCm)
  const composition = calculateBodyComposition(weightKg, input.bodyFatPercent)
  const bmr = calculateRestingEnergy({
    age: input.age,
    metabolicSex,
    heightCm,
    weightKg,
    leanBodyMassKg: composition.leanBodyMassKg,
  })

  const activityFactor = ACTIVITY_FACTORS[assessedActivityLevel]
  const assessmentTdee = bmr * activityFactor
  const wearableDays = usableWearableDays(input.wearableDays || [], calculatedAt)
  const rollingWindow = wearableDays.slice(-MACRO_SAFEGUARDS.preferredWearableDays)
  const rollingActiveEnergy = average(rollingWindow.map((day) => finiteNumber(day.activeEnergyKcal)))
  const restingValues = rollingWindow.map((day) => finiteNumber(day.restingEnergyKcal)).filter((value) => value !== null && value > 0)
  const rollingRestingEnergy = average(restingValues)
  const hasEnoughWearableData =
    Boolean(input.wearableConnected) &&
    !input.wearablePermissionDenied &&
    wearableDays.length >= MACRO_SAFEGUARDS.minimumUsableWearableDays &&
    rollingActiveEnergy !== null

  const rollingWearableTdee = hasEnoughWearableData
    ? (rollingRestingEnergy ?? bmr) + Number(rollingActiveEnergy)
    : null

  const calculationMode: CalculationMode = hasEnoughWearableData ? 'wearable' : 'assessment'
  const calculationStatus: CalculationStatus =
    input.wearableConnected &&
    !input.wearablePermissionDenied &&
    wearableDays.length > 0 &&
    wearableDays.length < MACRO_SAFEGUARDS.minimumUsableWearableDays
      ? 'calibrating'
      : hasEnoughWearableData
        ? 'personalized'
        : 'estimated'

  const estimatedTdee = rollingWearableTdee ?? assessmentTdee
  const goalModifier = GOAL_MODIFIERS[normalizedGoal]
  const goalAdjustedCalories = estimatedTdee * goalModifier

  if (input.manualOverride) {
    const overrideCalories = round(input.manualOverride.calories)
    const protein = round(input.manualOverride.protein)
    const carbs = round(input.manualOverride.carbs)
    const fats = round(input.manualOverride.fats)
    const { statusLabel, statusDescription } = statusFor('assessment', 'manual_override')
    return {
      formulaVersion: NUTRITION_FORMULA_VERSION,
      calculationMode: 'assessment',
      calculationStatus: 'manual_override',
      statusLabel,
      statusDescription,
      bmr: round(bmr),
      estimatedTdee: round(estimatedTdee),
      goalAdjustedCalories: overrideCalories,
      calories: overrideCalories,
      protein,
      carbs,
      fats,
      proteinPercent: round(((protein * 4) / overrideCalories) * 100, 1),
      carbsPercent: round(((carbs * 4) / overrideCalories) * 100, 1),
      fatsPercent: round(((fats * 9) / overrideCalories) * 100, 1),
      bmi,
      bodyFatPercentUsed: composition.bodyFatPercentUsed,
      leanBodyMassKg: composition.leanBodyMassKg ? round(composition.leanBodyMassKg, 1) : null,
      fatMassKg: composition.fatMassKg ? round(composition.fatMassKg, 1) : null,
      activityFactor,
      rollingActiveEnergy: rollingActiveEnergy === null ? null : round(rollingActiveEnergy),
      rollingRestingEnergy: rollingRestingEnergy === null ? null : round(rollingRestingEnergy),
      rollingWearableTdee: rollingWearableTdee === null ? null : round(rollingWearableTdee),
      goalModifier,
      normalizedGoal,
      defaultMacroPercentages: DEFAULT_MACRO_PERCENTAGES[normalizedGoal],
      finalMacroPercentages: {
        protein: round(((protein * 4) / overrideCalories) * 100, 1),
        carbs: round(((carbs * 4) / overrideCalories) * 100, 1),
        fats: round(((fats * 9) / overrideCalories) * 100, 1),
      },
      safeguardAdjusted: false,
      safeguardsApplied: [],
      dataDateRange: {
        start: rollingWindow[0]?.date || null,
        end: rollingWindow[rollingWindow.length - 1]?.date || null,
        usableDays: wearableDays.length,
      },
      lastCalculatedAt: calculatedAt.toISOString(),
      inputs: {
        age: input.age,
        metabolicSex,
        heightCm,
        weightKg,
        goalValue: input.goalValue || null,
        assessedActivityLevel,
        trainingFrequencyDaysPerWeek: input.trainingFrequencyDaysPerWeek ?? null,
        trainingDurationMinutes: input.trainingDurationMinutes ?? null,
      },
    }
  }

  const roundedCalories = round(goalAdjustedCalories)
  const macroAllocation = allocateMacros({
    calories: goalAdjustedCalories,
    goal: normalizedGoal,
    weightKg,
    leanBodyMassKg: composition.leanBodyMassKg,
  })
  const { statusLabel, statusDescription } = statusFor(calculationMode, calculationStatus)

  return {
    formulaVersion: NUTRITION_FORMULA_VERSION,
    calculationMode,
    calculationStatus,
    statusLabel,
    statusDescription,
    bmr: round(bmr),
    estimatedTdee: round(estimatedTdee),
    goalAdjustedCalories: roundedCalories,
    calories: roundedCalories,
    protein: round(macroAllocation.proteinGrams),
    carbs: round(macroAllocation.carbsGrams),
    fats: round(macroAllocation.fatsGrams),
    proteinPercent: macroAllocation.finalMacroPercentages.protein,
    carbsPercent: macroAllocation.finalMacroPercentages.carbs,
    fatsPercent: macroAllocation.finalMacroPercentages.fats,
    bmi,
    bodyFatPercentUsed: composition.bodyFatPercentUsed,
    leanBodyMassKg: composition.leanBodyMassKg ? round(composition.leanBodyMassKg, 1) : null,
    fatMassKg: composition.fatMassKg ? round(composition.fatMassKg, 1) : null,
    activityFactor: calculationMode === 'assessment' ? activityFactor : null,
    rollingActiveEnergy: rollingActiveEnergy === null ? null : round(rollingActiveEnergy),
    rollingRestingEnergy: rollingRestingEnergy === null ? null : round(rollingRestingEnergy),
    rollingWearableTdee: rollingWearableTdee === null ? null : round(rollingWearableTdee),
    goalModifier,
    normalizedGoal,
    defaultMacroPercentages: DEFAULT_MACRO_PERCENTAGES[normalizedGoal],
    finalMacroPercentages: macroAllocation.finalMacroPercentages,
    safeguardAdjusted: macroAllocation.safeguardsApplied.length > 0,
    safeguardsApplied: macroAllocation.safeguardsApplied,
    dataDateRange: {
      start: rollingWindow[0]?.date || null,
      end: rollingWindow[rollingWindow.length - 1]?.date || null,
      usableDays: wearableDays.length,
    },
    lastCalculatedAt: calculatedAt.toISOString(),
    inputs: {
      age: input.age,
      metabolicSex,
      heightCm,
      weightKg,
      goalValue: input.goalValue || null,
      assessedActivityLevel,
      trainingFrequencyDaysPerWeek: input.trainingFrequencyDaysPerWeek ?? null,
      trainingDurationMinutes: input.trainingDurationMinutes ?? null,
    },
  }
}
