'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import HydrationQuickAdd from '@/components/hydration/HydrationQuickAdd'
import MacroQuickAdd from '@/components/nutrition/MacroQuickAdd'
import { buildDailyMacroMetrics } from '@/lib/nutrition/dailyMacroMetrics'
import { viewPreferenceKey } from '@/lib/dashboard/viewPreferences'
import NutritionFoodLogger from '@/components/NutritionFoodLogger'
import MicronutrientProgressRing from '@/components/nutrition/MicronutrientProgressRing'
import { useRouter } from 'next/navigation'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { useNutritionEngine, usePhoenixRecipes } from '@/components/nutrition/hooks'
import { canLogFood, normalizeProgramTier } from '@/lib/nutrition/canLogFood'
import { getClientLocalDateOffset, getClientTimeZone } from '@/lib/timezone'
import { getTierCapabilities } from '@/lib/entitlements'
import { normalizeMealPeriod } from '@/lib/nutrition/mealPeriod'
import { trackEvent } from '@/lib/analytics'
import { useViewPreference } from '@/components/dashboard/useViewPreference'
import { getNextFoodGuidance } from '@/lib/nutrition/nextFoodGuidance'
import { loadRecordedNutrition, nutritionRemainingWithRecordedIntake } from '@/lib/nutrition/progress'
import { calculateMicronutrientProgress, confirmedToxicityWarning, loadMicronutrientProgress } from '@/lib/nutrition/micronutrientProgress'
import type { NutritionLoggingIntent } from '@/lib/nutrition/loggingIntent'
import { canTrackMicronutrients, memberNutritionLog, memberNutritionLogColumns, memberNutritionRemaining, memberNutritionRemainingColumns } from '@/lib/nutrition/memberNutrition'

