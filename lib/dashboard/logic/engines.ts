import type {
  CapacityResult, CycleResult, FlameResult, FuelReadinessResult,
  HydrationResult, NutritionResult, PostureResult, ProgramLogicInputs,
  RecoveryResult, SymptomResult, WorkoutDecisionResult,
} from './types'

export function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function nullableNumeric(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))) }

function recoverySignals(inputs: ProgramLogicInputs) {
  const log = inputs.todayRecovery || {}
  return {
    sleepHours: nullableNumeric(log.sleep_hours ?? log.sleep_duration_hours),
    sleepQuality: nullableNumeric(log.sleep_quality),
    stress: nullableNumeric(log.stress_level),
    soreness: nullableNumeric(log.soreness_level),
    energy: nullableNumeric(log.energy_level),
    hunger: nullableNumeric(log.hunger_level),
    sick: Boolean(log.sick), dizzy: Boolean(log.dizzy),
    unusuallyFatigued: Boolean(log.unusually_fatigued),
  }
}

export function runSymptomEngine(inputs: ProgramLogicInputs): SymptomResult {
  const today = inputs.todaySymptoms || []
  const severities = today.map((item) => numeric(item.severity)).filter(Boolean)
  const maxSeverity = severities.length ? Math.max(...severities) : 0
  const names = today.map((item) => String(item.symptom_types?.name || item.symptom_name || item.analysis_note || '').toLowerCase())
  const redFlagPatterns = ['chest pain', 'faint', 'severe shortness', 'suicidal', 'severe bleeding', 'acute injury']
  const redFlag = maxSeverity >= 9 || names.some((name) => redFlagPatterns.some((pattern) => name.includes(pattern)))
  const clusters = Array.from(new Set(today.map((item) => String(item.symptom_types?.category || 'general'))))
  const possibleIntolerance = today.some((item) => item.likely_food_related) && inputs.recentSymptoms.filter((item) => item.likely_food_related).length >= 2
  const severity = redFlag || maxSeverity >= 8 ? 'severe' : maxSeverity >= 5 ? 'moderate' : maxSeverity > 0 ? 'mild' : 'none'
  return {
    severity, clusters, possibleIntolerance, redFlag,
    workoutModification: severity === 'severe' ? 'Replace performance training with recovery movement pending safety review.' : severity === 'moderate' ? 'Reduce intensity and avoid symptom-provoking movements.' : null,
    recoveryRecommendation: redFlag ? 'Stop training and seek appropriate medical or emergency support.' : severity === 'none' ? 'Use the normal recovery plan.' : 'Keep movement gentle enough that symptoms do not increase.',
    trendInsight: possibleIntolerance ? 'Repeated food-linked symptoms need a closer review before assuming a specific intolerance.' : null,
  }
}

export function runCapacityEngine(inputs: ProgramLogicInputs, symptoms: SymptomResult): CapacityResult {
  const signals = recoverySignals(inputs)
  let score = 72
  const drivers: string[] = []
  const baseline = String(inputs.client.capacity_state || inputs.client.capacity || '').toLowerCase()
  if (baseline === 'high' || baseline === 'energized') score += 10
  if (baseline === 'low' || baseline === 'depleted') score -= 10
  if (signals.sleepHours !== null && signals.sleepHours < 6) { score -= 18; drivers.push('short sleep') }
  if (signals.sleepQuality !== null && signals.sleepQuality <= 4) { score -= 14; drivers.push('low sleep quality') }
  if (signals.energy !== null && signals.energy <= 3) { score -= 20; drivers.push('low energy') }
  if (signals.stress !== null && signals.stress >= 8) { score -= 10; drivers.push('high stress') }
  if (signals.soreness !== null && signals.soreness >= 8) { score -= 12; drivers.push('high soreness') }
  if (symptoms.severity === 'moderate') { score -= 15; drivers.push('symptoms') }
  if (symptoms.severity === 'severe') { score -= 35; drivers.push('severe symptoms') }
  if (!inputs.yesterday.workoutComplete && !inputs.yesterday.nutritionLogged) { score -= 8; drivers.push('yesterday was incomplete') }
  if (['too_much_today','not_feeling_workout'].includes(inputs.todayWorkoutFeedback?.response)) { score -= 8; drivers.push('workout feedback') }
  const recentCompleted = inputs.workoutHistory.filter((row) => row.completed).length
  if (recentCompleted >= 4 && (signals.energy || 0) >= 7) score += 10
  score = clamp(score)
  const status = score < 45 ? 'low_capacity' : score < 75 ? 'moderate_capacity' : 'high_capacity'
  return { status, score, drivers, presentationComplexity: status === 'low_capacity' ? 'minimal' : status === 'moderate_capacity' ? 'guided' : 'direct' }
}

