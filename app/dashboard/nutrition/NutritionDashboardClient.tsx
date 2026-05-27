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

export default function NutritionDashboardClient() {
  const supabase = createClient()

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
      setMessage('No nutrition log exists for today yet.')
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

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Nutrition Intelligence</p>

        <h1 style={styles.h1Style}>Today’s Intake</h1>

        {loading && <p style={styles.bodyStyle}>Loading...</p>}

        {message && <p style={styles.bodyStyle}>{message}</p>}

        {remaining && (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.h2Style}>Remaining Today</h2>

            <div style={styles.cardGridStyle}>
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Calories</h3>
                <p style={styles.cardTextStyle}>{remaining.calories_remaining}</p>
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Protein</h3>
                <p style={styles.cardTextStyle}>{remaining.protein_remaining_g}g</p>
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Carbs</h3>
                <p style={styles.cardTextStyle}>{remaining.carbs_remaining_g}g</p>
              </div>

              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Fat</h3>
                <p style={styles.cardTextStyle}>{remaining.fat_remaining_g}g</p>
              </div>
            </div>
          </section>
        )}

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
      </div>
    </main>
  )
}
