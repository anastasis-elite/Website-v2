export type CapacityName =
  | 'temperance'
  | 'diligence'
  | 'patience'
  | 'kindness'
  | 'generosity'
  | 'selfControl'
  | 'humility'

export type CapacityState = 'deficient' | 'balanced' | 'excessive'

export type CapacityEvaluation = {
  capacity: CapacityName
  state: CapacityState
  confidence: number
  reasons: string[]
}

export type ResilienceOverallState =
  | 'thriving'
  | 'stable'
  | 'strained'
  | 'depleted'
  | 'uncertain'

export type PhysicalStateInterpretation = {
  recovery?: string
  energy?: string
  fueling?: string
  hydration?: string
  activity?: string
  stressLoad?: string
  scheduleLoad?: string
}

export type ResilienceEvaluation = {
  overallState: ResilienceOverallState
  primaryCapacity?: CapacityEvaluation
  secondaryCapacity?: CapacityEvaluation
  physicalState: PhysicalStateInterpretation
  recommendations: string[]
  priority:
    | 'safety'
    | 'recovery'
    | 'fueling'
    | 'hydration'
    | 'excessive_load'
    | 'training'
    | 'schedule_protection'
    | 'normal_return'
    | 'optimization'
    | 'conservative'
}

export type ResilienceEngineInput = {
  sleepHours?: number | null
  sleepQuality?: number | null
  hrv?: number | null
  restingHeartRate?: number | null
  respiratoryRate?: number | null
  bodyTemperature?: number | null
  energy?: number | null
  stress?: number | null
  soreness?: number | null
  symptomSeverity?: 'none' | 'mild' | 'moderate' | 'severe' | null
  symptomRedFlag?: boolean
  recoveryRequired?: boolean
  recoveryStatus?: string | null
  fuelStatus?: string | null
  hydrationStatus?: string | null
  hydrationPercent?: number | null
  calories?: MacroSignal
  protein?: MacroSignal
  carbs?: MacroSignal
  fats?: MacroSignal
  workoutMinutes?: number | null
  steps?: number | null
  activeEnergy?: number | null
  hasWorkoutToday?: boolean
  workoutComplete?: boolean
  missedWorkoutYesterday?: boolean
  missedDayCount?: number | null
  scheduleDensity?: 'open' | 'steady' | 'packed'
  openWindowMinutes?: number
  nextActionCategory?: string
  canTrain?: boolean
  workoutAdjustmentLevel?: string | null
  allowLoadProgression?: boolean
  allowEnduranceProgression?: boolean
}

export type MacroSignal = {
  target?: number | null
  consumed?: number | null
  remaining?: number | null
  percent?: number | null
}

type CandidateEvaluation = CapacityEvaluation & { priorityWeight: number }

function knownNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clampConfidence(value: number) {
  return Math.max(0.1, Math.min(0.95, Number(value.toFixed(2))))
}

function macroPercent(signal?: MacroSignal) {
  if (!signal) return null
  if (knownNumber(signal.percent)) return signal.percent
  if (knownNumber(signal.target) && signal.target > 0 && knownNumber(signal.consumed)) {
    return (signal.consumed / signal.target) * 100
  }
  if (knownNumber(signal.target) && signal.target > 0 && knownNumber(signal.remaining)) {
    return ((signal.target - signal.remaining) / signal.target) * 100
  }
  return null
}

function evidenceCount(input: ResilienceEngineInput) {
  return [
    input.sleepHours,
    input.sleepQuality,
    input.hrv,
    input.restingHeartRate,
    input.energy,
    input.stress,
    input.soreness,
    input.hydrationPercent,
    input.workoutMinutes,
    input.steps,
    input.activeEnergy,
    macroPercent(input.calories),
    macroPercent(input.protein),
    macroPercent(input.carbs),
  ].filter(knownNumber).length
}

function isPoorSleep(input: ResilienceEngineInput) {
  return (
    (knownNumber(input.sleepHours) && input.sleepHours < 6) ||
    (knownNumber(input.sleepQuality) && input.sleepQuality <= 4)
  )
}

function isStrongSleep(input: ResilienceEngineInput) {
  return (
    (knownNumber(input.sleepHours) && input.sleepHours >= 7) ||
    (knownNumber(input.sleepQuality) && input.sleepQuality >= 7)
  )
}

