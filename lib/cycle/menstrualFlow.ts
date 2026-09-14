export const MENSTRUAL_FLOW_BURDEN_VERSION = 'menstrual_flow_burden_v1.0.0'

export type MenstrualProductType =
  | 'tampon'
  | 'pad'
  | 'cup'
  | 'disc'
  | 'period_underwear'
  | 'other'

export type MenstrualProductAbsorbency =
  | 'light'
  | 'regular'
  | 'super'
  | 'super_plus'
  | 'ultra'
  | 'heavy'
  | 'overnight'
  | 'moderate'
  | 'custom'

export type SaturationLevel = '25' | '50' | '75' | '100' | 'overflow'

export type MenstrualProductLogInput = {
  productType: MenstrualProductType
  absorbency?: MenstrualProductAbsorbency | null
  quantity?: number | null
  saturation?: SaturationLevel | null
  estimatedMl?: number | null
  empties?: number | null
  capacityMl?: number | null
  fullness?: '25' | '50' | '75' | '100' | 'overflow' | null
  changeIntervalHours?: number | null
  leakOrOverflow?: boolean | null
  customLabel?: string | null
}

export type CycleDailySymptomInput = {
  energy?: number | null
  fatigue?: number | string | null
  perceivedRecovery?: number | null
  trainingReadiness?: number | null
  symptoms?: Record<string, string | number | boolean | null | undefined>
}

export type MenstrualFlowBurdenResult = {
  algorithmVersion: string
  burdenScore: number
  burdenBand: 'none' | 'light' | 'moderate' | 'high' | 'very_high'
  productCount: number
  overflowEvents: number
  fullySaturatedHighAbsorbencyCount: number
  frequentChangeEvents: number
  recordedFluidMl: number | null
  factors: string[]
}

const disposableBaseBurden: Record<string, number> = {
  tampon_light: 0.8,
  tampon_regular: 1.2,
  tampon_super: 1.8,
  tampon_super_plus: 2.3,
  tampon_ultra: 2.8,
  pad_light: 0.8,
  pad_regular: 1.3,
  pad_heavy: 2.0,
  pad_overnight: 2.5,
  period_underwear_light: 0.9,
  period_underwear_moderate: 1.5,
  period_underwear_heavy: 2.2,
  period_underwear_overnight: 2.8,
  other_custom: 1.2,
}

