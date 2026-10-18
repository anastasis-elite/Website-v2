'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import HydrationQuickAdd from '@/components/hydration/HydrationQuickAdd'
import NutritionFoodLogger from '@/components/NutritionFoodLogger'
import MicronutrientProgressRing from '@/components/nutrition/MicronutrientProgressRing'
import { useRouter } from 'next/navigation'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { useFuelReadinessEngine, useNutritionEngine, usePhoenixRecipes } from '@/components/nutrition/hooks'
import { canLogFood, normalizeProgramTier } from '@/lib/nutrition/canLogFood'
import { getClientLocalDateOffset } from '@/lib/timezone'
import { getTierCapabilities } from '@/lib/entitlements'
import { getMealPeriodForLocalDate, normalizeMealPeriod } from '@/lib/nutrition/mealPeriod'
import { trackEvent } from '@/lib/analytics'
import { useViewPreference } from '@/components/dashboard/useViewPreference'
import { getNextFoodGuidance } from '@/lib/nutrition/nextFoodGuidance'
import { loadRecordedNutrition, nutritionRemainingWithRecordedIntake } from '@/lib/nutrition/progress'
import { calculateMicronutrientProgress, confirmedToxicityWarning, loadMicronutrientProgress } from '@/lib/nutrition/micronutrientProgress'
import type { NutritionLoggingIntent } from '@/lib/nutrition/loggingIntent'

type NutritionLog = {
  id: string
  calories?: number | null
  protein?: number | null
  carbs?: number | null
  fats?: number | null
  calculation_mode?: string | null
  calculation_status?: string | null
  formula_version?: string | null
  nutrition_calculation?: {
    statusLabel?: string
    statusDescription?: string
    calculationMode?: string
    calculationStatus?: string
    normalizedGoal?: string
    bmi?: number | null
    leanBodyMassKg?: number | null
    bodyFatPercentUsed?: number | null
    activityFactor?: number | null
    rollingActiveEnergy?: number | null
    rollingRestingEnergy?: number | null
    finalMacroPercentages?: { protein?: number; carbs?: number; fats?: number }
    safeguardAdjusted?: boolean
    safeguardsApplied?: string[]
  } | null
  fiber_target_g?: number | null
  sodium_target_mg?: number | null
  potassium_target_mg?: number | null
  magnesium_target_mg?: number | null
  calcium_target_mg?: number | null
  iron_target_mg?: number | null
  zinc_target_mg?: number | null
  selenium_target_mcg?: number | null
  choline_target_mg?: number | null
  vitamin_a_target_mcg?: number | null
  vitamin_c_target_mg?: number | null
  vitamin_d_target_mcg?: number | null
  vitamin_e_target_mg?: number | null
  vitamin_k_target_mcg?: number | null
  b1_target_mg?: number | null
  b2_target_mg?: number | null
  b3_target_mg?: number | null
  b5_target_mg?: number | null
  b6_target_mg?: number | null
  b9_target_mcg?: number | null
  b12_target_mcg?: number | null
}

type Remaining = {
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

type ProgressTab = 'daily' | 'trends'
type IntakeTab = 'water' | 'meal' | 'suggested'
type ManagementTab = 'goals' | 'micros' | 'recipes'

type SuggestedFood = {
  foodId: string
  name: string
  serving: string | null
  contribution: string
  reason: string
}

type NutrientInsight = {
  nutrientKey: string
  nutrientName: string
  action: string
  confidenceCategory: string
  patternState: string
  message: string
  why: string[]
  foodFirst: boolean
  clinicianEscalation: boolean
  safetyEscalationReason: string | null
}

type SupplementRecommendation = {
  productId: string
  productName: string
  productUrl: string | null
  category: string
  recommendationCopy: string
  disclaimerCopy: string
  why: {
    nutrition: string
    trend: string
    reason: string
    disclaimer: string
  }
}

function progressPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function roundValue(value: number | string | null | undefined) {
  return Math.round(Number(value || 0))
}

function TrendLine({ values }: { values: Array<number | null> }) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value !== null)

  if (points.length < 2) {
    return <span className="tier-no-trend">Keep logging to build this trend.</span>
  }

  const raw = points.map((point) => point.value)
  const min = Math.min(...raw)
  const range = Math.max(...raw) - min || 1
  const coordinates = points
    .map((point) => `${(point.index / Math.max(1, values.length - 1)) * 100},${44 - ((point.value - min) / range) * 36}`)
    .join(' ')

  return <svg className="tier-trend-line" viewBox="0 0 100 48" role="img"><polyline points={coordinates} /></svg>
}