function isLowRecovery(input: ResilienceEngineInput) {
  return Boolean(
    input.recoveryRequired ||
      input.recoveryStatus === 'active_recovery' ||
      input.recoveryStatus === 'modify_workout' ||
      input.recoveryStatus === 'full_recovery_or_red_flag' ||
      (input.symptomSeverity === 'moderate' && input.canTrain === false) ||
      input.workoutAdjustmentLevel === 'level_3_recovery_training' ||
      input.workoutAdjustmentLevel === 'level_4_rest_or_red_flag' ||
      isPoorSleep(input) ||
      (knownNumber(input.hrv) && input.hrv < 35) ||
      (knownNumber(input.restingHeartRate) && input.restingHeartRate >= 85) ||
      (knownNumber(input.energy) && input.energy <= 3) ||
      (knownNumber(input.soreness) && input.soreness >= 7),
  )
}

function isReady(input: ResilienceEngineInput) {
  return Boolean(
    isStrongSleep(input) &&
      !isLowRecovery(input) &&
      (input.recoveryStatus === 'push_day' ||
        input.recoveryStatus === 'normal_training_day' ||
        input.recoveryStatus == null) &&
      (input.fuelStatus === 'well_fueled' ||
        input.fuelStatus === 'slightly_under_fueled' ||
        input.fuelStatus == null) &&
      (!knownNumber(input.energy) || input.energy >= 6) &&
      (!knownNumber(input.soreness) || input.soreness <= 4) &&
      input.symptomSeverity !== 'moderate' &&
      input.symptomSeverity !== 'severe' &&
      !input.symptomRedFlag,
  )
}

function highActivity(input: ResilienceEngineInput) {
  return Boolean(
    (knownNumber(input.workoutMinutes) && input.workoutMinutes >= 70) ||
      (knownNumber(input.steps) && input.steps >= 14000) ||
      (knownNumber(input.activeEnergy) && input.activeEnergy >= 700),
  )
}

function lowActivity(input: ResilienceEngineInput) {
  const hasSteps = knownNumber(input.steps)
  const hasWorkout = knownNumber(input.workoutMinutes)
  if (!hasSteps && !hasWorkout) return false
  if (hasSteps && hasWorkout) {
    return Number(input.steps) < 3500 && Number(input.workoutMinutes) < 10
  }
  if (hasSteps) return Number(input.steps) < 2000
  return Number(input.workoutMinutes) === 0 && input.hasWorkoutToday === true
}

function underFueled(input: ResilienceEngineInput) {
  const calories = macroPercent(input.calories)
  const protein = macroPercent(input.protein)
  const carbs = macroPercent(input.carbs)
  return Boolean(
    input.fuelStatus === 'under_fueled' ||
      input.fuelStatus === 'depleted' ||
      (knownNumber(calories) && calories < 65) ||
      (highActivity(input) &&
        ((knownNumber(calories) && calories < 75) ||
          (knownNumber(protein) && protein < 65) ||
          (knownNumber(carbs) && carbs < 55))),
  )
}

function lowHydration(input: ResilienceEngineInput) {
  return Boolean(
    input.hydrationStatus === 'low' ||
      (knownNumber(input.hydrationPercent) && input.hydrationPercent < 55),
  )
}

function capacity(
  capacityName: CapacityName,
  state: CapacityState,
  confidence: number,
  reasons: string[],
  priorityWeight: number,
): CandidateEvaluation {
  return {
    capacity: capacityName,
    state,
    confidence: clampConfidence(confidence),
    reasons,
    priorityWeight,
  }
}

function balancedCapacity(capacityName: CapacityName, reasons: string[]): CandidateEvaluation {
  return capacity(capacityName, 'balanced', 0.45, reasons, 1)
}

function rankCapacityCandidates(candidates: CandidateEvaluation[]) {
  return [...candidates]
    .sort((a, b) => b.priorityWeight + b.confidence - (a.priorityWeight + a.confidence))
    .map((evaluation) => ({
      capacity: evaluation.capacity,
      state: evaluation.state,
      confidence: evaluation.confidence,
      reasons: evaluation.reasons,
    }))
}

