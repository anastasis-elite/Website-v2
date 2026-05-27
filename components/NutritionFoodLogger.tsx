'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type Food = {
  id: string
  name: string
}

type Props = {
  nutritionLogId: string
}

export default function NutritionFoodLogger({ nutritionLogId }: Props) {
  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [servingAmount, setServingAmount] = useState('1')
  const [mealName, setMealName] = useState('Breakfast')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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
        Search Foods
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
        Add Meal
      </button>

      {message && (
        <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>
          {message}
        </p>
      )}
    </div>
  )
}