export function runRecoveryEngine(inputs: ProgramLogicInputs, symptoms: SymptomResult): RecoveryResult {
  const signal = recoverySignals(inputs)
  const redFlags = [signal.sick ? 'illness' : null, signal.dizzy ? 'dizziness' : null, symptoms.redFlag ? 'severe symptoms' : null].filter(Boolean) as string[]
  if (redFlags.length) return { status: 'full_recovery_or_red_flag', score: 10, movementPreserved: false, reasoning: 'A safety or illness signal takes priority over training.', redFlags }
  let score = 70
  if (signal.sleepHours !== null && signal.sleepHours < 5.5) score -= 25
  if (signal.sleepQuality !== null && signal.sleepQuality <= 3) score -= 20
  if (signal.energy !== null && signal.energy <= 3) score -= 25
  if (signal.soreness !== null && signal.soreness >= 8) score -= 18
  if (signal.unusuallyFatigued) score -= 18
  if (symptoms.severity === 'moderate') score -= 20
  // Stress is intentionally a small modifier and never independently cancels movement.
  if (signal.stress !== null && signal.stress >= 8) score -= 8
  score = clamp(score)
  const status = score < 25 ? 'active_recovery' : score < 55 ? 'modify_workout' : score >= 88 ? 'push_day' : 'normal_training_day'
  return { status, score, movementPreserved: true, reasoning: status === 'active_recovery' ? 'Recovery inputs support restorative movement instead of performance work.' : status === 'modify_workout' ? 'Training can continue with reduced demand.' : status === 'push_day' ? 'Recovery inputs support planned progression.' : 'Recovery inputs support the planned session.', redFlags: [] }
}

export function runHydrationEngine(inputs: ProgramLogicInputs): HydrationResult {
  const targets = inputs.dailyPlan?.dailyTargets || {}
  const remaining = inputs.dailyPlan?.dailyRemaining || {}
  const target = Math.max(1, numeric(targets.water, 100))
  const consumed = Math.max(0, target - numeric(remaining.water, target))
  const percent = clamp((consumed / target) * 100)
  const dataKnown = Boolean(inputs.nutritionLogs.find((row) => row.log_date === inputs.date))
  const status = !dataKnown ? 'needs_input' : percent < 35 ? 'low' : percent < 70 ? 'building' : 'ready'
  return { consumed, target, remaining: Math.max(0, Math.round(target - consumed)), percent, status, prompt: status === 'needs_input' ? 'Log water so readiness can be calculated.' : status === 'low' ? 'Drink water before higher-output training.' : status === 'building' ? 'Keep water available and continue steadily.' : 'Hydration is supporting today’s plan.', recoverySupportNote: percent < 35 ? 'Low hydration can amplify fatigue, headache, and perceived effort.' : 'Continue normal hydration through the day.' }
}

export function runNutritionEngine(inputs: ProgramLogicInputs): NutritionResult {
  const targets = inputs.dailyPlan?.dailyTargets || {}
  const remaining = inputs.dailyPlan?.dailyRemaining || {}
  const currentLog = inputs.nutritionLogs.find((row) => row.log_date === inputs.date)
  const macro = (key: string, fallbackTarget = 0) => {
    const target = key === 'calories' ? numeric(inputs.dailyPlan?.calories, fallbackTarget) : numeric(targets[key], fallbackTarget)
    const left = numeric(remaining[key], target)
    const consumed = currentLog ? Math.max(0, target - left) : 0
    return { target, consumed, remaining: Math.max(0, Math.round(target - consumed)), percent: target ? clamp((consumed / target) * 100) : 0 }
  }
  const protein = macro('protein'), carbs = macro('carbs'), fats = macro('fats'), calories = macro('calories')
  const dataStatus = currentLog && inputs.mealEntries.length ? 'known' : 'needs_input'
  const suggestions = dataStatus === 'needs_input' ? ['Log the next meal to calculate what remains.'] : protein.percent < 50 ? ['Choose the easiest protein-forward meal available.'] : carbs.percent < 40 && inputs.plannedWorkout ? ['Add an easy carbohydrate source before training.'] : ['Build the next meal around what remains.']
  return { dataStatus, calories, protein, carbs, fats, mealSuggestions: suggestions, preWorkoutFuelPrompt: dataStatus === 'needs_input' ? 'Log or eat a small balanced meal before demanding training.' : protein.percent < 35 || carbs.percent < 25 ? 'Eat protein and an easy carbohydrate before training.' : 'Use normal pre-workout timing.', postWorkoutPriority: 'Prioritize protein, fluids, and enough total energy after training.' }
}