function interpretPhysicalState(input: ResilienceEngineInput): PhysicalStateInterpretation {
  const state: PhysicalStateInterpretation = {}

  if (
    input.symptomRedFlag ||
    input.symptomSeverity === 'severe' ||
    input.recoveryStatus === 'full_recovery_or_red_flag'
  ) {
    state.recovery = 'clear recovery or safety flag'
  } else if (isLowRecovery(input)) {
    state.recovery = 'recovery capacity is reduced'
  } else if (isReady(input)) {
    state.recovery = 'recovery signals support normal progression'
  }

  if (knownNumber(input.energy)) {
    state.energy = input.energy <= 3 ? 'low energy' : input.energy >= 7 ? 'strong energy' : 'moderate energy'
  }

  if (underFueled(input)) {
    state.fueling = 'fueling appears below current demand'
  } else if (input.fuelStatus === 'well_fueled') {
    state.fueling = 'fueling is sufficient for the current plan'
  }

  if (lowHydration(input)) {
    state.hydration = 'hydration is below target'
  } else if (input.hydrationStatus === 'ready' || (knownNumber(input.hydrationPercent) && input.hydrationPercent >= 80)) {
    state.hydration = 'hydration is supportive'
  }

  if (highActivity(input)) state.activity = 'activity load is high'
  else if (lowActivity(input)) state.activity = 'activity is below normal training stimulus'

  if (knownNumber(input.stress)) {
    state.stressLoad = input.stress >= 8 ? 'stress load is high' : input.stress <= 4 ? 'stress load is manageable' : 'stress load is moderate'
  }

  if (input.scheduleDensity) {
    state.scheduleLoad =
      input.scheduleDensity === 'packed'
        ? 'schedule load is high'
        : input.scheduleDensity === 'steady'
          ? 'schedule load is steady'
          : 'schedule has usable space'
  }

  return state
}

function evaluateCapacities(input: ResilienceEngineInput): CandidateEvaluation[] {
  const candidates: CandidateEvaluation[] = []
  const recoveryLow = isLowRecovery(input)
  const ready = isReady(input)
  const activityHigh = highActivity(input)
  const activityLow = lowActivity(input)
  const fuelingLow = underFueled(input)
  const hydrationLow = lowHydration(input)
  const sleepPoor = isPoorSleep(input)
  const stressHigh = knownNumber(input.stress) && input.stress >= 8
  const schedulePacked = input.scheduleDensity === 'packed'

  if ((activityHigh && recoveryLow) || (input.hasWorkoutToday && input.canTrain === false)) {
    candidates.push(capacity('diligence', 'excessive', 0.82, ['Training load conflicts with current recovery signals.'], 8))
    candidates.push(capacity('patience', 'deficient', 0.78, ['Adaptation needs recovery before more intensity.'], 7))
    candidates.push(capacity('temperance', 'deficient', 0.7, ['Current stress output is high relative to recovery capacity.'], 6))
  } else if (ready && activityLow) {
    candidates.push(capacity('diligence', 'deficient', 0.74, ['Recovery looks ready while movement remains low.'], 5))
    candidates.push(capacity('humility', 'excessive', 0.48, ['Readiness signals support more capability than today has used so far.'], 2))
  }

  if (fuelingLow && activityHigh) {
    candidates.push(capacity('temperance', 'excessive', 0.84, ['Intake is low relative to activity demand.'], 8))
    candidates.push(capacity('selfControl', 'excessive', 0.58, ['Strict adherence may be reducing flexibility around fueling needs.'], 4))
  } else if (fuelingLow) {
    candidates.push(capacity('temperance', 'excessive', 0.68, ['Fuel intake appears below what recovery needs.'], 6))
  }

  if (hydrationLow) {
    candidates.push(capacity('temperance', 'deficient', 0.7, ['Hydration is below the support needed for recovery and training.'], 6))
  }

  if (sleepPoor) {
    candidates.push(capacity('patience', 'deficient', 0.72, ['Poor sleep lowers tolerance for added training and nutrition pressure.'], 7))
    candidates.push(capacity('selfControl', 'deficient', 0.42, ['Low sleep can increase decision risk around food and training.'], 2))
  }

  if (schedulePacked && (sleepPoor || stressHigh || recoveryLow)) {
    candidates.push(capacity('generosity', 'excessive', 0.46, ['Schedule demand is high while recovery or stress signals are strained.'], 8))
  }

  if (input.missedWorkoutYesterday && ready) {
    candidates.push(capacity('kindness', 'balanced', 0.54, ['A missed workout does not need compensation when physiology is normal.'], 4))
    candidates.push(capacity('diligence', 'balanced', 0.52, ['Return to the normal plan instead of stacking extra work.'], 4))
  }

  if (
    (input.symptomRedFlag || input.symptomSeverity === 'moderate' || input.symptomSeverity === 'severe') &&
    input.canTrain !== true
  ) {
    candidates.push(capacity('humility', 'deficient', 0.72, ['Body signals support reducing training demand today.'], 9))
  } else if (ready && (input.allowLoadProgression || input.allowEnduranceProgression)) {
    candidates.push(capacity('humility', 'balanced', 0.56, ['Readiness signals support respecting both capacity and progression.'], 3))
  }

  if (!candidates.length && evidenceCount(input) >= 4) {
    candidates.push(balancedCapacity('temperance', ['No major extremes are visible in the available physical signals.']))
    candidates.push(balancedCapacity('diligence', ['Available signals support the existing plan without extra pressure.']))
  }

  return candidates
}

