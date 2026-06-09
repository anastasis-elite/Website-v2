'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as styles from '@/app/styles/globalstyles'

type Food = {
  id: string
  name: string
}

type Remaining = {
  calories_remaining: number
  protein_remaining_g: number
  carbs_remaining_g: number
  fat_remaining_g: number
  fiber_remaining_g: number
  sodium_remaining_mg: number
  potassium_remaining_mg: number
  magnesium_remaining_mg: number
  calcium_remaining_mg: number
  iron_remaining_mg: number
  choline_remaining_mg: number
  vitamin_c_remaining_mg: number
  vitamin_d_remaining_mcg: number
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
  const [nutritionLogId, setNutritionLogId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<Remaining | null>(null)

  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selectedFoodId, setSelectedFoodId] = useState('')
  const [servingAmount, setServingAmount] = useState('1')
  const [mealName, setMealName] = useState('Breakfast')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadToday()
  }, [])

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
      .select('id')
      .eq('client_id', client.id)
      .eq('log_date', today)
      .maybeSingle()

    if (!log) {
      setMessage('No nutrition targets exist for today yet.')
      setLoading(false)
      return
    }

    setNutritionLogId(log.id)

    const { data: remainingData } = await supabase
      .from('nutrition_log_remaining')
      .select('*')
      .eq('nutrition_log_id', log.id)
      .maybeSingle()

    setRemaining(remainingData)
    setLoading(false)
  }

  async function searchFoods() {
    const { data } = await supabase
      .from('foods')
      .select('id, name')
      .ilike('normalized_name', `%${search.toLowerCase()}%`)
      .limit(12)

    setFoods(data || [])
  }

  async function addMealEntry() {
    if (!nutritionLogId || !selectedFoodId) return

    const { error } = await supabase.from('meal_entries').insert({
      nutrition_log_id: nutritionLogId,
      food_id: selectedFoodId,
      meal_name: mealName,
      serving_amount: Number(servingAmount),
      serving_unit: 'serving',
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Meal added.')
    setSearch('')
    setFoods([])
    setSelectedFoodId('')
    await loadToday()
  }

  const calculatedCalories = remaining
    ? Number(remaining.protein_remaining_g || 0) * 4 +
      Number(remaining.carbs_remaining_g || 0) * 4 +
      Number(remaining.fat_remaining_g || 0) * 9
    : 0

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
            : 'Track intake and understand what remains for the day.'}
        </p>

        {loading && <p style={styles.bodyStyle}>Loading...</p>}

        {message && <p style={styles.bodyStyle}>{message}</p>}

        {remaining && (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.h2Style}>
              {isEmber ? 'Targets Today' : 'Remaining Today'}
            </h2>

            <div style={styles.cardGridStyle}>
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Calories</h3>
                <p style={styles.cardTextStyle}>
                  {isEmber
                    ? Math.round(calculatedCalories)
                    : remaining.calories_remaining}
                </p>
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Protein</h3>
                <p style={styles.cardTextStyle}>
                  {remaining.protein_remaining_g}g
                </p>
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Carbs</h3>
                <p style={styles.cardTextStyle}>
                  {remaining.carbs_remaining_g}g
                </p>
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Fat</h3>
                <p style={styles.cardTextStyle}>
                  {remaining.fat_remaining_g}g
                </p>
              </div>
            </div>
          </section>
        )}

        {isEmber ? (
          <section style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>Hydration</p>

            <h2 style={styles.h2Style}>
              Water target active
            </h2>

            <p style={styles.bodyStyle}>
              Use your water target as a daily anchor. Hydration supports
              training output, digestion, recovery, and cycle-related fluid
              shifts.
            </p>
          </section>
        ) : null}

        {!isEmber ? (
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
                  onClick={() => setSelectedFoodId(food.id)}
                  style={{
                    ...styles.secondaryButtonStyle,
                    textAlign: 'left',
                    opacity: selectedFoodId === food.id ? 1 : 0.75,
                  }}
                >
                  {food.name}
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