export function runFuelReadinessEngine(inputs: ProgramLogicInputs, hydration: HydrationResult, nutrition: NutritionResult, recovery: RecoveryResult): FuelReadinessResult {
  if (nutrition.dataStatus === 'needs_input') return { status: 'unknown_needs_input', confidence: 'low', preWorkoutAction: 'Log or eat a simple meal and drink water before deciding on intensity.', workoutAdjustment: 'Preserve movement; avoid max-effort work until fueling is known.', postWorkoutPriority: nutrition.postWorkoutPriority, reasoning: 'Food intake is not sufficiently logged to verify readiness.' }
  const mealAgeHours = inputs.mealEntries[0]?.created_at ? (Date.now() - new Date(inputs.mealEntries[0].created_at).getTime()) / 3600000 : null
  const demand = inputs.plannedWorkout ? numeric(inputs.plannedWorkout.duration_minutes ?? inputs.plannedWorkout.estimated_duration, 45) : 0
  let points = (nutrition.calories.percent * .4) + (nutrition.protein.percent * .2) + (nutrition.carbs.percent * .25) + (hydration.percent * .15)
  if (mealAgeHours !== null && mealAgeHours > 6) points -= 15
  if (recovery.status === 'active_recovery') points -= 10
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const workoutTime = /^\d{2}:\d{2}/.test(String(inputs.client.preferred_workout_time || ''))
    ? String(inputs.client.preferred_workout_time).slice(0,5).split(':').map(Number)
    : null
  const workoutMinutes = workoutTime ? workoutTime[0] * 60 + workoutTime[1] : null
  const hasTimeToFuel = workoutMinutes !== null && workoutMinutes - nowMinutes > 120
  let status: 'well_fueled' | 'slightly_under_fueled' | 'under_fueled' | 'depleted' = points >= 70 ? 'well_fueled' : points >= 50 ? 'slightly_under_fueled' : points >= 28 ? 'under_fueled' : 'depleted'
  if (hasTimeToFuel && (status === 'under_fueled' || status === 'depleted')) status = 'slightly_under_fueled'
  const output = {
    well_fueled: ['Follow the planned workout.', 'Keep the full plan and allow progression if form is strong.'],
    slightly_under_fueled: ['Use quick fuel and fluids before training.', 'Keep the workout but avoid max-effort sets.'],
    under_fueled: ['Eat first, then reassess energy.', 'Reduce volume or intensity and prioritize technique.'],
    depleted: ['Eat, hydrate, and choose restorative movement.', 'Replace performance work with walking, mobility, light circuits, or pump work.'],
  } as const
  const [preWorkoutAction, workoutAdjustment] = output[status]
  return { status, confidence: demand ? 'high' : 'medium', preWorkoutAction, workoutAdjustment, postWorkoutPriority: nutrition.postWorkoutPriority, reasoning: `Fuel readiness combines logged intake, hydration, meal timing, and planned session demand.` }
}

export function runCycleEngine(inputs: ProgramLogicInputs): CycleResult {
  const status = inputs.cycleStatus || {}
  if (!status.enabled) return { enabled: false, day: null, phase: null, trainingAdjustment: 'Use current symptoms and recovery inputs.', nutritionAdjustment: 'Use normal targets.', recoveryAdjustment: 'Use current recovery inputs.', symptomPrediction: [], insight: null }
  const ownCycleSymptoms = inputs.recentSymptoms.filter((item) => item.likely_cycle_related).map((item) => String(item.symptom_types?.name || '')).filter(Boolean)
  return { enabled: true, day: nullableNumeric(status.cycleDay), phase: status.phase || null, trainingAdjustment: inputs.cycleAdjustment?.note || 'Use symptoms over generalized phase assumptions.', nutritionAdjustment: status.phase === 'luteal' || status.phase === 'menstrual' ? 'Protect regular meals, fluids, and minerals if symptoms are present.' : 'Use normal targets and respond to hunger.', recoveryAdjustment: status.recoveryNote || 'Use actual symptoms and energy as the primary signal.', symptomPrediction: Array.from(new Set(ownCycleSymptoms)).slice(0, 3), insight: ownCycleSymptoms.length ? 'Your own repeated cycle-linked signals are informing today’s recommendation.' : 'Cycle phase is context, not a rule.' }
}