export default function AdaptiveNutritionDashboard({
  program,
  logic,
  recipes,
  loggingIntent,
}: {
  program: string
  logic: ProgramLogicOutput
  recipes: PhoenixRecipe[]
  loggingIntent?: NutritionLoggingIntent
}) {
  const router=useRouter()
  const supabase = useMemo(() => createClient(), [])
  const engineNutrition=useNutritionEngine(logic)
  const fuel=useFuelReadinessEngine(logic)
  const phoenixRecipes=usePhoenixRecipes(recipes)

  const tier = normalizeProgramTier(program || logic.program || logic.client.program)
  const isEmber = tier === 'ember'
  const isIgnite = tier === 'ignite'
  const isPhoenix = tier === 'phoenix'
  const foodLoggingEnabled = canLogFood(tier)
  const capabilities = getTierCapabilities(tier)

  const [loading, setLoading] = useState(true)
  const [nutritionLog, setNutritionLog] = useState<NutritionLog | null>(null)
  const [remaining, setRemaining] = useState<Remaining | null>(null)
  const [micronutrientIntake, setMicronutrientIntake] = useState<Awaited<ReturnType<typeof loadMicronutrientProgress>> | null>(null)
  const [micronutrientState, setMicronutrientState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [intakeRevision, setIntakeRevision] = useState(0)
  const [waterConsumed, setWaterConsumed] = useState(logic.hydration.consumed)
  const directEntry = Boolean(loggingIntent?.action)
  const directRecipe = isPhoenix ? recipes.find(recipe => recipe.id === loggingIntent?.recipeId) : undefined

  const [calorieTarget, setCalorieTarget] = useState(0)
  const [proteinTarget, setProteinTarget] = useState('')
  const [carbTarget, setCarbTarget] = useState('')
  const [fatTarget, setFatTarget] = useState('')

  const [message, setMessage] = useState('')
  const [macroEntry, setMacroEntry] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
  })
  const [savingMacros, setSavingMacros] = useState(false)

  const [progressTab, setProgressTab] = useViewPreference<ProgressTab>(logic.client.id, 'nutrition-progress', ['daily', 'trends'], 'daily')
  const [intakeTab, setIntakeTab] = useViewPreference<IntakeTab>(logic.client.id, 'nutrition-intake', ['water', 'meal', 'suggested'], 'meal')
  const [managementTab, setManagementTab] = useViewPreference<ManagementTab>(logic.client.id, `nutrition-management-${tier}`, isPhoenix ? ['goals', 'micros', 'recipes'] : isEmber ? ['goals'] : ['goals', 'micros'], 'goals')
  const [suggestedFoods, setSuggestedFoods] = useState<SuggestedFood[]>([])
  const [suggestedFoodsState, setSuggestedFoodsState] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'complete' | 'error'>('idle')
  const [suggestedFoodsBasis, setSuggestedFoodsBasis] = useState<'remaining' | 'targets' | 'general'>('remaining')
  const [suggestedFoodsMessage, setSuggestedFoodsMessage] = useState('')
  const [nutrientInsights, setNutrientInsights] = useState<NutrientInsight[]>([])
  const [supplementRecommendation, setSupplementRecommendation] = useState<SupplementRecommendation | null>(null)
  const [supplementDismissed, setSupplementDismissed] = useState(false)
  const [supplementShownKey, setSupplementShownKey] = useState('')

  useEffect(() => setWaterConsumed(logic.hydration.consumed), [logic.hydration.consumed])

  useEffect(() => {
    if (!loggingIntent?.action) return
    setIntakeTab(loggingIntent.action === 'water' ? 'water' : 'meal')
  }, [loggingIntent?.action, setIntakeTab])

  useEffect(() => {
    const followHash = () => {
      if (window.location.hash === '#hydration') setIntakeTab('water')
      else if (['#aos-food-logger', '#aos-macro-entry'].includes(window.location.hash)) setIntakeTab('meal')
    }
    followHash()
    window.addEventListener('hashchange', followHash)
    return () => window.removeEventListener('hashchange', followHash)
  }, [setIntakeTab])

  const loadSuggestedFoods = useCallback(async () => {
    if (!nutritionLog?.id) return

    setSuggestedFoodsState('loading')
    setSuggestedFoodsMessage('')

    try {
      const response = await fetch(`/api/nutrition/suggested-foods?nutritionLogId=${encodeURIComponent(nutritionLog.id)}`)
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Suggested foods could not be loaded.')
      }

      setSuggestedFoods(payload?.suggestions || [])
      setSuggestedFoodsState(payload?.state || 'ready')
      setSuggestedFoodsBasis(payload?.basis || 'remaining')
    } catch (error) {
      setSuggestedFoods([])
      setSuggestedFoodsState('error')
      setSuggestedFoodsMessage(error instanceof Error ? error.message : 'Suggested foods could not be loaded.')
    }
  }, [nutritionLog?.id])

  const loadNutrientInsights = useCallback(async () => {
    const clientId = logic.client.id
    if (!clientId) return

    try {
      const response = await fetch(`/api/nutrition/nutrient-insights?clientId=${encodeURIComponent(clientId)}`)
      const payload = await response.json().catch(() => null)
      if (!response.ok) return
      setNutrientInsights(payload?.insights || [])
    } catch {
      setNutrientInsights([])
    }
  }, [logic.client.id])

  const loadSupplementRecommendation = useCallback(async () => {
    const clientId = logic.client.id
    if (!clientId) return

    try {
      const response = await fetch(`/api/nutrition/supplement-recommendation?clientId=${encodeURIComponent(clientId)}`)
      const payload = await response.json().catch(() => null)
      if (!response.ok) return
      setSupplementRecommendation(payload?.recommendation || null)
      setSupplementDismissed(false)
      for (const resolved of payload?.resolvedRecommendations || []) {
        trackEvent('supplement_recommendation_resolved', {
          product_id: String(resolved.productId || ''),
          recommendation_category: String(resolved.category || 'general_nutrition'),
        })
      }
    } catch {
      setSupplementRecommendation(null)
    }
  }, [logic.client.id])
  
  async function handleFoodUpdated(updatedRemaining?: Remaining | null, action: 'added' | 'removed' = 'added') {
    if (updatedRemaining) {
      setRemaining(updatedRemaining)
    }

    setIntakeRevision(current => current + 1)
    try {
      await loadToday()
      setMessage(
        action === 'removed'
          ? 'Food removed — today’s calories, macros, and micronutrients are updated.'
          : 'Food logged — today’s calories, macros, and micronutrients are updated.'
      )
    } catch {
      setMessage(action === 'removed' ? 'Food removed. Saved totals could not be refreshed yet.' : 'Food saved. Saved totals could not be refreshed yet.')
      setLoading(false)
    }
    router.refresh()
  }

  async function handleMacroSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!nutritionLog?.id) return

    setSavingMacros(true)
    setMessage('')

    try {
      const response = await fetch('/api/nutrition/add-macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nutritionLogId: nutritionLog.id,
          calories: Number(macroEntry.calories || 0),
          protein: Number(macroEntry.protein || 0),
          carbs: Number(macroEntry.carbs || 0),
          fats: Number(macroEntry.fats || 0),
          mealPeriod: getMealPeriodForLocalDate(new Date(), logic.client.timezone),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Macros could not be saved.')
      setMacroEntry({ calories: '', protein: '', carbs: '', fats: '' })
      if (payload?.remaining) {
        setRemaining(payload.remaining)
      }
      await loadToday()
      setMessage(payload?.refreshStatus === 'degraded' ? 'Macros logged. Today’s remaining totals are refreshing.' : 'Macros logged.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Macros could not be saved.')
    } finally {
      setSavingMacros(false)
    }
  }


  useEffect(() => {
    if (!directEntry) void loadSuggestedFoods()
  }, [loadSuggestedFoods, remaining, directEntry])

  useEffect(() => {
    if (!directEntry) void loadNutrientInsights()
  }, [loadNutrientInsights, remaining, directEntry])

  useEffect(() => {
    if (!directEntry) void loadSupplementRecommendation()
  }, [loadSupplementRecommendation, remaining, directEntry])

  useEffect(() => {
    if (!supplementRecommendation || supplementDismissed) return
    const key = `${supplementRecommendation.productId}:${supplementRecommendation.category}`
    if (supplementShownKey === key) return
    setSupplementShownKey(key)
    trackEvent('supplement_recommendation_eligible', {
      product_id: supplementRecommendation.productId,
      recommendation_category: supplementRecommendation.category,
    })
    trackEvent('supplement_recommendation_shown', {
      product_id: supplementRecommendation.productId,
      recommendation_category: supplementRecommendation.category,
    })
  }, [supplementRecommendation, supplementDismissed, supplementShownKey])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[AOS Nutrition] resolved food logging tier', {
        tier,
        propProgram: program,
        logicProgram: logic.program,
        clientProgram: logic.client.program,
        canLogFood: foodLoggingEnabled,
      })
    }
  }, [tier, program, logic.program, logic.client.program, foodLoggingEnabled])

  function calculateCalories(protein: string, carbs: string, fat: string) {
    return Math.round(
      Number(protein || 0) * 4 +
        Number(carbs || 0) * 4 +
        Number(fat || 0) * 9
    )
  }

  const loadToday = useCallback(async () => {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Please log in to view nutrition.')
      setLoading(false)
      return
    }

    const clientId = logic.client.id

    if (!clientId) {
      setMessage('No client profile found yet.')
      setLoading(false)
      return
    }

    const today = getClientLocalDateOffset(logic.client)

    const { data: savedLog, error: logError } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', clientId)
      .eq('log_date', today)
      .maybeSingle()

    if (logError) throw new Error('Today’s saved nutrition could not be loaded. Try again before preparing a new log.')
    let log = savedLog

   if (!log) {
  const targetResponse = await fetch(
    `/api/nutrition?client_id=${encodeURIComponent(
      clientId
    )}&program=${encodeURIComponent(tier)}`
  )

  const targets = await targetResponse.json().catch(() => null)

  if (!targetResponse.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AOS Nutrition] target preparation failed', {
        status: targetResponse.status,
        stage: 'nutrition-targets',
        error: targets?.error,
        clientId,
        logDate: today,
        programTier: tier,
      })
    }

    setMessage(
      targets?.error || 'Today’s nutrition targets could not be prepared.'
    )
    setLoading(false)
    return
  }

  const protein = Number(targets?.protein)
  const carbs = Number(targets?.carbs)
  const fats = Number(targets?.fats)
  const calories = Number(targets?.calories)

  const targetsAreValid =
    Number.isFinite(protein) &&
    protein >= 0 &&
    Number.isFinite(carbs) &&
    carbs >= 0 &&
    Number.isFinite(fats) &&
    fats >= 0 &&
    Number.isFinite(calories) &&
    calories > 0

  if (!targetsAreValid) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AOS Nutrition] invalid targets returned', {
        stage: 'nutrition-target-validation',
        clientId,
        logDate: today,
        programTier: tier,
        targets,
      })
    }

    setMessage('Today’s nutrition targets could not be prepared.')
    setLoading(false)
    return
  }

  const createResponse = await fetch('/api/nutrition-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      log_date: today,
      createOnly: true,
      protein,
      carbs,
      fats,
      calories,
      water_oz: Number(targets?.water || 0),
      meals: [],
      completed: false,
      cyclePhase: targets?.phase,
      nutritionCalculation: targets?.nutritionCalculation,
      trainingLevel:
        tier === 'phoenix' ? 'recovery' : 'strength_hypertrophy',
    }),
  })

  const createPayload = await createResponse.json().catch(() => null)

  if (!createResponse.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AOS Nutrition] nutrition log creation failed', {
        status: createResponse.status,
        stage: 'nutrition-log-creation',
        error: createPayload?.error,
        clientId,
        logDate: today,
        programTier: tier,
      })
    }

    setMessage(
      createPayload?.error ||
        'Today’s nutrition plan could not be prepared yet.'
    )
    setLoading(false)
    return
  }

  const created = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('client_id', clientId)
    .eq('log_date', today)
    .maybeSingle()

  if (created.error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AOS Nutrition] created log could not be reloaded', {
        stage: 'nutrition-log-reload',
        error: created.error.message,
        clientId,
        logDate: today,
        programTier: tier,
      })
    }

    setMessage('Today’s nutrition plan was created but could not be loaded.')
    setLoading(false)
    return
  }

  log = created.data
}

    if (!log) {
  setMessage('Today’s nutrition plan could not be prepared yet.')
  setLoading(false)
  return
}

