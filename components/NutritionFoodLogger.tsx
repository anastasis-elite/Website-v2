'use client'

import { useCallback, useEffect, useState } from 'react'
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
  zinc_remaining_mg?: number | null
  selenium_remaining_mcg?: number | null
  choline_remaining_mg: number | null
  vitamin_a_remaining_mcg?: number | null
  vitamin_c_remaining_mg: number | null
  vitamin_d_remaining_mcg: number | null
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

type Props = {
  nutritionLogId: string
  initialRemaining?: Remaining | null
  onUpdated?: (remaining?: Remaining | null, action?: 'added' | 'removed') => void
}

type ServingOption = {
  id: string
  label: string
  unit: string
  grams: number
  is_default: boolean
}

type MealEntry = {
  id: string
  meal_name: string
  serving_amount: number
  serving_unit: string | null
  grams: number | null
  day_block: string | null
  created_at: string
  foods: {
    name: string
  } | null
}

function roundValue(value: number | null | undefined) {
  return Math.round(Number(value || 0))
}

export default function NutritionFoodLogger({
  nutritionLogId,
  initialRemaining = null,
  onUpdated,
}: Props) {
  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [servingAmount, setServingAmount] = useState('1')
  const [mealName, setMealName] = useState('Breakfast')
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const [remaining, setRemaining] = useState<Remaining | null>(initialRemaining)

  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deletingMealId, setDeletingMealId] = useState('')
  const [loadingServingOptions, setLoadingServingOptions] = useState(false)

  const [servingOptions, setServingOptions] = useState<ServingOption[]>([])
  const [selectedServingOptionId, setSelectedServingOptionId] = useState('')

  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([])

  const loadTodayMeals = useCallback(async () => {
    const res = await fetch(
      `/api/today-meals?nutritionLogId=${nutritionLogId}`
    )

    const data = await res.json()

    if (res.ok) {
      setTodayMeals(data.meals || [])
    }
  }, [nutritionLogId])

  useEffect(() => {
    void loadTodayMeals()
  }, [loadTodayMeals])

  useEffect(() => {
    setRemaining(initialRemaining)
  }, [initialRemaining])

  async function selectFood(food: Food) {
    setSelectedFood(food)
    setServingOptions([])
    setSelectedServingOptionId('')
    setMessage('')
    setLoadingServingOptions(true)

    const res = await fetch(
      `/api/nutrition/serving-options?foodId=${food.id}`
    )

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to load serving options.')
      setLoadingServingOptions(false)
      return
    }

    const options = data.servingOptions || []
    setServingOptions(options)

    const defaultOption =
      options.find((option: ServingOption) => option.is_default) || options[0]

    if (defaultOption) {
      setSelectedServingOptionId(defaultOption.id)
    }

    setLoadingServingOptions(false)
  }

  async function searchFoods() {
  try {
    setSearching(true)
    setMessage('')

    const res = await fetch(
      `/api/nutrition/search-foods?q=${encodeURIComponent(search)}`
    )

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Food search failed.')
      return
    }

    setFoods(data.foods || [])
  } catch (error) {
    console.error(error)
    setMessage('Food search failed.')
  } finally {
    setSearching(false)
  }
}

  async function addMeal() {
    if (!selectedFood) {
      setMessage('Select a food first.')
      return
    }

    setAdding(true)
    setMessage('')
    setSaved(false)

    const selectedServingOption = servingOptions.find(
      (option) => option.id === selectedServingOptionId
    )

    const res = await fetch('/api/nutrition/add-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nutritionLogId,
        foodId: selectedFood.id,
        mealName,
        servingAmount: Number(servingAmount),
        servingUnit: selectedServingOption?.label || 'serving',
        servingOptionId: selectedServingOptionId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to add meal.')
      setAdding(false)
      return
    }

    if (data.remaining) {
      setRemaining(data.remaining)
    }

    setMessage('Food logged — today’s progress and remaining macros are updated.')
    setSaved(true)
    setSearch('')
    setFoods([])
    setSelectedFood(null)
    setServingAmount('1')
    setServingOptions([])
    setSelectedServingOptionId('')
    setAdding(false)

    onUpdated?.(data.remaining || null, 'added')
    await loadTodayMeals()
  }

  async function deleteMeal(mealEntryId: string) {
    setDeletingMealId(mealEntryId)
    setMessage('')
    setSaved(false)

    const res = await fetch('/api/nutrition/delete-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealEntryId,
        nutritionLogId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to remove meal.')
      setDeletingMealId('')
      return
    }

    if (data.remaining) {
      setRemaining(data.remaining)
    }

    onUpdated?.(data.remaining || null, 'removed')
    await loadTodayMeals()

    setMessage('Food removed — today’s progress and remaining macros are updated.')
    setSaved(true)
    setDeletingMealId('')
  }

  return (
    <div>
      <div style={styles.fieldWrap}>
        <label style={styles.labelStyle}>Meal</label>

        <select
          style={styles.inputStyle}
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
        >
          <option value="Breakfast">Breakfast</option>
          <option value="Pre Workout">Pre Workout</option>
          <option value="Post Workout">Post Workout</option>
          <option value="Lunch">Lunch</option>
          <option value="Snack">Snack</option>
          <option value="Supper">Supper</option>
        </select>
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
  disabled={searching || !search.trim()}
>
  {searching ? 'Searching...' : 'Search Foods'}
</button>

      <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
        {foods.map((food) => (
          <button
            key={food.id}
            type="button"
            onClick={() => selectFood(food)}
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

      {loadingServingOptions && (
        <p style={{ ...styles.bodyStyle, marginTop: '12px' }}>
          Loading serving sizes...
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

      {servingOptions.length > 0 && (
        <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
          <label style={styles.labelStyle}>Serving Size</label>

          <select
            style={styles.inputStyle}
            value={selectedServingOptionId}
            onChange={(e) => setSelectedServingOptionId(e.target.value)}
          >
            {servingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        style={{ ...styles.primaryButtonStyle, marginTop: '18px' }}
        onClick={addMeal}
        disabled={adding || searching || !selectedFood}
      >
        {adding ? 'Adding...' : 'Add Meal'}
      </button>

      {message && (
        <p role="status" aria-live="polite" style={{ ...styles.bodyStyle, marginTop: '18px', padding: '14px 16px', borderRadius: 14, border: saved ? '1px solid rgba(224,122,66,.7)' : '1px solid rgba(255,255,255,.12)', background: saved ? 'linear-gradient(135deg,rgba(181,78,35,.25),rgba(224,122,66,.08))' : 'rgba(255,255,255,.03)' }}>
          {saved ? '✓ ' : ''}{message}
        </p>
      )}

      {todayMeals.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <h3 style={styles.sectionTitleStyle}>Today’s Logged Food</h3>

          <div style={{ display: 'grid', gap: '10px' }}>
            {todayMeals.map((meal) => (
              <div
                key={meal.id}
                style={{
                  ...styles.compactCardStyle,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '16px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h4 style={styles.compactCardTitleStyle}>
                    {meal.foods?.name || 'Food'}
                  </h4>

                  <p style={styles.compactCardTextStyle}>
                    {meal.meal_name} · {meal.serving_amount}{' '}
                    {meal.serving_unit || 'serving'}
                    {meal.grams ? ` · ${Math.round(meal.grams)}g` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => deleteMeal(meal.id)}
                  disabled={Boolean(deletingMealId)}
                  style={{
                    ...styles.secondaryButtonStyle,
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    width: 'auto',
                  }}
                >
                  {deletingMealId === meal.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        </div>
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
