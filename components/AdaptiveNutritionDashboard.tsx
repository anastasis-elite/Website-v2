'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as styles from '@/app/styles/globalstyles'
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
  const [addingWater,setAddingWater]=useState(false)
  const [foodLoggerOpen, setFoodLoggerOpen] = useState(isIgnite)

  async function addWater(){setAddingWater(true);const response=await fetch('/api/nutrition/add-water',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:logic.client.id,ounces:8})});const payload=await response.json();setAddingWater(false);if(!response.ok){setMessage(payload.error||'Water could not be saved.');return}router.refresh()}

  async function handleFoodUpdated() {
    await loadToday()
    setMessage('Food logged — today’s calories and macros are updated.')
    router.refresh()
  }

  useEffect(() => {
    loadToday()
  }, [])

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

  return (
    <main className="aos-nutrition-page">
      <div className="aos-nutrition-shell">
        <p style={styles.eyebrowStyle}>
          {isEmber ? 'Nutrition Targets' : 'Nutrition Intelligence'}
        </p>

        <h1 style={styles.h1Style}>
          {isEmber ? 'Today’s Targets' : 'Today’s Intake'}
        </h1>

        <p style={styles.heroTextStyle}>
          {isEmber
            ? 'Ember gives you the macro and hydration targets to support your training, cycle phase, and recovery.'
            : 'Track intake against your macro and micronutrient targets.'}
        </p>

        {loading && <p style={styles.bodyStyle}>Loading...</p>}
        {message && <p style={styles.bodyStyle}>{message}</p>}

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Today&apos;s Fuel Readiness</p>
          <h2 style={styles.h2Style}>{fuel.displayStatus}</h2>
          <p style={styles.bodyStyle}>{fuel.reasoning}</p>
          <p style={styles.bodyStyle}><strong>What to eat next:</strong> {engineNutrition.mealSuggestions[0]}</p>
          {foodLoggingEnabled && nutritionLog?.id ? (
            <button
              type="button"
              onClick={() => {
                setFoodLoggerOpen(true)
                requestAnimationFrame(() => document.getElementById('aos-food-logger')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
              }}
              style={{ ...styles.primaryButtonStyle, margin: '16px 0 0' }}
            >
              Log Food
            </button>
          ) : null}
          <div style={styles.cardGridStyle}><div style={styles.compactCardStyle}><h3 style={styles.compactCardTitleStyle}>Before training</h3><p style={styles.compactCardTextStyle}>{fuel.preWorkoutAction}</p></div><div style={styles.compactCardStyle}><h3 style={styles.compactCardTitleStyle}>Workout effect</h3><p style={styles.compactCardTextStyle}>{fuel.workoutAdjustment}</p></div><div style={styles.compactCardStyle}><h3 style={styles.compactCardTitleStyle}>After training</h3><p style={styles.compactCardTextStyle}>{fuel.postWorkoutPriority}</p></div></div>
        </section>

        <section style={styles.cartBoxStyle}><p style={styles.eyebrowStyle}>Hydration</p><h2 style={styles.h2Style}>{logic.hydration.consumed} / {logic.hydration.target} oz</h2><p style={styles.bodyStyle}>{logic.hydration.prompt} {logic.hydration.remaining} oz remain.</p><div style={{height:8,borderRadius:99,overflow:'hidden',background:'rgba(255,255,255,.08)'}}><span style={{display:'block',width:`${logic.hydration.percent}%`,height:'100%',background:'linear-gradient(90deg,#c6482d,#ee7d40)'}}/></div><button type="button" onClick={addWater} disabled={addingWater} style={{...styles.primaryButtonStyle,marginTop:18}}>{addingWater?'Adding…':'+ Add 8 oz'}</button></section>

        {nutritionLog && (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.h2Style}>
              {isEmber ? 'Targets Today' : 'Macro Targets + Remaining'}
            </h2>

            <div style={styles.cardGridStyle}>
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Calories</h3>
                {isEmber ? (
                  <input
                    type="number"
                    value={calorieTarget}
                    readOnly
                    style={{ ...styles.inputStyle, opacity: 0.85 }}
                  />
                ) : (
                  <p style={styles.cardTextStyle}>
                    Target: {nutritionLog.calories ?? 0}
                    <br />
                    Remaining: {remaining?.calories_remaining ?? 0}
                  </p>
                )}
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Protein</h3>
                {isEmber ? (
                  <input
                    type="number"
                    value={proteinTarget}
                    readOnly
                    style={{ ...styles.inputStyle, opacity: 0.85 }}
                  />
                ) : (
                  <p style={styles.cardTextStyle}>
                    Target: {nutritionLog.protein ?? 0}g
                    <br />
                    Remaining: {remaining?.protein_remaining_g ?? 0}g
                  </p>
                )}
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Carbs</h3>
                {isEmber ? (
                  <input
                    type="number"
                    value={carbTarget}
                    readOnly
                    style={{ ...styles.inputStyle, opacity: 0.85 }}
                  />
                ) : (
                  <p style={styles.cardTextStyle}>
                    Target: {nutritionLog.carbs ?? 0}g
                    <br />
                    Remaining: {remaining?.carbs_remaining_g ?? 0}g
                  </p>
                )}
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Fat</h3>
                {isEmber ? (
                  <input
                    type="number"
                    value={fatTarget}
                    readOnly
                    style={{ ...styles.inputStyle, opacity: 0.85 }}
                  />
                ) : (
                  <p style={styles.cardTextStyle}>
                    Target: {nutritionLog.fats ?? 0}g
                    <br />
                    Remaining: {remaining?.fat_remaining_g ?? 0}g
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {foodLoggingEnabled ? (
  <section id="aos-food-logger" data-tier={tier} style={styles.cartBoxStyle}>
    <p style={styles.eyebrowStyle}>Food Logging</p>

    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <h2 style={{ ...styles.h2Style, marginBottom: 0 }}>Log Food</h2>
      {nutritionLog?.id && !isIgnite ? (
        <button type="button" onClick={() => setFoodLoggerOpen((open) => !open)} style={styles.secondaryButtonStyle}>
          {foodLoggerOpen ? 'Hide Logger' : 'Open Logger'}
        </button>
      ) : null}
    </div>

    {nutritionLog?.id ? (isIgnite || foodLoggerOpen) ? (
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
          choline_remaining_mg: remaining.choline_remaining_mg ?? null,
          vitamin_c_remaining_mg: remaining.vitamin_c_remaining_mg ?? null,
          vitamin_d_remaining_mcg: remaining.vitamin_d_remaining_mcg ?? null,
        }
      : null
  }
  onUpdated={handleFoodUpdated}
/>
    ) : (
      <p style={{ ...styles.bodyStyle, marginTop: 16 }}>Open the logger to search foods, choose a serving size, and update today’s macros.</p>
    ) : (
      <p style={{ ...styles.bodyStyle, marginTop: 16 }}>
        {loading ? 'Preparing food logging…' : message || 'Food logging could not be prepared yet.'}
      </p>
    )}
  </section>
) : null}

        {(isIgnite || isPhoenix) && nutritionLog ? (
          <details style={styles.cartBoxStyle}>
            <summary
              style={{
                ...styles.sectionTitleStyle,
                cursor: 'pointer',
                marginBottom: 0,
              }}
            >
              Micronutrient Targets + Remaining
            </summary>

            <div style={{ ...styles.cardGridStyle, marginTop: '28px' }}>
              {microRows.map(([label, target, remainingValue, unit]) => {
                const targetValue = Number(target || 0)
                const leftValue = Number(remainingValue || 0)
                const currentValue = targetValue ? Math.max(0, Math.round((targetValue - leftValue) * 10) / 10) : 0
                return (
                  <div key={String(label)} style={styles.compactCardStyle}>
                    <h3 style={styles.compactCardTitleStyle}>{label}</h3>
                    <p style={styles.compactCardTextStyle}>
                      Current: {currentValue}
                      {unit}
                      <br />
                      Target: {targetValue}
                      {unit}
                      <br />
                      Remaining: {leftValue}
                      {unit}
                    </p>
                  </div>
                )
              })}
            </div>
          </details>
        ) : null}

        {isEmber ? (
          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Hydration</p>
            <h2 style={styles.h2Style}>Water target active</h2>
            <p style={styles.bodyStyle}>
              Use your water target as a daily anchor. Hydration supports
              training output, digestion, recovery, and cycle-related fluid
              shifts.
            </p>
          </section>
        ) : null}

        {isPhoenix ? (
          <section id="phoenix-recipes" style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Phoenix Nutrition</p>
            <h2 style={styles.h2Style}>Simple meals that fit today.</h2>
            <p style={styles.bodyStyle}>Choose one only if deciding what to eat feels heavy.</p>
            <div style={styles.cardGridStyle}>{phoenixRecipes.map((recipe)=><Recipe key={recipe.id} recipe={recipe}/>)}</div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function Recipe({ recipe }: { recipe: PhoenixRecipe }) {
  return <details style={styles.cardStyle}><summary style={{cursor:'pointer'}}><h3 style={styles.cardTitleStyle}>{recipe.title}</h3><p style={styles.cardTextStyle}>{recipe.reason}</p><small>{recipe.prepMinutes} min · {recipe.macros.protein}g protein · {recipe.macros.calories} cal</small></summary><h4>Ingredients</h4><ul>{recipe.ingredients.map((item)=><li key={item}>{item}</li>)}</ul><h4>Simple steps</h4><ol>{recipe.steps.map((step)=><li key={step}>{step}</li>)}</ol></details>
}