function resolvePriority(input: ResilienceEngineInput) {
  const recoveryLow = isLowRecovery(input)
  const ready = isReady(input)

  if (
    input.symptomRedFlag ||
    input.symptomSeverity === 'severe' ||
    input.recoveryStatus === 'full_recovery_or_red_flag'
  ) {
    return {
      priority: 'safety' as const,
      recommendation: 'Follow the existing safety or recovery guidance before adding training stress.',
    }
  }

  if (underFueled(input)) {
    return {
      priority: 'fueling' as const,
      recommendation: 'Fueling is the highest-value intervention before adding more intensity.',
    }
  }

  if (lowHydration(input)) {
    return {
      priority: 'hydration' as const,
      recommendation: 'Stabilize hydration before asking for more output.',
    }
  }

  if (input.scheduleDensity === 'packed' && (knownNumber(input.stress) && input.stress >= 8)) {
    return {
      priority: 'schedule_protection' as const,
      recommendation: 'Protect capacity in the calendar instead of adding an optional task.',
    }
  }

  if (recoveryLow && highActivity(input)) {
    return {
      priority: 'recovery' as const,
      recommendation: 'Prioritize recovery over another hard session while load and recovery are in conflict.',
    }
  }

  if (recoveryLow) {
    return {
      priority: 'recovery' as const,
      recommendation: 'Reduce pressure and support recovery before progressing the plan.',
    }
  }

  if (input.missedWorkoutYesterday && ready) {
    return {
      priority: 'normal_return' as const,
      recommendation: 'Return to the normal plan without punishment or compensation.',
    }
  }

  if (ready && lowActivity(input)) {
    return {
      priority: 'training' as const,
      recommendation: 'Use the available readiness for normal movement or training stimulus.',
    }
  }

  if (ready) {
    return {
      priority: 'optimization' as const,
      recommendation: 'Proceed with the current plan and progress only within clean recovery signals.',
    }
  }

  return {
    priority: 'conservative' as const,
    recommendation: 'Use a conservative next action because available signals are limited or mixed.',
  }
}

function resolveOverallState(input: ResilienceEngineInput): ResilienceOverallState {
  const count = evidenceCount(input)
  if (count < 2) return 'uncertain'

  if (
    input.symptomRedFlag ||
    input.symptomSeverity === 'severe' ||
    input.recoveryStatus === 'full_recovery_or_red_flag' ||
    ((isPoorSleep(input) || knownNumber(input.hrv) && input.hrv < 35) &&
      (knownNumber(input.energy) && input.energy <= 3) &&
      (knownNumber(input.soreness) && input.soreness >= 7))
  ) {
    return 'depleted'
  }

  if (
    isLowRecovery(input) ||
    underFueled(input) ||
    lowHydration(input) ||
    (input.scheduleDensity === 'packed' && knownNumber(input.stress) && input.stress >= 8)
  ) {
    return 'strained'
  }

  if (
    isReady(input) &&
    (input.fuelStatus === 'well_fueled' || input.fuelStatus == null) &&
    !lowHydration(input) &&
    (!knownNumber(input.stress) || input.stress <= 5)
  ) {
    return 'thriving'
  }

  return 'stable'
}

export function evaluateResilience(input: ResilienceEngineInput): ResilienceEvaluation {
  const ranked = rankCapacityCandidates(evaluateCapacities(input))
  const resolved = resolvePriority(input)

  return {
    overallState: resolveOverallState(input),
    primaryCapacity: ranked[0],
    secondaryCapacity: ranked[1],
    physicalState: interpretPhysicalState(input),
    recommendations: [resolved.recommendation],
    priority: resolved.priority,
  }
}