setNutritionLog(log)
    const [{ data: remainingData, error: remainingError }, recorded] = await Promise.all([
      supabase
      .from('nutrition_log_remaining')
      .select('*')
      .eq('nutrition_log_id', log.id)
      .maybeSingle(),
      loadRecordedNutrition(supabase, log.id),
    ])
    if (remainingError) throw new Error('Saved nutrition progress could not be loaded.')

    setRemaining(nutritionRemainingWithRecordedIntake(log, remainingData, recorded))

    const initialProtein = String(log.protein || remainingData?.protein_remaining_g || '')
    const initialCarbs = String(log.carbs || remainingData?.carbs_remaining_g || '')
    const initialFat = String(log.fats || remainingData?.fat_remaining_g || '')

    setProteinTarget(initialProtein)
    setCarbTarget(initialCarbs)
    setFatTarget(initialFat)
    setCalorieTarget(Number(log.calories || calculateCalories(initialProtein, initialCarbs, initialFat)))

    setLoading(false)
  }, [supabase, logic.client, tier])

  useEffect(() => {
    if (loggingIntent?.action === 'water') return
    void loadToday().catch(() => { setLoading(false); setMessage('Today’s nutrition could not be loaded. Refresh to try again.') })
  }, [loadToday, loggingIntent?.action])

  useEffect(() => {
    if (managementTab !== 'micros' || directEntry || !nutritionLog?.id || !foodLoggingEnabled) return
    let cancelled = false
    setMicronutrientState('loading')
    void loadMicronutrientProgress(supabase, nutritionLog.id).then(intake => {
      if (cancelled) return
      setMicronutrientIntake(intake)
      setMicronutrientState('ready')
    }).catch(() => {
      if (cancelled) return
      setMicronutrientIntake(null)
      setMicronutrientState('error')
    })
    return () => { cancelled = true }
  }, [supabase, nutritionLog?.id, managementTab, directEntry, foodLoggingEnabled, intakeRevision])

  useEffect(() => {
    if (managementTab !== 'micros' || directEntry || !nutritionLog?.id || !foodLoggingEnabled) return
    const resume = () => {
      if (document.visibilityState === 'visible') setIntakeRevision(current => current + 1)
    }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [managementTab, directEntry, nutritionLog?.id, foodLoggingEnabled])

  const microRows = calculateMicronutrientProgress({
    targets: nutritionLog || {},
    meals: micronutrientIntake?.meals || [],
    macroEntryCount: micronutrientIntake?.macroEntryCount || 0,
    upperLimits: micronutrientIntake?.upperLimits || [],
    age: logic.client.age ?? null,
  })

  const macroMetrics = [
    {
      label: 'Calories',
      target: Number(nutritionLog?.calories ?? calorieTarget ?? logic.nutrition.calories.target),
      remaining: Number(remaining?.calories_remaining ?? logic.nutrition.calories.remaining),
      unit: 'cal',
    },
    {
      label: 'Protein',
      target: Number(nutritionLog?.protein ?? proteinTarget ?? logic.nutrition.protein.target),
      remaining: Number(remaining?.protein_remaining_g ?? logic.nutrition.protein.remaining),
      unit: 'g',
    },
    {
      label: 'Carbohydrates',
      target: Number(nutritionLog?.carbs ?? carbTarget ?? logic.nutrition.carbs.target),
      remaining: Number(remaining?.carbs_remaining_g ?? logic.nutrition.carbs.remaining),
      unit: 'g',
    },
    {
      label: 'Fat',
      target: Number(nutritionLog?.fats ?? fatTarget ?? logic.nutrition.fats.target),
      remaining: Number(remaining?.fat_remaining_g ?? logic.nutrition.fats.remaining),
      unit: 'g',
    },
  ].map((metric) => {
    const consumed = Math.max(0, metric.target - metric.remaining)
    return {
      ...metric,
      consumed,
      percent: metric.target ? progressPercent((consumed / metric.target) * 100) : 0,
    }
  })

  const nutritionTrends = logic.trends.filter((trend) => ['calories', 'protein', 'water'].includes(trend.key))
  const managementTabs: Array<{ key: ManagementTab; label: string }> = [
    { key: 'goals', label: 'Goals / Assessment' },
    ...(isIgnite || isPhoenix ? [{ key: 'micros' as ManagementTab, label: 'Micronutrients' }] : []),
    ...(isPhoenix && phoenixRecipes.length ? [{ key: 'recipes' as ManagementTab, label: 'Recipes' }] : []),
  ]

  const nutritionStatus =
    nutritionLog?.nutrition_calculation?.statusLabel ||
    (nutritionLog?.calculation_status === 'manual_override'
      ? 'Manually overridden target'
      : 'Estimated nutrition target')
  const nextFoodGuidance = getNextFoodGuidance({
    dataStatus: engineNutrition.dataStatus,
    mealSuggestions: engineNutrition.mealSuggestions,
    suggestedFoods,
  })

  const waterEntry = (
                <div id="hydration" className="nutrition-water-panel">
                  <div className="nutrition-water-summary">
                    <div className="tier-metric-ring" style={{ '--tier-progress': `${progressPercent(logic.hydration.target > 0 ? waterConsumed / logic.hydration.target * 100 : 0) * 3.6}deg` } as CSSProperties}>
                      <strong>{progressPercent(logic.hydration.target > 0 ? waterConsumed / logic.hydration.target * 100 : 0)}%</strong>
                    </div>
                    <div>
                      <span>Current Water</span>
                      <strong>{roundValue(waterConsumed)} / {roundValue(logic.hydration.target)} oz</strong>
                      <small>{logic.hydration.prompt}</small>
                    </div>
                  </div>

                  <HydrationQuickAdd initiallyOpen={loggingIntent?.action === 'water'} clientId={logic.client.id} logDate={getClientLocalDateOffset(logic.client)} consumed={waterConsumed} target={logic.hydration.target} onSaved={setWaterConsumed} renderTrigger={({ toggle, triggerRef }) => <button ref={triggerRef} type="button" className="tier-primary-action" onClick={toggle}>Log water</button>} />
                </div>

  )

  const foodEntry = (
                <div id={foodLoggingEnabled ? 'aos-food-logger' : 'aos-macro-entry'} className="nutrition-log-meal-panel">
                  {foodLoggingEnabled && nutritionLog?.id ? (
                    <NutritionFoodLogger
                      timezone={logic.fuelReadiness.timeZone}
                      initialMealPeriod={loggingIntent?.meal || (directRecipe ? normalizeMealPeriod(directRecipe.meal_type) : undefined)}
                      nutritionLogId={nutritionLog.id}
                      capabilities={{
                        nutritionBarcodeScanning: capabilities.nutritionBarcodeScanning,
                        nutritionRecurringFoodDetection: capabilities.nutritionRecurringFoodDetection,
                        nutritionAutomaticPreLogging: capabilities.nutritionAutomaticPreLogging,
                        nutritionPhotoMacroEstimation: capabilities.nutritionPhotoMacroEstimation,
                      }}
                      initialRemaining={
                        remaining
                          ? {
                              calories_remaining: remaining.calories_remaining ?? null,
                              protein_remaining_g: remaining.protein_remaining_g ?? null,
                              carbs_remaining_g: remaining.carbs_remaining_g ?? null,
                              fat_remaining_g: remaining.fat_remaining_g ?? null,
                              fiber_remaining_g: remaining.fiber_remaining_g ?? null,
                              sodium_remaining_mg: remaining.sodium_remaining_mg ?? null,
                              potassium_remaining_mg: remaining.potassium_remaining_mg ?? null,
                              magnesium_remaining_mg: remaining.magnesium_remaining_mg ?? null,
                              calcium_remaining_mg: remaining.calcium_remaining_mg ?? null,
                              iron_remaining_mg: remaining.iron_remaining_mg ?? null,
                              zinc_remaining_mg: remaining.zinc_remaining_mg ?? null,
                              selenium_remaining_mcg: remaining.selenium_remaining_mcg ?? null,
                              choline_remaining_mg: remaining.choline_remaining_mg ?? null,
                              vitamin_a_remaining_mcg: remaining.vitamin_a_remaining_mcg ?? null,
                              vitamin_c_remaining_mg: remaining.vitamin_c_remaining_mg ?? null,
                              vitamin_d_remaining_mcg: remaining.vitamin_d_remaining_mcg ?? null,
                              vitamin_e_remaining_mg: remaining.vitamin_e_remaining_mg ?? null,
                              vitamin_k_remaining_mcg: remaining.vitamin_k_remaining_mcg ?? null,
                              b1_remaining_mg: remaining.b1_remaining_mg ?? null,
                              b2_remaining_mg: remaining.b2_remaining_mg ?? null,
                              b3_remaining_mg: remaining.b3_remaining_mg ?? null,
                              b5_remaining_mg: remaining.b5_remaining_mg ?? null,
                              b6_remaining_mg: remaining.b6_remaining_mg ?? null,
                              b9_remaining_mcg: remaining.b9_remaining_mcg ?? null,
                              b12_remaining_mcg: remaining.b12_remaining_mcg ?? null,
                            }
                          : null
                      }
                      onUpdated={handleFoodUpdated}
                    />
                  ) : null}

                  {isEmber && nutritionLog ? (
                    <form onSubmit={handleMacroSubmit} className="nutrition-macro-form">
                      <p>Enter the totals you want to record for this meal or block.</p>
                      <div className="nutrition-macro-entry-grid">
                        {([
                          ['calories', 'Calories'],
                          ['protein', 'Protein (g)'],
                          ['carbs', 'Carbs (g)'],
                          ['fats', 'Fat (g)'],
                        ] as const).map(([key, label]) => (
                          <label key={key}>
                            <span>{label}</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={macroEntry[key]}
                              onChange={(event) => setMacroEntry((current) => ({ ...current, [key]: event.target.value }))}
                            />
                          </label>
                        ))}
                      </div>
                      <button type="submit" disabled={savingMacros} className="tier-primary-action">
                        {savingMacros ? 'Saving Macros...' : 'Add Macros'}
                      </button>
                    </form>
                  ) : null}

                  {!nutritionLog?.id ? (
                    <p className="tier-calendar-empty">
                      {loading ? 'Preparing nutrition entry...' : message || 'Nutrition entry could not be prepared yet.'}
                    </p>
                  ) : null}
                </div>

  )

  if (directEntry) return (
    <main className="aos-nutrition-page nutrition-direct-entry">
      <section className="nutrition-dashboard-panel" data-tier={tier} aria-labelledby="nutrition-entry-title">
        <div className="nutrition-direct-entry-heading tier-panel-heading">
          <h1 id="nutrition-entry-title">{loggingIntent?.action === 'water' ? 'Log Water' : isEmber ? 'Nutrition Guidance' : loggingIntent?.action === 'meal' ? 'Log Meal' : 'Log Food'}</h1>
          <a href="/dashboard" className="tier-secondary-action">Done</a>
        </div>
        {loggingIntent?.action !== 'water' && isEmber ? <p>EMBER includes macro targets, macro entry and water logging. Food and meal logging are not included.</p> : null}
        {loggingIntent?.action !== 'water' && directRecipe ? <details className="nutrition-entry-recipe-context"><summary>Recipe: {directRecipe.title}</summary><p>Log the foods and portions you ate from this recipe.</p><ul>{directRecipe.ingredientLines.map(ingredient => <li key={ingredient}>{ingredient}</li>)}</ul></details> : null}
        {loggingIntent?.action === 'water' ? waterEntry : foodEntry}
        {message ? <p className="nutrition-status" role="status">{message}</p> : null}
        {!loading && !nutritionLog && loggingIntent?.action !== 'water' ? <button className="tier-secondary-action" type="button" onClick={() => void loadToday().catch(() => setMessage('Today’s nutrition could not be loaded. Try again.'))}>Retry loading food entry</button> : null}
      </section>
    </main>
  )

  return (
    <main className="aos-nutrition-page">
      <div className="aos-nutrition-shell">
        <section className="nutrition-dashboard-workspace" data-tier={tier}>
          <article className="tier-daily-insight workout-objective nutrition-objective" data-testid="nutrition-objective">
            <p className="tier-dashboard-label">
              {isEmber ? 'Nutrition Targets' : 'Nutrition Intelligence'}
            </p>
            <div>
              <h1>{isEmber ? 'Today’s Targets' : 'Today’s Intake'}</h1>
              {(foodLoggingEnabled || isEmber) && nutritionLog?.id ? (
                <button
                  type="button"
                  onClick={() => {
                    if (foodLoggingEnabled) { router.push('/dashboard/nutrition?log=food'); return }
                    setIntakeTab('meal')
                    requestAnimationFrame(() => document.getElementById(foodLoggingEnabled ? 'aos-food-logger' : 'aos-macro-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                  }}
                  className="tier-primary-action"
                >
              {foodLoggingEnabled ? 'Log Food' : 'Add Macros'}
                </button>
              ) : null}
            </div>
            <p>{fuel.displayStatus}. {fuel.reasoning}</p>
            <small>What to eat next: {nextFoodGuidance.copy}</small>
            {nextFoodGuidance.showSuggestedAction ? <button
              type="button"
              className="tier-secondary-action"
              onClick={() => {
                setIntakeTab('suggested')
                requestAnimationFrame(() => document.getElementById('nutrition-suggested-foods')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
              }}
            >Explore Suggested Foods</button> : null}
            <div className="nutrition-objective-metrics">
              <article><span>Calories</span><strong>{roundValue(macroMetrics[0]?.consumed)} / {roundValue(macroMetrics[0]?.target)} cal</strong></article>
              <article><span>Remaining</span><strong>{roundValue(macroMetrics[0]?.remaining)} cal</strong></article>
              <article><span>Water</span><strong>{roundValue(waterConsumed)} / {roundValue(logic.hydration.target)} oz</strong></article>
            </div>
          </article>

          {loading && <p className="nutrition-status">Loading...</p>}
          {message && <p className="nutrition-status">{message}</p>}

          {nutrientInsights.length ? (
            <section className="nutrition-dashboard-panel nutrient-insight-card" data-testid="nutrient-insight-card">
              <div className="tier-panel-heading">
                <div>
                  <p className="tier-dashboard-label">Nutrient Insight</p>
                  <h2>{nutrientInsights[0].nutrientName}</h2>
                </div>
                <a className="tier-secondary-action" href={`/dashboard/nutrition/nutrients/${nutrientInsights[0].nutrientKey}`}>
                  Details
                </a>
              </div>
              <p>{nutrientInsights[0].message}</p>
              <details className="nutrient-why-panel">
                <summary>Why am I seeing this?</summary>
                <ul>
                  {nutrientInsights[0].why.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </details>
            </section>
          ) : null}

          {supplementRecommendation && !supplementDismissed ? (
            <section className="nutrition-dashboard-panel supplement-recommendation-card" data-testid="supplement-recommendation-card">
              <div className="tier-panel-heading">
                <div>
                  <p className="tier-dashboard-label">Optional Nutrition Support</p>
                  <h2>{supplementRecommendation.productName}</h2>
                </div>
                <button
                  type="button"
                  className="supplement-dismiss-button"
                  aria-label="Dismiss supplement recommendation"
                  onClick={() => {
                    setSupplementDismissed(true)
                    trackEvent('supplement_recommendation_dismissed', {
                      product_id: supplementRecommendation.productId,
                      recommendation_category: supplementRecommendation.category,
                    })
                  }}
                >
                  x
                </button>
              </div>
              <p>{supplementRecommendation.recommendationCopy}</p>
              <details
                className="nutrient-why-panel"
                onToggle={(event) => {
                  if ((event.currentTarget as HTMLDetailsElement).open) {
                    trackEvent('supplement_recommendation_expanded', {
                      product_id: supplementRecommendation.productId,
                      recommendation_category: supplementRecommendation.category,
                    })
                  }
                }}
              >
                <summary>Why you&apos;re seeing this</summary>
                <div className="supplement-why-copy">
                  <p><strong>Nutrition:</strong> {supplementRecommendation.why.nutrition}</p>
                  <p><strong>Trend:</strong> {supplementRecommendation.why.trend}</p>
                  <p><strong>Reason:</strong> {supplementRecommendation.why.reason}</p>
                  <p>{supplementRecommendation.why.disclaimer}</p>
                </div>
              </details>
              <div className="supplement-card-actions">
                {supplementRecommendation.productUrl ? (
                  <a
                    className="tier-secondary-action"
                    href={supplementRecommendation.productUrl}
                    onClick={() => trackEvent('supplement_recommendation_clicked', {
                      product_id: supplementRecommendation.productId,
                      recommendation_category: supplementRecommendation.category,
                    })}
                  >
                    View option
                  </a>
                ) : null}
                <small>{supplementRecommendation.disclaimerCopy}</small>
              </div>
            </section>
          ) : null}

          <div className="nutrition-dashboard-row">
            <section className="nutrition-dashboard-panel" data-testid="nutrition-progress-panel">
              <div className="tier-panel-heading">
                <div>
                  <p className="tier-dashboard-label">Nutrition Progress</p>
                  <h2>{progressTab === 'daily' ? 'Daily Progress' : 'Weekly Trends'}</h2>
                </div>
                <div className="tier-tab-list nutrition-panel-tabs" role="tablist" aria-label="Nutrition progress">
                  {([
                    ['daily', 'Daily Progress'],
                    ['trends', 'Trends'],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" className={progressTab === key ? 'is-active' : ''} onClick={() => setProgressTab(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {progressTab === 'daily' ? (
                <div className="nutrition-progress-grid" data-testid="nutrition-daily-progress-tab">
                  {macroMetrics.map((metric) => (
                    <article key={metric.label} className="tier-metric-card">
                      <div className="tier-metric-ring" style={{ '--tier-progress': `${metric.percent * 3.6}deg` } as CSSProperties}>
                        <strong>{metric.percent}%</strong>
                      </div>
                      <span>{metric.label}</span>
                      <small>{roundValue(metric.consumed)} / {roundValue(metric.target)} {metric.unit}</small>
                      <small>{roundValue(metric.remaining)} {metric.unit} remaining</small>
                    </article>
                  ))}
                </div>
              ) : null}

              {progressTab === 'trends' ? (
                <div className="tier-trends-layout nutrition-trends-layout" data-testid="nutrition-trends-tab">
                  {nutritionTrends.length ? nutritionTrends.map((trend) => (
                    <article key={trend.key}>
                      <div><span>{trend.label}</span><strong>{trend.currentAverage === null ? 'No data' : `${Math.round(trend.currentAverage)}${trend.unit}`}</strong></div>
                      <TrendLine values={trend.values} />
                      <small>{trend.comparisonPercent === null ? 'Current history stays connected here.' : `${trend.comparisonPercent}% vs prior period`}</small>
                    </article>
                  )) : <p className="tier-calendar-empty">Keep logging meals and water to build weekly nutrition trends.</p>}
                </div>
              ) : null}
            </section>

            <section className="nutrition-dashboard-panel nutrition-intake-panel" data-testid="nutrition-intake-panel">
              <div className="tier-panel-heading">
                <div>
                  <p className="tier-dashboard-label">Intake</p>
                  <h2>{intakeTab === 'water' ? 'Water' : intakeTab === 'suggested' ? 'Suggested Foods' : foodLoggingEnabled ? 'Food Log' : 'Macro Entry'}</h2>
                </div>
                <div className="tier-tab-list nutrition-panel-tabs" role="tablist" aria-label="Intake controls">
                  {([
                    ['water', 'Water'],
                    ['meal', foodLoggingEnabled ? 'Food Log' : 'Macro Entry'],
                    ['suggested', 'Suggested Foods'],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" className={intakeTab === key ? 'is-active' : ''} onClick={() => setIntakeTab(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {intakeTab === 'water' ? waterEntry : null}

              {intakeTab === 'meal' ? foodEntry : null}

              {intakeTab === 'suggested' ? (
                <div id="nutrition-suggested-foods" className="nutrition-suggested-foods-panel" data-testid="nutrition-suggested-foods-tab">
                  {suggestedFoodsState === 'loading' ? (
                    <p className="tier-calendar-empty">Finding today’s best matches...</p>
                  ) : null}

                  {suggestedFoodsState === 'unavailable' ? (
                    <p className="tier-calendar-empty">No food suggestions are available for your current preferences. You can still {foodLoggingEnabled ? 'record foods in the food log' : 'enter your macro totals'}.</p>
                  ) : null}

                  {suggestedFoodsState === 'complete' ? (
                    <p className="tier-calendar-empty">No additional food suggestions based on your logged intake.</p>
                  ) : null}

                  {suggestedFoodsState === 'error' ? (
                    <p className="tier-calendar-empty">{suggestedFoodsMessage}</p>
                  ) : null}

                  {suggestedFoodsState === 'ready' && suggestedFoods.length ? (
                    <div className="nutrition-suggested-foods-list">
                      {suggestedFoodsBasis !== 'remaining' ? <p className="tier-calendar-empty">{suggestedFoodsBasis === 'targets' ? 'Starting options based on today’s targets. No prior meal logs needed.' : 'Starting food options. Log intake to personalize your remaining targets.'}</p> : null}
                      {suggestedFoods.map((food) => (
                        <article key={food.foodId} className="nutrition-suggested-food-card">
                          <div>
                            <span>{food.contribution}</span>
                            <strong>{food.name}</strong>
                            <small>{food.serving || (foodLoggingEnabled ? 'Serving available in food log' : 'Use this food idea when recording your macro totals')}</small>
                          </div>
                          <p>{food.reason}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <section className="tier-info-panel nutrition-management-panel" data-testid="nutrition-management-panel">
            <div className="tier-tab-list nutrition-management-tabs" role="tablist" aria-label="Nutrition management">
              {managementTabs.map((item) => (
                <button key={item.key} type="button" className={managementTab === item.key ? 'is-active' : ''} onClick={() => setManagementTab(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>

            {managementTab === 'goals' ? (
              <div className="tier-info-grid nutrition-goals-grid" data-testid="nutrition-goals-assessment-tab">
                <article><span>Goal</span><strong>{nutritionLog?.nutrition_calculation?.normalizedGoal || logic.client.goal || 'Recomp'}</strong><small>{nutritionStatus}</small></article>
                <article><span>Calories</span><strong>{roundValue(macroMetrics[0]?.target)} cal</strong><small>{roundValue(macroMetrics[0]?.remaining)} remaining today</small></article>
                <article><span>Protein</span><strong>{roundValue(macroMetrics[1]?.target)}g</strong><small>{roundValue(macroMetrics[1]?.consumed)}g logged</small></article>
                <article><span>Carbohydrates</span><strong>{roundValue(macroMetrics[2]?.target)}g</strong><small>{roundValue(macroMetrics[2]?.consumed)}g logged</small></article>
                <article><span>Fat</span><strong>{roundValue(macroMetrics[3]?.target)}g</strong><small>{roundValue(macroMetrics[3]?.consumed)}g logged</small></article>
                <article><span>Hydration</span><strong>{roundValue(logic.hydration.target)} oz</strong><small>{logic.hydration.recoverySupportNote}</small></article>
                {nutritionLog?.nutrition_calculation?.bmi ? <article><span>BMI Context</span><strong>{nutritionLog.nutrition_calculation.bmi}</strong><small>Assessment-derived context</small></article> : null}
                {nutritionLog?.nutrition_calculation?.bodyFatPercentUsed ? <article><span>Body Fat</span><strong>{nutritionLog.nutrition_calculation.bodyFatPercentUsed}%</strong><small>{nutritionLog.nutrition_calculation.leanBodyMassKg ? `${nutritionLog.nutrition_calculation.leanBodyMassKg} kg lean mass used` : 'Used in target calculation'}</small></article> : null}
                {nutritionLog?.nutrition_calculation?.activityFactor ? <article><span>Activity</span><strong>{nutritionLog.nutrition_calculation.activityFactor}</strong><small>{nutritionLog.nutrition_calculation.calculationMode === 'wearable' ? 'Connected activity mode' : 'Assessment activity factor'}</small></article> : null}
                {nutritionLog?.nutrition_calculation?.finalMacroPercentages ? (
                  <article><span>Macro Split</span><strong>{nutritionLog.nutrition_calculation.finalMacroPercentages.protein}% / {nutritionLog.nutrition_calculation.finalMacroPercentages.carbs}% / {nutritionLog.nutrition_calculation.finalMacroPercentages.fats}%</strong><small>Protein / carbs / fat</small></article>
                ) : null}
              </div>
            ) : null}

            {managementTab === 'micros' ? (
              <div data-testid="nutrition-micronutrients-tab">
                {micronutrientState === 'loading' ? <p role="status" className="nutrition-status">Loading saved micronutrient intake…</p> : null}
                {micronutrientState === 'error' ? <div><p role="status">Saved micronutrient intake could not be loaded.</p><button type="button" className="tier-secondary-action" onClick={() => setIntakeRevision(current => current + 1)}>Retry micronutrients</button></div> : null}
                {micronutrientState === 'ready' ? <>
                  <p className="nutrition-status">Daily targets are individualized when available. A daily target is not an upper limit. Food totals exclude supplements.</p>
                  {micronutrientIntake && !micronutrientIntake.upperLimitsAvailable ? <p className="nutrition-status">Upper-limit reference data could not be loaded.</p> : null}
                  <div className="nutrition-micro-grid">
                    {microRows.map(progress => <MicronutrientProgressRing key={progress.key} progress={progress} safetyWarning={confirmedToxicityWarning(progress.key, nutrientInsights)} />)}
                  </div>
                </> : null}
              </div>
            ) : null}

            {managementTab === 'recipes' ? (
              <div className="nutrition-recipes-grid" data-testid="nutrition-recipes-tab">
                {phoenixRecipes.map((recipe)=><Recipe key={recipe.id} recipe={recipe}/>)}
              </div>
            ) : null}
          </section>
        </section>

      </div>
    </main>
  )
}

function Recipe({ recipe }: { recipe: PhoenixRecipe }) {
  return (
    <details>
      <summary>
        <h3>{recipe.title}</h3>
        <p>{recipe.reason}</p>
        <small>{recipe.totalMinutes} min · {recipe.macros.protein}g protein · {recipe.macros.calories} cal</small>
      </summary>
      <h4>Ingredients</h4>
      <ul>{recipe.ingredientLines.map((item)=><li key={item}>{item}</li>)}</ul>
      <h4>Simple steps</h4>
      <ol>{recipe.steps.map((step)=><li key={step}>{step}</li>)}</ol>
      <p>Servings: {recipe.servings} · {recipe.meal_type} · {recipe.tags.join(', ')}</p>
      <a href={`/dashboard/nutrition?log=meal&meal=${recipe.meal_type}&recipe=${encodeURIComponent(recipe.id)}`} className="tier-primary-action">Log foods from this recipe</a>
    </details>
  )
}
