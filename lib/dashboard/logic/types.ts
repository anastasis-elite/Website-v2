export type ProgramTier = 'ember' | 'ignite' | 'phoenix'
export type CapacityStatus = 'low_capacity' | 'moderate_capacity' | 'high_capacity'
export type RecoveryStatus = 'push_day' | 'normal_training_day' | 'modify_workout' | 'active_recovery' | 'full_recovery_or_red_flag'
export type FuelStatus = 'well_fueled' | 'slightly_under_fueled' | 'under_fueled' | 'depleted' | 'unknown_needs_input'
export type WorkoutAdjustmentLevel = 'level_0_full_plan' | 'level_1_slight_modify' | 'level_2_moderate_modify' | 'level_3_recovery_training' | 'level_4_rest_or_red_flag'
export type FlameState = 'spark' | 'ember' | 'small_flame' | 'steady_flame' | 'strong_flame' | 'roaring_flame'

export type DailyMacro = { target: number; consumed: number; remaining: number; percent: number }

export type ProgramLogicInputs = {
  date: string
  userId: string
  client: any
  program: ProgramTier
  dailyPlan: any
  cycleStatus: any
  cycleAdjustment: any
  plannedWorkout: any
  plannedExercises: any[]
  todayWorkoutFeedback: any
  todayAssessment: any
  todayRecovery: any
  todaySymptoms: any[]
  recentSymptoms: any[]
  nutritionLogs: any[]
  nutritionTotals: any[]
  mealEntries: any[]
  workoutHistory: any[]
  strengthAssessments: any[]
  initialAssessment: any
  measurementLogs: any[]
  photoRecord: any
  photoUrls: string[]
  phoenixTaskIds: string[]
  yesterday: { workoutComplete: boolean; nutritionLogged: boolean; taskCount: number }
  monthlyAssessmentsDueCount: number
}

export type CapacityResult = { status: CapacityStatus; score: number; drivers: string[]; presentationComplexity: 'minimal' | 'guided' | 'direct' }
export type RecoveryResult = { status: RecoveryStatus; score: number; movementPreserved: boolean; reasoning: string; redFlags: string[] }
export type FuelReadinessResult = { status: FuelStatus; confidence: 'low' | 'medium' | 'high'; preWorkoutAction: string; workoutAdjustment: string; postWorkoutPriority: string; reasoning: string }
export type HydrationResult = { consumed: number; target: number; remaining: number; percent: number; status: 'needs_input' | 'low' | 'building' | 'ready'; prompt: string; recoverySupportNote: string }
export type NutritionResult = { dataStatus: 'known' | 'needs_input'; calories: DailyMacro; protein: DailyMacro; carbs: DailyMacro; fats: DailyMacro; mealSuggestions: string[]; preWorkoutFuelPrompt: string; postWorkoutPriority: string }
export type SymptomResult = { severity: 'none' | 'mild' | 'moderate' | 'severe'; clusters: string[]; possibleIntolerance: boolean; workoutModification: string | null; recoveryRecommendation: string; redFlag: boolean; trendInsight: string | null }
export type CycleResult = { enabled: boolean; day: number | null; phase: string | null; trainingAdjustment: string; nutritionAdjustment: string; recoveryAdjustment: string; symptomPrediction: string[]; insight: string | null }
export type PostureResult = { flags: string[]; correctivePriorities: string[]; substitutions: Array<{ from: string; to: string; reason: string }>; avoidToday: string[] }
export type WorkoutDecisionResult = { plannedWorkout: any; assignedWorkout: any; adjustmentLevel: WorkoutAdjustmentLevel; modifications: string[]; exerciseSubstitutions: Array<{ from: string; to: string; reason: string }>; intensityTarget: string; reasonForModification: string; preWorkoutFuelPrompt?: string; postWorkoutPriority?: string }
export type FlameResult = { dailyScore: number; state: FlameState; visualIntensity: number; streak: number; streakEligible: boolean; completionMessage: string }

export type DashboardTrend = { key: 'calories' | 'protein' | 'water' | 'workouts'; label: string; unit: string; values: Array<number | null>; currentAverage: number | null; comparisonPercent: number | null }

export type ProgramLogicOutput = {
  engineVersion: string
  generatedAt: string
  client: { id: string; name: string; age: number | null; program: ProgramTier; goal: string | null; baselineCapacity: string | null }
  program: ProgramTier
  capacityStatus: CapacityResult
  recoveryStatus: RecoveryResult
  fuelReadiness: FuelReadinessResult
  workoutDecision: WorkoutDecisionResult
  flameState: FlameResult
  hydration: HydrationResult
  nutrition: NutritionResult
  workout: { assigned: boolean; completed: boolean; title: string; type: string; durationMinutes: number | null }
  assessments: { dailyCompleted: boolean; monthlyDueCount: number; completionPercent: number }
  recoveryCheck: { completed: boolean; energy: number | null; stress: number | null; soreness: number | null; sleepQuality: number | null }
  sleep: { logged: boolean; hours: number | null; quality: number | null }
  cycle: CycleResult
  symptoms: SymptomResult
  posture: PostureResult
  todayPlan: { phoenixTaskIds: string[] }
  insight: { concise: string; reasoning: string }
  progress: { weight: number | null; weightChange: number | null; bodyFat: number | null; bodyFatChange: number | null; photosDue: boolean; photoUrls: string[] }
  trends: DashboardTrend[]
  execution: { workoutComplete: boolean; nutritionLogged: boolean; assessmentComplete: boolean; recoveryComplete: boolean; phoenixTaskPercent: number }
  presentation: { tier: ProgramTier; complexity: 'minimal' | 'guided' | 'direct'; maxTasksPerBlock: number; showTrends: boolean; showInsight: boolean }
}