export function runPostureCompensationEngine(inputs: ProgramLogicInputs): PostureResult {
  const raw = { ...(inputs.photoRecord?.posture_flags || {}), ...(inputs.initialAssessment?.data?.compensation_flags || {}) }
  const flags = Object.entries(raw)
    .filter(([key, value]) => !key.includes('uploaded') && !key.includes('ready_for') && (value === true || typeof value === 'string'))
    .map(([key]) => key.replaceAll('_', ' '))
  const limitations = [inputs.client.injuries, inputs.client.limitations, inputs.initialAssessment?.data?.injuries]
    .map((value) => String(value || '').trim()).filter(Boolean)
  const pain = inputs.todaySymptoms.filter((item) => String(item.symptom_types?.category || '').toLowerCase().includes('pain'))
  return { flags:[...flags,...limitations], correctivePriorities: flags.length || limitations.length ? ['Use controlled tempo and stable range of motion.', 'Prioritize the corrective warm-up assigned to the flagged area.'] : [], substitutions: pain.length || limitations.length ? [{ from: 'Pain-provoking movement', to: 'Supported pain-free variation', reason: pain.length ? 'Current pain signal' : 'Documented limitation' }] : [], avoidToday: pain.length || limitations.length ? ['Any movement that increases pain or conflicts with documented limitations'] : [] }
}

function modifyExercises(exercises: any[], level: WorkoutDecisionResult['adjustmentLevel']) {
  if (level === 'level_0_full_plan') return exercises
  if (level === 'level_4_rest_or_red_flag') return []
  return exercises.map((exercise) => {
    const next = { ...exercise }
    if (level === 'level_1_slight_modify') next.recommended_weight = numeric(next.recommended_weight || next.calculated_weight) * .9 || null
    if (level === 'level_2_moderate_modify') { next.sets = Math.max(1, numeric(next.sets, 3) - 1); next.recommended_weight = numeric(next.recommended_weight || next.calculated_weight) * .8 || null }
    if (level === 'level_3_recovery_training') { next.sets = Math.min(2, numeric(next.sets, 2)); next.recommended_weight = numeric(next.recommended_weight || next.calculated_weight) * .55 || null; next.reps = Math.max(8, numeric(next.reps, 10)) }
    return next
  })
}

export function runWorkoutDecisionEngine(inputs: ProgramLogicInputs, recovery: RecoveryResult, fuel: FuelReadinessResult, symptoms: SymptomResult, posture: PostureResult): WorkoutDecisionResult {
  if (!inputs.plannedWorkout) return { plannedWorkout: null, assignedWorkout: null, adjustmentLevel: 'level_3_recovery_training', modifications: ['Use walking, mobility, or gentle recovery movement.'], exerciseSubstitutions: posture.substitutions, intensityTarget: 'Easy conversational effort', reasonForModification: 'No performance workout is scheduled today.', preWorkoutFuelPrompt: fuel.preWorkoutAction, postWorkoutPriority: fuel.postWorkoutPriority }
  let adjustmentLevel: WorkoutDecisionResult['adjustmentLevel'] = 'level_0_full_plan'
  const modifications: string[] = []
  if (recovery.status === 'full_recovery_or_red_flag' || symptoms.redFlag) { adjustmentLevel = 'level_4_rest_or_red_flag'; modifications.push('Stop training and follow the safety recommendation.') }
  else if (fuel.status === 'depleted' || recovery.status === 'active_recovery') { adjustmentLevel = 'level_3_recovery_training'; modifications.push('Replace performance work with restorative movement.') }
  else if (fuel.status === 'under_fueled' || recovery.status === 'modify_workout' || symptoms.severity === 'moderate') { adjustmentLevel = 'level_2_moderate_modify'; modifications.push('Reduce one set per exercise.', 'Keep technique crisp and remove finishers.') }
  else if (fuel.status === 'slightly_under_fueled' || fuel.status === 'unknown_needs_input' || inputs.cycleAdjustment?.cautionActive) { adjustmentLevel = 'level_1_slight_modify'; modifications.push('Avoid max-effort sets and keep two repetitions in reserve.') }
  else if (recovery.status === 'push_day' && fuel.status === 'well_fueled') modifications.push('Progress only if form and speed remain strong.')
  if (['too_much_today','not_feeling_workout'].includes(inputs.todayWorkoutFeedback?.response) && ['level_0_full_plan','level_1_slight_modify'].includes(adjustmentLevel)) { adjustmentLevel = 'level_2_moderate_modify'; modifications.unshift('Use the lighter version requested in today’s feedback.') }
  if (inputs.todayWorkoutFeedback?.response === 'too_easy' && adjustmentLevel === 'level_0_full_plan') modifications.unshift('Feedback noted; progress only with clean form and no grinding.')
  if (inputs.missedDayCount >= 3 && adjustmentLevel !== 'level_4_rest_or_red_flag') { adjustmentLevel = 'level_3_recovery_training'; modifications.unshift('Use a gentle reset session to rebuild momentum without pressure.') }
  modifications.push(...posture.correctivePriorities)
  const assignedExercises = modifyExercises(inputs.plannedExercises, adjustmentLevel)
  const assignedWorkout = adjustmentLevel === 'level_4_rest_or_red_flag' ? null : { ...inputs.plannedWorkout, exercises: assignedExercises }
  const targets = { level_0_full_plan: 'Planned RPE; progression allowed', level_1_slight_modify: 'RPE 7–8; no grinders', level_2_moderate_modify: 'RPE 6–7; technique priority', level_3_recovery_training: 'RPE 3–5; restorative movement', level_4_rest_or_red_flag: 'No training until safely cleared' }
  return { plannedWorkout: inputs.plannedWorkout, assignedWorkout, adjustmentLevel, modifications, exerciseSubstitutions: posture.substitutions, intensityTarget: targets[adjustmentLevel], reasonForModification: modifications[0] || 'The full planned workout matches current inputs.', preWorkoutFuelPrompt: fuel.preWorkoutAction, postWorkoutPriority: fuel.postWorkoutPriority }
}

