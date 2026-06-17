'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as styles from '@/app/styles/globalstyles'

type Food = {
  id: string
  name: string
  serving_unit?: string | null
  serving_size?: number | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
}

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
}: {
  program: string
}) {
  const supabase = createClient()

  const tier = String(program || 'ember').toLowerCase()
  const isEmber = tier === 'ember'
  const isIgnite = tier === 'ignite'
  const isPhoenix = tier === 'phoenix'

  const [loading, setLoading] = useState(true)
  const [nutritionLog, setNutritionLog] = useState<NutritionLog | null>(null)
  const [remaining, setRemaining] = useState<Remaining | null>(null)

  const [calorieTarget, setCalorieTarget] = useState(0)
  const [proteinTarget, setProteinTarget] = useState('')
  const [carbTarget, setCarbTarget] = useState('')
  const [fatTarget, setFatTarget] = useState('')

  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selectedFoodId, setSelectedFoodId] = useState('')
  const [servingAmount, setServingAmount] = useState('1')
  const [servingUnit, setServingUnit] = useState('serving')
  const [mealName, setMealName] = useState('Breakfast')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadToday()
  }, [])

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

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!client) {
      setMessage('No client profile found yet.')
      setLoading(false)
      return
    }

    const today = new Date().toISOString().slice(0, 10)

    const { data: log } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', client.id)
      .eq('log_date', today)
      .maybeSingle()

    if (!log) {
      setMessage('No nutrition targets exist for today yet.')
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

  async function searchFoods() {
    const { data, error } = await supabase
      .from('foods')
      .select(
        'id, name, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g'
      )
      .ilike('normalized_name', `%${search.toLowerCase()}%`)
      .limit(12)

    if (error) {
      setMessage(error.message)
      return
    }

    setFoods(data || [])
  }

  async function addMealEntry() {
    if (!nutritionLog?.id || !selectedFoodId) return

    const { error } = await supabase.from('meal_entries').insert({
      nutrition_log_id: nutritionLog.id,
      food_id: selectedFoodId,
      meal_name: mealName,
      serving_amount: Number(servingAmount),
      serving_unit: servingUnit,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Meal added.')
    setSearch('')
    setFoods([])
    setSelectedFoodId('')
    setServingAmount('1')
    setServingUnit('serving')
    await loadToday()
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
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
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
                    onChange={(e) => {
                      const nextProtein = e.target.value
                      setProteinTarget(nextProtein)
                      setCalorieTarget(calculateCalories(nextProtein, carbTarget, fatTarget))
                    }}
                    style={styles.inputStyle}
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
                    onChange={(e) => {
                      const nextCarbs = e.target.value
                      setCarbTarget(nextCarbs)
                      setCalorieTarget(calculateCalories(proteinTarget, nextCarbs, fatTarget))
                    }}
                    style={styles.inputStyle}
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
                    onChange={(e) => {
                      const nextFat = e.target.value
                      setFatTarget(nextFat)
                      setCalorieTarget(calculateCalories(proteinTarget, carbTarget, nextFat))
                    }}
                    style={styles.inputStyle}
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
              {microRows.map(([label, target, remainingValue, unit]) => (
                <div key={String(label)} style={styles.compactCardStyle}>
                  <h3 style={styles.compactCardTitleStyle}>{label}</h3>
                  <p style={styles.compactCardTextStyle}>
                    Target: {target ?? 0}
                    {unit}
                    <br />
                    Remaining: {remainingValue ?? 0}
                    {unit}
                  </p>
                </div>
              ))}
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

        {(isIgnite || isPhoenix) ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.h2Style}>Add Food</h2>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>Meal</label>
              <input
                style={styles.inputStyle}
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
              />
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.labelStyle}>Search food</label>
              <input
                style={styles.inputStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="eggs, rice, yogurt..."
              />
            </div>

            <button style={styles.primaryButtonStyle} onClick={searchFoods}>
              Search Foods
            </button>

            <div style={{ marginTop: '20px', display: 'grid', gap: '10px' }}>
              {foods.map((food) => (
                <button
                  key={food.id}
                  onClick={() => {
                    setSelectedFoodId(food.id)
                    setServingUnit(food.serving_unit || 'serving')
                  }}
                  style={{
                    ...styles.secondaryButtonStyle,
                    textAlign: 'left',
                    opacity: selectedFoodId === food.id ? 1 : 0.75,
                  }}
                >
                  {food.name}
                  {food.calories ? ` — ${food.calories} cal` : ''}
                  {food.serving_size || food.serving_unit
                    ? ` / ${food.serving_size || 1} ${food.serving_unit || 'serving'}`
                    : ''}
                </button>
              ))}
            </div>

            <div style={{ ...styles.fieldWrap, marginTop: '22px' }}>
              <label style={styles.labelStyle}>Serving amount</label>
              <input
                style={styles.inputStyle}
                value={servingAmount}
                onChange={(e) => setServingAmount(e.target.value)}
                type="number"
                min="0"
                step="0.25"
              />
            </div>

            <div style={{ ...styles.fieldWrap, marginTop: '22px' }}>
              <label style={styles.labelStyle}>Serving unit</label>
              <input
                style={styles.inputStyle}
                value={servingUnit}
                onChange={(e) => setServingUnit(e.target.value)}
              />
            </div>

            <button
              style={{ ...styles.primaryButtonStyle, marginTop: '20px' }}
              onClick={addMealEntry}
            >
              Add Meal
            </button>
          </section>
        ) : null}

        {isPhoenix ? (
          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Phoenix Nutrition</p>
            <h2 style={styles.h2Style}>
              Adaptive meal suggestions are preparing.
            </h2>
            <p style={styles.bodyStyle}>
              Phoenix will use remaining macros, micros, symptoms, timing,
              cycle phase, and preferences to recommend meals and recipes.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  )
}