const saturationMultiplier: Record<string, number> = {
  '25': 0.35,
  '50': 0.65,
  '75': 0.9,
  '100': 1.15,
  overflow: 1.45,
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round(value: number, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function normalizedAbsorbency(product: MenstrualProductLogInput) {
  if (product.absorbency) return product.absorbency
  if (product.productType === 'period_underwear') return 'moderate'
  if (product.productType === 'other') return 'custom'
  return 'regular'
}

function isDisposableLike(productType: MenstrualProductType) {
  return ['tampon', 'pad', 'period_underwear', 'other'].includes(productType)
}

function bandFromScore(score: number): MenstrualFlowBurdenResult['burdenBand'] {
  if (score <= 0) return 'none'
  if (score < 4) return 'light'
  if (score < 8) return 'moderate'
  if (score < 13) return 'high'
  return 'very_high'
}

export function calculateDailyMenstrualFlowBurden({
  products,
}: {
  products: MenstrualProductLogInput[]
}): MenstrualFlowBurdenResult {
  let burdenScore = 0
  let productCount = 0
  let overflowEvents = 0
  let fullySaturatedHighAbsorbencyCount = 0
  let frequentChangeEvents = 0
  let recordedFluidMl = 0
  let hasRecordedFluid = false
  const factors = new Set<string>()

  for (const product of products) {
    const quantity = clamp(Math.round(numeric(product.quantity, 1) || 1), 1, 40)
    productCount += quantity

    const hasOverflow =
      product.saturation === 'overflow' ||
      product.fullness === 'overflow' ||
      Boolean(product.leakOrOverflow)

    if (hasOverflow) {
      overflowEvents += quantity
      factors.add('overflow_or_leak')
    }

    const interval = numeric(product.changeIntervalHours, 0)
    if (interval > 0 && interval <= 2) {
      frequentChangeEvents += quantity
      factors.add('frequent_changes')
    }

    if (product.productType === 'cup' || product.productType === 'disc') {
      const empties = clamp(Math.round(numeric(product.empties, quantity) || quantity), 1, 30)
      const knownMl = numeric(product.estimatedMl, 0)
      const capacityMl = numeric(product.capacityMl, 0)
      const fullness = product.fullness && product.fullness !== 'overflow'
        ? numeric(product.fullness, 0) / 100
        : product.fullness === 'overflow'
          ? 1
          : 0
      const inferredMl = knownMl > 0
        ? knownMl
        : capacityMl > 0 && fullness > 0
          ? capacityMl * fullness * empties
          : 0

      if (inferredMl > 0) {
        hasRecordedFluid = true
        recordedFluidMl += inferredMl
        burdenScore += clamp(inferredMl / 7, 0.5, 16)
        factors.add('recorded_cup_or_disc_volume')
      } else {
        burdenScore += empties * (product.productType === 'cup' ? 1.8 : 1.5)
        factors.add('cup_or_disc_empty_count')
      }

      if (hasOverflow) burdenScore += 1.6 * quantity
      if (interval > 0 && interval <= 2) burdenScore += 1.1 * quantity
      continue
    }

    if (isDisposableLike(product.productType)) {
      const absorbency = normalizedAbsorbency(product)
      const key = `${product.productType}_${absorbency}`
      const base = disposableBaseBurden[key] ?? disposableBaseBurden.other_custom
      const saturation = saturationMultiplier[product.saturation || '75'] ?? 0.9
      const productBurden = base * saturation * quantity
      burdenScore += productBurden
      factors.add(`${product.productType}_${absorbency}`)

      if (
        ['super', 'super_plus', 'ultra', 'heavy', 'overnight'].includes(absorbency) &&
        (product.saturation === '100' || product.saturation === 'overflow')
      ) {
        fullySaturatedHighAbsorbencyCount += quantity
        factors.add('fully_saturated_high_absorbency')
      }

      if (hasOverflow) burdenScore += 1.4 * quantity
      if (interval > 0 && interval <= 2) burdenScore += 0.9 * quantity
    }
  }

  const finalScore = round(clamp(burdenScore, 0, 40))

  return {
    algorithmVersion: MENSTRUAL_FLOW_BURDEN_VERSION,
    burdenScore: finalScore,
    burdenBand: bandFromScore(finalScore),
    productCount,
    overflowEvents,
    fullySaturatedHighAbsorbencyCount,
    frequentChangeEvents,
    recordedFluidMl: hasRecordedFluid ? round(recordedFluidMl, 1) : null,
    factors: Array.from(factors).sort(),
  }
}

export type CycleBurdenTrend = {
  algorithmVersion: string
  cyclesAnalyzed: number
  typicalHighestFlowDays: number[]
  heavyFlowWindowDays: number
  energyFallsOnHighFlowDays: boolean
  readinessFallsOnHighFlowDays: boolean
  headacheWindowDays: number[]
  baselineScore: number | null
  latestCycleDeviation: 'increased' | 'decreased' | 'stable' | 'insufficient_data'
  anticipatoryWindow: { startOffsetDays: number; cycleDays: number[] } | null
  observations: string[]
}

type BurdenTrendInput = {
  cycleIndex?: number | string | null
  cycleDay?: number | string | null
  burdenScore?: number | string | null
  burdenBand?: string | null
  energy?: number | string | null
  trainingReadiness?: number | string | null
  symptoms?: Record<string, unknown> | null
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

export function analyzeCycleBurdenTrends(rows: BurdenTrendInput[]): CycleBurdenTrend {
  const valid = rows
    .map((row) => ({
      cycleIndex: numeric(row.cycleIndex, 0),
      cycleDay: numeric(row.cycleDay, 0),
      burdenScore: numeric(row.burdenScore, 0),
      energy: Number.isFinite(Number(row.energy)) ? Number(row.energy) : null,
      trainingReadiness: Number.isFinite(Number(row.trainingReadiness)) ? Number(row.trainingReadiness) : null,
      symptoms: row.symptoms || {},
    }))
    .filter((row) => row.cycleIndex > 0 && row.cycleDay > 0)

  const cycles = Array.from(new Set(valid.map((row) => row.cycleIndex)))
  const observations: string[] = []

  if (cycles.length < 2 || valid.length < 4) {
    return {
      algorithmVersion: MENSTRUAL_FLOW_BURDEN_VERSION,
      cyclesAnalyzed: cycles.length,
      typicalHighestFlowDays: [],
      heavyFlowWindowDays: 0,
      energyFallsOnHighFlowDays: false,
      readinessFallsOnHighFlowDays: false,
      headacheWindowDays: [],
      baselineScore: null,
      latestCycleDeviation: 'insufficient_data',
      anticipatoryWindow: null,
      observations: ['More cycle history is needed before recurring burden patterns are identified.'],
    }
  }

  const byCycleDay = new Map<number, number[]>()
  for (const row of valid) {
    const values = byCycleDay.get(row.cycleDay) || []
    values.push(row.burdenScore)
    byCycleDay.set(row.cycleDay, values)
  }

  const dayAverages = Array.from(byCycleDay.entries())
    .map(([cycleDay, scores]) => ({ cycleDay, averageScore: average(scores) || 0 }))
    .sort((a, b) => b.averageScore - a.averageScore)

  const highestAverage = dayAverages[0]?.averageScore || 0
  const typicalHighestFlowDays = dayAverages
    .filter((day) => highestAverage > 0 && day.averageScore >= highestAverage * 0.8)
    .map((day) => day.cycleDay)
    .sort((a, b) => a - b)

  const heavyFlowWindowDays = dayAverages.filter((day) => day.averageScore >= 8).length
  const highFlowRows = valid.filter((row) => row.burdenScore >= 8)
  const lowerFlowRows = valid.filter((row) => row.burdenScore > 0 && row.burdenScore < 8)
  const highEnergy = average(highFlowRows.map((row) => row.energy).filter((value): value is number => value !== null))
  const lowerEnergy = average(lowerFlowRows.map((row) => row.energy).filter((value): value is number => value !== null))
  const highReadiness = average(highFlowRows.map((row) => row.trainingReadiness).filter((value): value is number => value !== null))
  const lowerReadiness = average(lowerFlowRows.map((row) => row.trainingReadiness).filter((value): value is number => value !== null))
  const energyFallsOnHighFlowDays = highEnergy !== null && lowerEnergy !== null && highEnergy <= lowerEnergy - 1
  const readinessFallsOnHighFlowDays = highReadiness !== null && lowerReadiness !== null && highReadiness <= lowerReadiness - 1

  const headacheCounts = new Map<number, number>()
  for (const row of valid) {
    const headache = row.symptoms.headache || row.symptoms.migraine
    if (headache && headache !== 'none' && headache !== false) {
      headacheCounts.set(row.cycleDay, (headacheCounts.get(row.cycleDay) || 0) + 1)
    }
  }
  const headacheWindowDays = Array.from(headacheCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([cycleDay]) => cycleDay)
    .sort((a, b) => a - b)

  const cycleAverages = cycles
    .map((cycleIndex) => ({
      cycleIndex,
      averageScore: average(valid.filter((row) => row.cycleIndex === cycleIndex).map((row) => row.burdenScore)) || 0,
    }))
    .sort((a, b) => a.cycleIndex - b.cycleIndex)
  const latest = cycleAverages[cycleAverages.length - 1]
  const prior = cycleAverages.slice(0, -1).map((row) => row.averageScore)
  const baselineScore = average(prior)
  const deviation =
    baselineScore === null
      ? 'insufficient_data'
      : latest.averageScore >= baselineScore + 2.5
        ? 'increased'
        : latest.averageScore <= baselineScore - 2.5
          ? 'decreased'
          : 'stable'

  if (typicalHighestFlowDays.length) {
    observations.push(`Cycle Days ${typicalHighestFlowDays.join('-')} consistently show the highest flow burden.`)
  }
  if (energyFallsOnHighFlowDays) {
    observations.push('High menstrual flow burden repeatedly coincides with lower energy.')
  }
  if (readinessFallsOnHighFlowDays) {
    observations.push('Training readiness repeatedly falls during the high-flow window.')
  }
  if (deviation === 'increased') {
    observations.push('Recent flow burden is higher than this user baseline.')
  }
  if (deviation === 'decreased') {
    observations.push('Recent flow burden is lower than this user baseline.')
  }

  return {
    algorithmVersion: MENSTRUAL_FLOW_BURDEN_VERSION,
    cyclesAnalyzed: cycles.length,
    typicalHighestFlowDays,
    heavyFlowWindowDays,
    energyFallsOnHighFlowDays,
    readinessFallsOnHighFlowDays,
    headacheWindowDays,
    baselineScore: baselineScore === null ? null : round(baselineScore),
    latestCycleDeviation: deviation,
    anticipatoryWindow: typicalHighestFlowDays.length
      ? { startOffsetDays: 2, cycleDays: typicalHighestFlowDays }
      : null,
    observations,
  }
}
