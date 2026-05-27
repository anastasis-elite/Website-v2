'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type Food = {
  id: string
  name: string
}

type Remaining = {
  calories_remaining: number | null
  protein_remaining_g: number | null
  carbs_remaining_g: number | null
  fat_remaining_g: number | null
  fiber_remaining_g: number | null
  sodium_remaining_mg: number | null
  potassium_remaining_mg: number | null
  magnesium_remaining_mg: number | null
  calcium_remaining_mg: number | null
  iron_remaining_mg: number | null
  choline_remaining_mg: number | null
  vitamin_c_remaining_mg: number | null
  vitamin_d_remaining_mcg: number | null
}

type Props = {
  nutritionLogId: string
  initialRemaining?: Remaining | null
}

function roundValue(value: number | null | undefined) {
  return Math.round(Number(value || 0))
}

export default function NutritionFoodLogger({
  nutritionLogId,
  initialRemaining = null,
}: Props) {
  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [servingAmount, setServingAmount] = useState('1')
  const [mealName, setMealName] = useState('Breakfast')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState<Remaining | null>(initialRemaining)

  async function searchFoods() {
    setLoading(true)
    setMessage('')

    const res = await fetch(
      `/api/nutrition/search-foods?q=${encodeURIComponent(search)}`
    )

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Food search failed.')
      setLoading(false)
      return
    }

    setFoods(data.foods || [])
    setLoading(false)
  }

  async function addMeal() {
    if (!selectedFood) {
      setMessage('Select a food first.')
      return
    }

    setLoading(true)
    setMessage('')

    const res = await fetch('/api/nutrition/add-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nutritionLogId,
        foodId: selectedFood.id,
        mealName,
        servingAmount: Number(servingAmount),
        servingUnit: 'serving',
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to add meal.')
      setLoading(false)
      return
    }

    if (data.remaining) {
      setRemaining(data.remaining)
    }
    setMessage('Meal added.')
    setSearch('')
    setFoods([])
    setSelectedFood(null)
    setServingAmount('1')
    setLoading(false)
  }

  return (
    <div>
      <div style={styles.fieldWrap}>
        <label style={styles.labelStyle}>Meal</label>
        <input
          style={styles.inputStyle}
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
        />
      </div>

      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label style={styles.labelStyle}>Search Food</label>
        <input
          style={styles.inputStyle}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="egg, rice, yogurt..."
        />
      </div>

      <button
        type="button"
        style={{ ...styles.primaryButtonStyle, marginTop: '18px' }}
        onClick={searchFoods}
        disabled={loading || !search.trim()}
      >
        {loading ? 'Searching...' : 'Search Foods'}
      </button>

      <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
        {foods.map((food) => (
          <button
            key={food.id}
            type="button"
            onClick={() => setSelectedFood(food)}
            style={{
              ...styles.secondaryButtonStyle,
              textAlign: 'left',
              opacity: selectedFood?.id === food.id ? 1 : 0.7,
            }}
          >
            {food.name}
          </button>
        ))}
      </div>

      {selectedFood && (
        <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>
          Selected: <strong>{selectedFood.name}</strong>
        </p>
      )}

      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label style={styles.labelStyle}>Serving Amount</label>
        <input
          style={styles.inputStyle}
          type="number"
          min="0"
          step="0.25"
          value={servingAmount}
          onChange={(e) => setServingAmount(e.target.value)}
        />
      </div>

      <button
        type="button"
        style={{ ...styles.primaryButtonStyle, marginTop: '18px' }}
        onClick={addMeal}
        disabled={loading || !selectedFood}
      >
        {loading ? 'Adding...' : 'Add Meal'}
      </button>

      {message && (
        <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>
          {message}
        </p>
      )}

      {remaining && (
        <div style={{ marginTop: '28px' }}>
          <h3 style={styles.sectionTitleStyle}>Remaining Macros</h3>

          <div style={styles.compactCardGridStyle}>
            <div style={styles.compactCardStyle}>
              <h4 style={styles.compactCardTitleStyle}>Calories</h4>
              <p style={styles.compactCardTextStyle}>
                {roundValue(remaining.calories_remaining)}
              </p>
            </div>

            <div style={styles.compactCardStyle}>
              <h4 style={styles.compactCardTitleStyle}>Protein</h4>
              <p style={styles.compactCardTextStyle}>
                {roundValue(remaining.protein_remaining_g)}g
              </p>
            </div>

            <div style={styles.compactCardStyle}>
              <h4 style={styles.compactCardTitleStyle}>Carbs</h4>
              <p style={styles.compactCardTextStyle}>
                {roundValue(remaining.carbs_remaining_g)}g
              </p>
            </div>

            <div style={styles.compactCardStyle}>
              <h4 style={styles.compactCardTitleStyle}>Fats</h4>
              <p style={styles.compactCardTextStyle}>
                {roundValue(remaining.fat_remaining_g)}g
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