type NutritionLog = {
  id: string
  client_id?: string
  log_date?: string
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

type IntakeTab = 'water' | 'meal' | 'suggested'
type ManagementTab = 'micros' | 'recipes'

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
  const phoenixRecipes=usePhoenixRecipes(recipes)

  const tier = normalizeProgramTier(program || logic.program || logic.client.program)
  const isEmber = tier === 'ember'
  const isPhoenix = tier === 'phoenix'
  const foodLoggingEnabled = canLogFood(tier)
  const capabilities = getTierCapabilities(tier)
  const micronutrientsEnabled = canTrackMicronutrients(tier)

  const [loading, setLoading] = useState(true)
  const [nutritionLog, setNutritionLog] = useState<NutritionLog | null>(null)
  const [remaining, setRemaining] = useState<Remaining | null>(null)
  const [micronutrientIntake, setMicronutrientIntake] = useState<Awaited<ReturnType<typeof loadMicronutrientProgress>> | null>(null)
  const [micronutrientState, setMicronutrientState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [intakeRevision, setIntakeRevision] = useState(0)
  const [waterConsumed, setWaterConsumed] = useState(logic.hydration.consumed)
  const directEntry = Boolean(loggingIntent?.action)
  const directRecipe = isPhoenix ? recipes.find(recipe => recipe.id === loggingIntent?.recipeId) : undefined

  const [message, setMessage] = useState('')
  const [entryFromHash, setEntryFromHash] = useState<'water' | 'macros' | null>(null)
  // Guidance belongs to one member, tier and local day, including in-flight reads.
  const guidanceScope = `${logic.client.id}:${tier}:${getClientLocalDateOffset(logic.client)}`
  const guidanceContext = useRef(guidanceScope)
  const nutritionReadRequest = useRef<symbol | null>(null)
  const publishedNutritionScope = useRef('')
  const publishedRemainingScope = useRef('')
  const nutrientInsightRequest = useRef<symbol | null>(null)
  const supplementRequest = useRef<symbol | null>(null)
  const suggestedFoodRequest = useRef<symbol | null>(null)
  const nutrientInsightScope = useRef('')
  const supplementScope = useRef('')
  const suggestedFoodScope = useRef('')
  guidanceContext.current = guidanceScope
  const nutritionLogIsCurrent = publishedNutritionScope.current === guidanceScope &&
    nutritionLog?.client_id === logic.client.id && nutritionLog?.log_date === getClientLocalDateOffset(logic.client)

  const [intakeTab, setIntakeTab] = useViewPreference<IntakeTab>(logic.client.id, 'nutrition-intake', isEmber ? ['water', 'meal'] : ['water', 'meal', 'suggested'], 'meal')
  const [managementTab, setManagementTab] = useViewPreference<ManagementTab>(logic.client.id, `nutrition-management-${tier}`, isPhoenix ? ['micros', 'recipes'] : ['micros'], 'micros')
  const [suggestedFoods, setSuggestedFoods] = useState<SuggestedFood[]>([])
  const [suggestedFoodsState, setSuggestedFoodsState] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'complete' | 'error'>('idle')
  const [suggestedFoodsBasis, setSuggestedFoodsBasis] = useState<'remaining' | 'targets' | 'general'>('remaining')
  const [suggestedFoodsMessage, setSuggestedFoodsMessage] = useState('')
  const [nutrientInsights, setNutrientInsights] = useState<NutrientInsight[]>([])
  const [supplementRecommendation, setSupplementRecommendation] = useState<SupplementRecommendation | null>(null)
  const [supplementDismissed, setSupplementDismissed] = useState(false)
  const [supplementShownKey, setSupplementShownKey] = useState('')

  useEffect(() => {
    setNutrientInsights([])
    setSuggestedFoods([])
    setSuggestedFoodsState('idle')
    setSuggestedFoodsMessage('')
    setMicronutrientIntake(null)
    setSupplementRecommendation(null)
    setSupplementDismissed(false)
    setSupplementShownKey('')
  }, [guidanceScope])

  useEffect(() => {
    try {
      window.localStorage.removeItem(viewPreferenceKey(logic.client.id, 'nutrition-progress'))
      if (isEmber) window.localStorage.removeItem(viewPreferenceKey(logic.client.id, 'nutrition-intake'))
    } catch {
      // Display preferences are optional in restricted browsers.
    }
  }, [logic.client.id, isEmber])

  useEffect(() => setWaterConsumed(logic.hydration.consumed), [logic.hydration.consumed])

  useEffect(() => {
    if (!loggingIntent?.action) return
    setIntakeTab(loggingIntent.action === 'water' ? 'water' : 'meal')
  }, [loggingIntent?.action, setIntakeTab])

  useEffect(() => {
    const followHash = () => {
      if (window.location.hash === '#hydration') {
        setIntakeTab('water')
        setEntryFromHash('water')
      } else if (['#aos-food-logger', '#aos-macro-entry'].includes(window.location.hash)) {
        setIntakeTab('meal')
        setEntryFromHash('macros')
      } else setEntryFromHash(null)
    }
    followHash()
    window.addEventListener('hashchange', followHash)
    return () => window.removeEventListener('hashchange', followHash)
  }, [setIntakeTab])

  const loadSuggestedFoods = useCallback(async () => {
    const logMatchesCurrentMemberDay = () => {
      return publishedNutritionScope.current === guidanceScope && nutritionLog?.client_id === logic.client.id &&
        nutritionLog?.log_date === getClientLocalDateOffset(logic.client)
    }
    if (isEmber || !nutritionLog?.id || guidanceContext.current !== guidanceScope || !logMatchesCurrentMemberDay()) return
    const request = Symbol('suggested-foods')
    suggestedFoodRequest.current = request
    const isCurrent = () => guidanceContext.current === guidanceScope && suggestedFoodRequest.current === request && logMatchesCurrentMemberDay()

    suggestedFoodScope.current = guidanceScope
    setSuggestedFoodsState('loading')
    setSuggestedFoodsMessage('')

    try {
      const response = await fetch(`/api/nutrition/suggested-foods?nutritionLogId=${encodeURIComponent(nutritionLog.id)}`)
      const payload = await response.json().catch(() => null)
      if (!isCurrent()) return

      if (!response.ok) {
        throw new Error(payload?.error || 'Suggested foods could not be loaded.')
      }

      setSuggestedFoods(payload?.suggestions || [])
      setSuggestedFoodsState(payload?.state || 'ready')
      setSuggestedFoodsBasis(payload?.basis || 'remaining')
    } catch (error) {
      if (!isCurrent()) return
      setSuggestedFoods([])
      setSuggestedFoodsState('error')
      setSuggestedFoodsMessage(error instanceof Error ? error.message : 'Suggested foods could not be loaded.')
    }
  }, [nutritionLog, logic.client, guidanceScope, isEmber])

  const loadNutrientInsights = useCallback(async () => {
    const clientId = logic.client.id
    if (!clientId || !micronutrientsEnabled || guidanceContext.current !== guidanceScope) return
    const request = Symbol('nutrient-insights')
    nutrientInsightRequest.current = request
    const isCurrent = () => guidanceContext.current === guidanceScope && nutrientInsightRequest.current === request

    try {
      const response = await fetch(`/api/nutrition/nutrient-insights?clientId=${encodeURIComponent(clientId)}`)
      const payload = await response.json().catch(() => null)
      if (!isCurrent()) return
      if (!response.ok) return
      nutrientInsightScope.current = guidanceScope
      setNutrientInsights(payload?.insights || [])
    } catch {
      if (!isCurrent()) return
      setNutrientInsights([])
    }
  }, [logic.client.id, guidanceScope, micronutrientsEnabled])

  const loadSupplementRecommendation = useCallback(async () => {
    const clientId = logic.client.id
    if (!clientId || guidanceContext.current !== guidanceScope) return
    const request = Symbol('supplement-recommendation')
    supplementRequest.current = request
    const isCurrent = () => guidanceContext.current === guidanceScope && supplementRequest.current === request

    try {
      const response = await fetch(`/api/nutrition/supplement-recommendation?clientId=${encodeURIComponent(clientId)}`)
      const payload = await response.json().catch(() => null)
      if (!isCurrent()) return
      if (!response.ok) return
      supplementScope.current = guidanceScope
      // EMBER support is the server's protein-only adapter. Never reuse a
      // micronutrient response from a prior tier or an unscoped response.
      const allowed = micronutrientsEnabled || payload?.nutritionScope === 'protein'
      setSupplementRecommendation(allowed ? payload?.recommendation || null : null)
      setSupplementDismissed(false)
      for (const resolved of allowed ? payload?.resolvedRecommendations || [] : []) {
        trackEvent('supplement_recommendation_resolved', {
          product_id: String(resolved.productId || ''),
          recommendation_category: String(resolved.category || 'general_nutrition'),
        })
      }
    } catch {
      if (!isCurrent()) return
      setSupplementRecommendation(null)
    }
  }, [logic.client.id, guidanceScope, micronutrientsEnabled])
  
  async function handleFoodUpdated(updatedRemaining?: Remaining | null, action: 'added' | 'removed' = 'added') {
    if (guidanceContext.current !== guidanceScope) return
    if (updatedRemaining) {
      publishedRemainingScope.current = guidanceScope
      setRemaining(memberNutritionRemaining(updatedRemaining, tier))
    }

    setIntakeRevision(current => current + 1)
    try {
      if (!await loadToday()) throw new Error('Saved totals could not be refreshed yet.')
      if (guidanceContext.current !== guidanceScope) return
      setMessage(
        action === 'removed'
          ? 'Food removed — today’s calories, macros, and micronutrients are updated.'
          : 'Food logged — today’s calories, macros, and micronutrients are updated.'
      )
    } catch {
      if (guidanceContext.current !== guidanceScope) return
      setMessage(action === 'removed' ? 'Food removed. Saved totals could not be refreshed yet.' : 'Food saved. Saved totals could not be refreshed yet.')
      setLoading(false)
    }
    if (guidanceContext.current === guidanceScope) router.refresh()
  }

  useEffect(() => {
    if (!isEmber && !directEntry) void loadSuggestedFoods()
  }, [loadSuggestedFoods, remaining, directEntry, isEmber])

  useEffect(() => {
    if (!directEntry && micronutrientsEnabled) void loadNutrientInsights()
  }, [loadNutrientInsights, remaining, directEntry, micronutrientsEnabled])

  useEffect(() => {
    if (!directEntry) void loadSupplementRecommendation()
  }, [loadSupplementRecommendation, remaining, directEntry])

  useEffect(() => {
    if (!supplementRecommendation || supplementDismissed || supplementScope.current !== guidanceScope) return
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
  }, [supplementRecommendation, supplementDismissed, supplementShownKey, guidanceScope])

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

  const loadToday = useCallback(async () => {
    if (guidanceContext.current !== guidanceScope) return false
    const request = Symbol('nutrition-read')
    nutritionReadRequest.current = request
    const isCurrent = () => guidanceContext.current === guidanceScope && nutritionReadRequest.current === request
    setLoading(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!isCurrent()) return false

    if (!user) {
      setMessage('Please log in to view nutrition.')
      setLoading(false)
      return false
    }

    const clientId = logic.client.id

    if (!clientId) {
      setMessage('No client profile found yet.')
      setLoading(false)
      return false
    }

    const today = getClientLocalDateOffset(logic.client)

    const readMemberLog = async () => {
      if (micronutrientsEnabled) {
        return supabase.from('nutrition_logs').select(memberNutritionLogColumns(tier))
          .eq('client_id', clientId).eq('log_date', today).maybeSingle<NutritionLog>()
      }
      // The server selects optional legacy metadata compatibly and projects it
      // before transport. Explicit optional columns can break older schemas.
      const response = await fetch(`/api/nutrition-log?client_id=${encodeURIComponent(clientId)}&log_date=${encodeURIComponent(today)}`)
      const payload = await response.json().catch(() => null)
      return response.ok
        ? { data: (payload?.nutritionLog || null) as NutritionLog | null, error: null }
        : { data: null, error: { message: 'Saved nutrition could not be loaded.' } }
    }
    const { data: savedLog, error: logError } = await readMemberLog()

    if (!isCurrent()) return false
    if (logError) throw new Error('Today’s saved nutrition could not be loaded. Try again before preparing a new log.')
    let log = memberNutritionLog(savedLog, tier)

   if (!log) {
  const targetResponse = await fetch(
    `/api/nutrition?client_id=${encodeURIComponent(
      clientId
    )}&program=${encodeURIComponent(tier)}`
  )

  const targets = await targetResponse.json().catch(() => null)
  if (!isCurrent()) return false

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
    return false
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
    return false
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
  if (!isCurrent()) return false

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
    return false
  }

  const created = await readMemberLog()

  if (!isCurrent()) return false
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
    return false
  }

  log = memberNutritionLog(created.data, tier)
}

    if (!log) {
  setMessage('Today’s nutrition plan could not be prepared yet.')
  setLoading(false)
  return false
}

// A target refresh must not pair newly loaded targets with older remaining
// values if the following progress read fails.
publishedRemainingScope.current = ''
publishedNutritionScope.current = guidanceScope
setNutritionLog(log)
    const [{ data: remainingData, error: remainingError }, recorded] = await Promise.all([
      supabase
      .from('nutrition_log_remaining')
      .select(memberNutritionRemainingColumns(tier))
      .eq('nutrition_log_id', log.id)
      .maybeSingle<Remaining>(),
      loadRecordedNutrition(supabase, log.id),
    ])
    if (!isCurrent()) return false
    if (remainingError) throw new Error('Saved nutrition progress could not be loaded.')

    publishedRemainingScope.current = guidanceScope
    setRemaining(memberNutritionRemaining(nutritionRemainingWithRecordedIntake(log, remainingData, recorded), tier))

    setLoading(false)
    return true
  }, [supabase, logic.client, tier, guidanceScope, micronutrientsEnabled])

  useEffect(() => {
    if (loggingIntent?.action === 'water') return
    void loadToday().catch(() => { setLoading(false); setMessage('Today’s nutrition could not be loaded. Refresh to try again.') })
  }, [loadToday, loggingIntent?.action])

  useEffect(() => {
    if (!micronutrientsEnabled || !nutritionLogIsCurrent || managementTab !== 'micros' || directEntry || !nutritionLog?.id || !foodLoggingEnabled) return
    let cancelled = false
    setMicronutrientState('loading')
    void loadMicronutrientProgress(supabase, nutritionLog.id).then(intake => {
      if (cancelled || guidanceContext.current !== guidanceScope) return
      setMicronutrientIntake(intake)
      setMicronutrientState('ready')
    }).catch(() => {
      if (cancelled || guidanceContext.current !== guidanceScope) return
      setMicronutrientIntake(null)
      setMicronutrientState('error')
    })
    return () => { cancelled = true }
  }, [supabase, nutritionLog?.id, managementTab, directEntry, foodLoggingEnabled, intakeRevision, micronutrientsEnabled, guidanceScope, nutritionLogIsCurrent])

  useEffect(() => {
    if (!micronutrientsEnabled || !nutritionLogIsCurrent || managementTab !== 'micros' || directEntry || !nutritionLog?.id || !foodLoggingEnabled) return
    const resume = () => {
      if (document.visibilityState === 'visible') setIntakeRevision(current => current + 1)
    }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [managementTab, directEntry, nutritionLog?.id, foodLoggingEnabled, micronutrientsEnabled, nutritionLogIsCurrent])

  const microRows = micronutrientsEnabled && nutritionLogIsCurrent ? calculateMicronutrientProgress({
    targets: nutritionLog || {},
    meals: micronutrientIntake?.meals || [],
    macroEntryCount: micronutrientIntake?.macroEntryCount || 0,
    upperLimits: micronutrientIntake?.upperLimits || [],
    age: logic.client.age ?? null,
  }) : []

  const macroMetrics = buildDailyMacroMetrics(
    nutritionLogIsCurrent ? nutritionLog : null,
    publishedRemainingScope.current === guidanceScope ? remaining : null,
  )
  const managementTabs: Array<{ key: ManagementTab; label: string }> = [
    ...(micronutrientsEnabled ? [{ key: 'micros' as ManagementTab, label: 'Micronutrients' }] : []),
    ...(isPhoenix && phoenixRecipes.length ? [{ key: 'recipes' as ManagementTab, label: 'Recipes' }] : []),
  ]

  async function refreshSavedNutrition() {
    try {
      const refreshed = await loadToday()
      if (!refreshed) throw new Error('Saved totals could not be refreshed yet.')
      router.refresh()
    } finally {
      if (guidanceContext.current === guidanceScope) setLoading(false)
    }
  }

  const macroEntry = isEmber ? <MacroQuickAdd
    clientId={logic.client.id} logDate={getClientLocalDateOffset(logic.client)} timezone={getClientTimeZone(logic.client)}
    initiallyOpen={entryFromHash === 'macros'}
    loading={loading}
    nutritionLogId={nutritionLogIsCurrent ? nutritionLog?.id || null : null}
    disabled={loading || !nutritionLogIsCurrent}
    onRefresh={refreshSavedNutrition}
    onSaved={async updatedRemaining => {
      if (guidanceContext.current !== guidanceScope) return
      if (updatedRemaining) {
        publishedRemainingScope.current = guidanceScope
        setRemaining(memberNutritionRemaining(updatedRemaining, tier))
      }
      await refreshSavedNutrition()
    }}
    renderTrigger={({ toggle, triggerRef, open }) => <button ref={triggerRef} type="button"
      className="phone-app-card nutrition-entry-card" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
      <img src="/illustrations/today-nutrition.svg" width="360" height="180" alt="" />
      <span className="nutrition-entry-card-copy"><strong>Add Macros</strong><span>Record calories, protein, carbohydrates and fat for a meal or block.</span></span>
    </button>}
  /> : null

  const nutritionStatus =
    nutritionLog?.nutrition_calculation?.statusLabel ||
    (nutritionLog?.calculation_status === 'manual_override'
      ? 'Manually overridden target'
      : 'Estimated nutrition target')
  const currentSuggestedFoods = !isEmber && suggestedFoodScope.current === guidanceScope ? suggestedFoods : []
  const currentSuggestedFoodsState = suggestedFoodScope.current === guidanceScope ? suggestedFoodsState : 'idle'
  const nextFoodGuidance = getNextFoodGuidance({
    dataStatus: engineNutrition.dataStatus,
    mealSuggestions: engineNutrition.mealSuggestions,
    suggestedFoods: currentSuggestedFoods,
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
        {loggingIntent?.action === 'water' ? waterEntry : isEmber ? macroEntry : foodEntry}
        {message ? <p className="nutrition-status" role="status">{message}</p> : null}
        {!loading && !nutritionLog && loggingIntent?.action !== 'water' ? <button className="tier-secondary-action" type="button" onClick={() => void loadToday().catch(() => setMessage('Today’s nutrition could not be loaded. Try again.'))}>Retry loading food entry</button> : null}
      </section>
    </main>
  )

  return (
    <main className="aos-nutrition-page">
      <div className="aos-nutrition-shell">
        <section className="phone-app-targets nutrition-daily-targets" aria-label="Your daily nutrition targets">
          <h2>Your daily targets</h2>
          {loading ? <p role="status">Loading your targets…</p> : <>
            <div className="nutrition-progress-grid" data-testid="nutrition-daily-progress-tab">
              {macroMetrics.map(metric => <article key={metric.label} className="tier-metric-card">
                <div className="tier-metric-ring" aria-hidden="true" style={{ '--tier-progress': `${(metric.percent ?? 0) * 3.6}deg` } as CSSProperties}>
                  <strong>{metric.percent === null ? '—' : `${metric.percent}%`}</strong>
                </div>
                <span>{metric.label}</span>
                <small>{metric.consumed === null ? 'Logged amount unavailable' : `${roundValue(metric.consumed)} / ${roundValue(metric.target)} ${metric.unit}`}</small>
                {metric.target === null ? <small>Target unavailable</small> : metric.consumed === null ? <small>Target {roundValue(metric.target)} {metric.unit}</small> : null}
                {metric.consumed !== null && metric.remaining !== null ? <small>{roundValue(Math.abs(metric.remaining))} {metric.unit} {metric.remaining < 0 ? 'over target' : 'remaining'}</small> : null}
              </article>)}
            </div>
            {nutritionLogIsCurrent ? <small>{nutritionStatus}</small> : <p>Today’s targets are unavailable.</p>}
          </>}
        </section>
        <h2>Keep it simple today.</h2>
        <div className="phone-app-grid">
          {isEmber ? <>
            {macroEntry}
            <HydrationQuickAdd initiallyOpen={entryFromHash === 'water'} clientId={logic.client.id} logDate={getClientLocalDateOffset(logic.client)} consumed={waterConsumed} target={logic.hydration.target} onSaved={setWaterConsumed}
              renderTrigger={({ toggle, triggerRef, open }) => <button ref={triggerRef} type="button" className="phone-app-card nutrition-entry-card" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
                <img src="/illustrations/today-nutrition.svg" width="360" height="180" alt="" />
                <span className="nutrition-entry-card-copy"><strong>Log Water</strong><span>{roundValue(waterConsumed)} / {roundValue(logic.hydration.target)} oz logged today</span></span>
              </button>} />
          </> : <>
            <article className="phone-app-card"><img src="/illustrations/today-nutrition.svg" width="360" height="180" alt=""/><div><h3>Start with protein</h3><p>{!loading && nutritionLogIsCurrent && macroMetrics[1].target !== null ? `Your daily protein target is ${roundValue(macroMetrics[1].target)} g.` : 'Your personalized protein target will appear when available.'}</p></div></article>
            <article className="phone-app-card"><img src="/illustrations/today-nutrition.svg" width="360" height="180" alt=""/><div><h3>Build a balanced plate</h3><p>{nextFoodGuidance.copy}</p></div></article>
          </>}
        </div>
        <section className="nutrition-dashboard-workspace" data-tier={tier}>
          {message ? <p className="nutrition-status" role="status">{message}</p> : null}
          {!loading && (!nutritionLogIsCurrent || macroMetrics.some(metric => metric.consumed === null)) ? <button type="button" className="tier-secondary-action" onClick={() => void refreshSavedNutrition().catch(() => setMessage('Today’s nutrition could not be loaded. Try again.'))}>Retry loading nutrition</button> : null}

          {micronutrientsEnabled && nutrientInsightScope.current === guidanceScope && nutrientInsights.length ? (
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

          {supplementScope.current === guidanceScope && supplementRecommendation && !supplementDismissed ? (
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

          {!isEmber ? (
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
                  {currentSuggestedFoodsState === 'loading' ? (
                    <p className="tier-calendar-empty">Finding today’s best matches...</p>
                  ) : null}

                  {currentSuggestedFoodsState === 'unavailable' ? (
                    <p className="tier-calendar-empty">No food suggestions are available for your current preferences. You can still {foodLoggingEnabled ? 'record foods in the food log' : 'enter your macro totals'}.</p>
                  ) : null}

                  {currentSuggestedFoodsState === 'complete' ? (
                    <p className="tier-calendar-empty">No additional food suggestions based on your logged intake.</p>
                  ) : null}

                  {currentSuggestedFoodsState === 'error' ? (
                    <p className="tier-calendar-empty">{suggestedFoodsMessage}</p>
                  ) : null}

                  {currentSuggestedFoodsState === 'ready' && currentSuggestedFoods.length ? (
                    <div className="nutrition-suggested-foods-list">
                      {suggestedFoodsBasis !== 'remaining' ? <p className="tier-calendar-empty">{suggestedFoodsBasis === 'targets' ? 'Starting options based on today’s targets. No prior meal logs needed.' : 'Starting food options. Log intake to personalize your remaining targets.'}</p> : null}
                      {currentSuggestedFoods.map((food) => (
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
          ) : null}

          {micronutrientsEnabled ? <section className="tier-info-panel nutrition-management-panel" data-testid="nutrition-management-panel">
            <div className="tier-tab-list nutrition-management-tabs" role="tablist" aria-label="Nutrition management">
              {managementTabs.map((item) => (
                <button key={item.key} type="button" className={managementTab === item.key ? 'is-active' : ''} onClick={() => setManagementTab(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>

            {micronutrientsEnabled && nutritionLogIsCurrent && managementTab === 'micros' ? (
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
          </section> : null}
        </section>

      </div>
        <details className="phone-app-report"><summary>Allergies &amp; intolerances report · Unavailable</summary><p>No verified allergy or intolerance report is connected to this app. Saved food preferences do not constitute a diagnosis or verified report.</p><a href="/support">Ask about report availability</a></details>
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
