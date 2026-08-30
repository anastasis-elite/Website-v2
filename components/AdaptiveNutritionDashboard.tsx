'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import NutritionFoodLogger from '@/components/NutritionFoodLogger'
import { useRouter } from 'next/navigation'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { useFuelReadinessEngine, useNutritionEngine, usePhoenixRecipes } from '@/components/nutrition/hooks'
import { canLogFood, normalizeProgramTier } from '@/lib/nutrition/canLogFood'
import { getClientLocalDateOffset } from '@/lib/timezone'

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
}: {
  program: string
  logic: ProgramLogicOutput
  recipes: PhoenixRecipe[]
}) {
  const router=useRouter()
  const supabase = createClient()
  const engineNutrition=useNutritionEngine(logic)
  const fuel=useFuelReadinessEngine(logic)
  const phoenixRecipes=usePhoenixRecipes(recipes)

  const tier = normalizeProgramTier(program || logic.program || logic.client.program)
  const isEmber = tier === 'ember'
  const isIgnite = tier === 'ignite'
  const isPhoenix = tier === 'phoenix'
  const foodLoggingEnabled = canLogFood(tier)

  const [loading, setLoading] = useState(true)
  const [nutritionLog, setNutritionLog] = useState<NutritionLog | null>(null)
  const [remaining, setRemaining] = useState<Remaining | null>(null)

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

  const [waterOunces, setWaterOunces] = useState(8);
  const [addingWater, setAddingWater] = useState(false);
  const [progressTab, setProgressTab] = useState<ProgressTab>('daily')
  const [intakeTab, setIntakeTab] = useState<IntakeTab>('water')
  const [managementTab, setManagementTab] = useState<ManagementTab>('goals')
  const [suggestedFoods, setSuggestedFoods] = useState<SuggestedFood[]>([])
  const [suggestedFoodsState, setSuggestedFoodsState] = useState<'idle' | 'loading' | 'ready' | 'needs_logs' | 'complete' | 'error'>('idle')
  const [suggestedFoodsMessage, setSuggestedFoodsMessage] = useState('')

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
    } catch (error) {
      setSuggestedFoods([])
      setSuggestedFoodsState('error')
      setSuggestedFoodsMessage(error instanceof Error ? error.message : 'Suggested foods could not be loaded.')
    }
  }, [nutritionLog?.id])
  
  async function addWater() {
  setAddingWater(true);
  setMessage('');

  try {
    const response = await fetch('/api/nutrition/add-water', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: logic.client.id,
        ounces: waterOunces,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || 'Water could not be saved.');
      return;
    }

    router.refresh();
  } catch {
    setMessage('Water could not be saved.');
  } finally {
    setAddingWater(false);
  }
}
  
  async function handleFoodUpdated(updatedRemaining?: Remaining | null, action: 'added' | 'removed' = 'added') {
    if (updatedRemaining) {
      setRemaining(updatedRemaining)
    }

    await loadToday()
    setMessage(
      action === 'removed'
        ? 'Food removed — today’s calories, macros, and micronutrients are updated.'
        : 'Food logged — today’s calories, macros, and micronutrients are updated.'
    )
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
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Macros could not be saved.')
      setMacroEntry({ calories: '', protein: '', carbs: '', fats: '' })
      await loadToday()
      setMessage('Macros logged.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Macros could not be saved.')
    } finally {
      setSavingMacros(false)
    }
  }

  useEffect(() => {
    loadToday()
  }, [])

  useEffect(() => {
    void loadSuggestedFoods()
  }, [loadSuggestedFoods, remaining])

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

  async function loadToday() {
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

    let { data: log } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', clientId)
      .eq('log_date', today)
      .maybeSingle()

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
    const { data: remainingData } = await supabase
      .from('nutrition_log_remaining')
      .select('*')
      .eq('nutrition_log_id', log.id)
      .maybeSingle()

    setRemaining(remainingData)

    const initialProtein = String(log.protein || remainingData?.protein_remaining_g || '')
    const initialCarbs = String(log.carbs || remainingData?.carbs_remaining_g || '')
    const initialFat = String(log.fats || remainingData?.fat_remaining_g || '')

    setProteinTarget(initialProtein)
    setCarbTarget(initialCarbs)
    setFatTarget(initialFat)
    setCalorieTarget(Number(log.calories || calculateCalories(initialProtein, initialCarbs, initialFat)))

    setLoading(false)
  }

  const microRows = [
    ['Fiber', nutritionLog?.fiber_target_g, remaining?.fiber_remaining_g, 'g'],
    ['Sodium', nutritionLog?.sodium_target_mg, remaining?.sodium_remaining_mg, 'mg'],
    ['Potassium', nutritionLog?.potassium_target_mg, remaining?.potassium_remaining_mg, 'mg'],
    ['Magnesium', nutritionLog?.magnesium_target_mg, remaining?.magnesium_remaining_mg, 'mg'],
    ['Calcium', nutritionLog?.calcium_target_mg, remaining?.calcium_remaining_mg, 'mg'],
    ['Iron', nutritionLog?.iron_target_mg, remaining?.iron_remaining_mg, 'mg'],
    ['Zinc', nutritionLog?.zinc_target_mg, remaining?.zinc_remaining_mg, 'mg'],
    ['Selenium', nutritionLog?.selenium_target_mcg, remaining?.selenium_remaining_mcg, 'mcg'],
    ['Choline', nutritionLog?.choline_target_mg, remaining?.choline_remaining_mg, 'mg'],
    ['Vitamin A', nutritionLog?.vitamin_a_target_mcg, remaining?.vitamin_a_remaining_mcg, 'mcg'],
    ['Vitamin C', nutritionLog?.vitamin_c_target_mg, remaining?.vitamin_c_remaining_mg, 'mg'],
    ['Vitamin D', nutritionLog?.vitamin_d_target_mcg, remaining?.vitamin_d_remaining_mcg, 'mcg'],
    ['Vitamin E', nutritionLog?.vitamin_e_target_mg, remaining?.vitamin_e_remaining_mg, 'mg'],
    ['Vitamin K', nutritionLog?.vitamin_k_target_mcg, remaining?.vitamin_k_remaining_mcg, 'mcg'],
    ['B1', nutritionLog?.b1_target_mg, remaining?.b1_remaining_mg, 'mg'],
    ['B2', nutritionLog?.b2_target_mg, remaining?.b2_remaining_mg, 'mg'],
    ['B3', nutritionLog?.b3_target_mg, remaining?.b3_remaining_mg, 'mg'],
    ['B5', nutritionLog?.b5_target_mg, remaining?.b5_remaining_mg, 'mg'],
    ['B6', nutritionLog?.b6_target_mg, remaining?.b6_remaining_mg, 'mg'],
    ['B9', nutritionLog?.b9_target_mcg, remaining?.b9_remaining_mcg, 'mcg'],
    ['B12', nutritionLog?.b12_target_mcg, remaining?.b12_remaining_mcg, 'mcg'],
  ]

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
                    setIntakeTab('meal')
                    requestAnimationFrame(() => document.getElementById(foodLoggingEnabled ? 'aos-food-logger' : 'aos-macro-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                  }}
                  className="tier-primary-action"
                >
                  {isEmber ? 'Add Macros' : 'Log Food'}
                </button>
              ) : null}
            </div>
            <p>{fuel.displayStatus}. {fuel.reasoning}</p>
            <small>What to eat next: {engineNutrition.mealSuggestions[0]}</small>
            <div className="nutrition-objective-metrics">
              <article><span>Calories</span><strong>{roundValue(macroMetrics[0]?.consumed)} / {roundValue(macroMetrics[0]?.target)} cal</strong></article>
              <article><span>Remaining</span><strong>{roundValue(macroMetrics[0]?.remaining)} cal</strong></article>
              <article><span>Water</span><strong>{roundValue(logic.hydration.consumed)} / {roundValue(logic.hydration.target)} oz</strong></article>
            </div>
          </article>

          {loading && <p className="nutrition-status">Loading...</p>}
          {message && <p className="nutrition-status">{message}</p>}

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
                  <h2>{intakeTab === 'water' ? 'Water' : intakeTab === 'suggested' ? 'Suggested Foods' : isEmber ? 'Macro Entry' : 'Food Log'}</h2>
                </div>
                <div className="tier-tab-list nutrition-panel-tabs" role="tablist" aria-label="Intake controls">
                  {([
                    ['water', 'Water'],
                    ['meal', 'Food Log'],
                    ['suggested', 'Suggested Foods'],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" className={intakeTab === key ? 'is-active' : ''} onClick={() => setIntakeTab(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {intakeTab === 'water' ? (
                <div id="hydration" className="nutrition-water-panel">
                  <div className="nutrition-water-summary">
                    <div className="tier-metric-ring" style={{ '--tier-progress': `${progressPercent(logic.hydration.percent) * 3.6}deg` } as CSSProperties}>
                      <strong>{progressPercent(logic.hydration.percent)}%</strong>
                    </div>
                    <div>
                      <span>Current Water</span>
                      <strong>{roundValue(logic.hydration.consumed)} / {roundValue(logic.hydration.target)} oz</strong>
                      <small>{logic.hydration.prompt}</small>
                    </div>
                  </div>

                  <div className="nutrition-water-control">
                    <div>
                      <span>Add Water</span>
                      <strong>{waterOunces} oz</strong>
                    </div>
                    <input
                      id="water-ounces"
                      type="range"
                      min="4"
                      max="64"
                      step="4"
                      value={waterOunces}
                      onChange={(event) => setWaterOunces(Number(event.target.value))}
                      disabled={addingWater}
                      aria-label="Water amount to add"
                    />
                    <div><small>4 oz</small><small>64 oz</small></div>
                    <button type="button" onClick={addWater} disabled={addingWater} className="tier-primary-action">
                      {addingWater ? 'Adding Water...' : `Add ${waterOunces} oz`}
                    </button>
                  </div>
                </div>
              ) : null}

              {intakeTab === 'meal' ? (
                <div id={foodLoggingEnabled ? 'aos-food-logger' : 'aos-macro-entry'} className="nutrition-log-meal-panel">
                  {foodLoggingEnabled && nutritionLog?.id ? (
                    <NutritionFoodLogger
                      nutritionLogId={nutritionLog.id}
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
                      {loading ? 'Preparing food logging...' : message || 'Food logging could not be prepared yet.'}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {intakeTab === 'suggested' ? (
                <div className="nutrition-suggested-foods-panel" data-testid="nutrition-suggested-foods-tab">
                  {suggestedFoodsState === 'loading' ? (
                    <p className="tier-calendar-empty">Finding today’s best matches...</p>
                  ) : null}

                  {suggestedFoodsState === 'needs_logs' ? (
                    <p className="tier-calendar-empty">Log your meals and we’ll help you fill the gaps.</p>
                  ) : null}

                  {suggestedFoodsState === 'complete' ? (
                    <p className="tier-calendar-empty">You’re well covered today.</p>
                  ) : null}

                  {suggestedFoodsState === 'error' ? (
                    <p className="tier-calendar-empty">{suggestedFoodsMessage}</p>
                  ) : null}

                  {suggestedFoodsState === 'ready' && suggestedFoods.length ? (
                    <div className="nutrition-suggested-foods-list">
                      {suggestedFoods.map((food) => (
                        <article key={food.foodId} className="nutrition-suggested-food-card">
                          <div>
                            <span>{food.contribution}</span>
                            <strong>{food.name}</strong>
                            <small>{food.serving || 'Serving available in food log'}</small>
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
              <div className="nutrition-micro-grid" data-testid="nutrition-micronutrients-tab">
                {microRows.map(([label, target, remainingValue, unit]) => {
                  const targetValue = Number(target || 0)
                  const leftValue = Number(remainingValue || 0)
                  const currentValue = targetValue ? Math.max(0, Math.round((targetValue - leftValue) * 10) / 10) : 0
                  return (
                    <article key={String(label)}>
                      <span>{label}</span>
                      <strong>{currentValue}{unit}</strong>
                      <small>Target: {targetValue}{unit} · Remaining: {leftValue}{unit}</small>
                    </article>
                  )
                })}
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
      <a href={`/dashboard/nutrition#aos-food-logger?recipe=${recipe.id}`} className="tier-primary-action">Log this recipe</a>
    </details>
  )
}