export function runFlameExecutionEngine({ inputs, hydration, nutrition, workoutDecision, capacity }: { inputs: ProgramLogicInputs; hydration: HydrationResult; nutrition: NutritionResult; workoutDecision: WorkoutDecisionResult; capacity: CapacityResult }): FlameResult {
  const workoutComplete = !inputs.plannedWorkout || Boolean(inputs.dailyPlan?.workoutCompleted)
  const assessmentComplete = Boolean(inputs.todayRecovery?.check_in_completed_at)
  const recoveryComplete = inputs.todayRecoveryActivities.length>0
  const phoenixTaskPercent = Math.min(100, (inputs.phoenixTaskIds.length / 9) * 100)
  const sleepComplete=Boolean(inputs.todayRecovery?.sleep_hours||inputs.todayRecovery?.sleep_quality)
  const activityComplete=inputs.todayRecoveryActivities.length>0
  const requiredItems={nutrition:inputs.missedDayCount<1,hydration:inputs.missedDayCount<2,workoutOrMovement:true,dailyCheckIn:true,recovery:inputs.program==='phoenix'||capacity.status==='low_capacity',sleep:false,customTasks:inputs.program==='phoenix'&&inputs.missedDayCount<3}
  const completedItems={nutrition:nutrition.dataStatus==='known',hydration:hydration.percent>=80,workoutOrMovement:workoutComplete||activityComplete,dailyCheckIn:assessmentComplete,recovery:recoveryComplete,sleep:sleepComplete,customTasks:phoenixTaskPercent>=80}
  const required=(Object.keys(requiredItems) as Array<keyof typeof requiredItems>).filter((key)=>requiredItems[key])
  const score=required.length?Math.round(required.filter((key)=>completedItems[key]).length/required.length*100):100
  const state = score === 0 ? 'spark' : score < 25 ? 'ember' : score < 50 ? 'small_flame' : score < 75 ? 'steady_flame' : score < 100 ? 'strong_flame' : 'roaring_flame'
  const messages = inputs.program === 'phoenix'
    ? ['Start small', 'Start small', 'You’re moving', 'Momentum is building', 'Almost complete', 'You did enough today']
    : ['Start the first action', 'The work has started', 'Keep executing', 'Momentum is visible', 'Close the remaining gaps', 'Day complete']
  const index = ['spark','ember','small_flame','steady_flame','strong_flame','roaring_flame'].indexOf(state)
  const streakEligible=score===100
  let priorStreak=0
  for(const row of inputs.executionHistory){if(!row.streak_eligible)break;priorStreak++}
  const existingStreak=priorStreak+(streakEligible?1:0)
  const resetMessage=inputs.missedDayCount>=4?'You’re not behind. Let’s restart with one simple step today. If you need support, contact your coach.':inputs.missedDayCount>=1?'Today’s streak uses a smaller, right-sized plan.':null
  return { dailyScore: score, state, visualIntensity: Math.max(.2, score / 100), streak: existingStreak, streakEligible, completionMessage: messages[index], requirements:{date:inputs.date,programTier:inputs.program,capacityStatus:capacity.status,missedDayCount:inputs.missedDayCount,requiredItems,completedItems,completionScore:score,streakEligible,resetMessage} }
}
