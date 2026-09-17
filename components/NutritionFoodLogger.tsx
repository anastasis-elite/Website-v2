'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import { getMealPeriodForLocalDate, mealPeriods, type MealPeriod } from '@/lib/nutrition/mealPeriod'

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string; format?: string }>>
    }
  }
}

type Food = {
  id: string
  name: string
  brand_name?: string | null
  barcode?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fiber_g?: number | null
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
  zinc_remaining_g?: number | null
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
  capabilities: {
    nutritionBarcodeScanning: boolean
    nutritionRecurringFoodDetection: boolean
    nutritionAutomaticPreLogging: boolean
    nutritionPhotoMacroEstimation: boolean
  }
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
  meal_period: string | null
  serving_amount: number
  serving_unit: string | null
  grams: number | null
  day_block: string | null
  entry_source?: string | null
  entry_state?: string | null
  verified?: boolean | null
  estimated?: boolean | null
  confidence?: number | null
  created_at: string
  foods: {
    name: string
  } | null
}

type RecurringCandidate = {
  foodId: string
  foodName: string
  mealPeriod: string
  mealName: string
  servingAmount: number
  servingUnit: string | null
  servingOptionId: string | null
  frequency: number
  daysOfWeek: number[]
}

type RecurringPattern = {
  id: string
  food_id: string
  meal_period: string
  serving_amount: number
  serving_unit: string | null
  serving_option_id: string | null
  status: string
  foods?: { name?: string | null } | { name?: string | null }[] | null
}

function roundValue(value: number | null | undefined) {
  return Math.round(Number(value || 0))
}

function firstRelated<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default function NutritionFoodLogger({
  nutritionLogId,
  capabilities,
  initialRemaining = null,
  onUpdated,
}: Props) {
  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [servingAmount, setServingAmount] = useState('1')
  const [mealName, setMealName] = useState<MealPeriod>(() => getMealPeriodForLocalDate())
  const [entrySource, setEntrySource] = useState<'manual' | 'barcode' | 'recurring' | 'photo_estimate'>('manual')
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
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const [recurringCandidates, setRecurringCandidates] = useState<RecurringCandidate[]>([])
  const [recurringPatterns, setRecurringPatterns] = useState<RecurringPattern[]>([])
  const [dismissedRecurring, setDismissedRecurring] = useState<Set<string>>(new Set())
  const [customFood, setCustomFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    fiber: '',
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanningRef = useRef(false)

  const loadTodayMeals = useCallback(async () => {
    const res = await fetch(`/api/today-meals?nutritionLogId=${nutritionLogId}`)
    const data = await res.json()

    if (res.ok) {
      setTodayMeals(data.meals || [])
    }
  }, [nutritionLogId])

  const loadRecurringFoods = useCallback(async () => {
    if (!capabilities.nutritionRecurringFoodDetection) return
    const res = await fetch('/api/nutrition/recurring-foods')
    const data = await res.json().catch(() => null)
    if (res.ok) {
      setRecurringCandidates(data?.suggestions || [])
      setRecurringPatterns(data?.active || [])
    }
  }, [capabilities.nutritionRecurringFoodDetection])

  useEffect(() => {
    void loadTodayMeals()
    void loadRecurringFoods()
  }, [loadTodayMeals, loadRecurringFoods])

  useEffect(() => {
    setRemaining(initialRemaining)
  }, [initialRemaining])

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop())
    }
  }, [cameraStream])

  async function selectFood(food: Food, source: typeof entrySource = 'manual') {
    setSelectedFood(food)
    setEntrySource(source)
    setServingOptions([])
    setSelectedServingOptionId('')
    setMessage('')
    setLoadingServingOptions(true)

    const res = await fetch(`/api/nutrition/serving-options?foodId=${food.id}`)
    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to load serving options.')
      setLoadingServingOptions(false)
      return
    }

    const options = data.servingOptions || []
    setServingOptions(options)
    const defaultOption = options.find((option: ServingOption) => option.is_default) || options[0]
    if (defaultOption) setSelectedServingOptionId(defaultOption.id)
    setLoadingServingOptions(false)
  }

  async function searchFoods() {
    try {
      setSearching(true)
      setMessage('')

      const res = await fetch(`/api/nutrition/search-foods?q=${encodeURIComponent(search)}`)
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

  async function addMeal(source: typeof entrySource = entrySource, recurringFoodId?: string) {
    if (!selectedFood) {
      setMessage('Select a food first.')
      return
    }

    setAdding(true)
    setMessage('')
    setSaved(false)

    const selectedServingOption = servingOptions.find((option) => option.id === selectedServingOptionId)
    const res = await fetch('/api/nutrition/add-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nutritionLogId,
        foodId: selectedFood.id,
        mealName,
        mealPeriod: mealName,
        servingAmount: Number(servingAmount),
        servingUnit: selectedServingOption?.label || 'serving',
        servingOptionId: selectedServingOptionId,
        entrySource: source,
        entryState: 'confirmed',
        barcode: selectedFood.barcode || scannedBarcode || null,
        recurringFoodId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to add meal.')
      setAdding(false)
      return
    }

    if (data.remaining) setRemaining(data.remaining)

    setMessage(source === 'photo_estimate' ? 'Estimated food logged after review.' : 'Food logged. Today’s progress and remaining macros are updated.')
    setSaved(true)
    setSearch('')
    setFoods([])
    setSelectedFood(null)
    setServingAmount('1')
    setServingOptions([])
    setSelectedServingOptionId('')
    setScannedBarcode('')
    setEntrySource('manual')
    setAdding(false)

    onUpdated?.(data.remaining || null, 'added')
    await loadTodayMeals()
    await loadRecurringFoods()
  }

  async function deleteMeal(mealEntryId: string) {
    setDeletingMealId(mealEntryId)
    setMessage('')
    setSaved(false)

    const res = await fetch('/api/nutrition/delete-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealEntryId, nutritionLogId }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to remove meal.')
      setDeletingMealId('')
      return
    }

    if (data.remaining) setRemaining(data.remaining)
    onUpdated?.(data.remaining || null, 'removed')
    await loadTodayMeals()
    setMessage('Food removed. Today’s progress and remaining macros are updated.')
    setSaved(true)
    setDeletingMealId('')
  }

  async function requestCameraStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not available in this browser.')
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
    } catch {
      throw new Error('Camera access is needed to scan food barcodes or capture meal photos. Allow camera access in your browser or device settings, then try again.')
    }
  }

  async function startBarcodeScan() {
    if (!capabilities.nutritionBarcodeScanning) return

    setMessage('')
    setSaved(false)
    if (!window.BarcodeDetector) {
      setMessage('Barcode scanning is not supported by this browser yet. Search or add the food manually.')
      return
    }

    try {
      const stream = await requestCameraStream()
      setCameraStream(stream)
      setScannerOpen(true)
      scanningRef.current = true

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
          void scanFrame()
        }
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Camera permission could not be requested.')
    }
  }

  async function scanFrame() {
    if (!scanningRef.current || !videoRef.current || !window.BarcodeDetector) return

    try {
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      const results = await detector.detect(videoRef.current)
      const rawValue = results[0]?.rawValue
      if (rawValue) {
        await lookupBarcode(rawValue)
        stopBarcodeScan()
        return
      }
    } catch {
      setMessage('Barcode scan could not read this label. Try better light or search manually.')
    }

    requestAnimationFrame(() => void scanFrame())
  }

  function stopBarcodeScan() {
    scanningRef.current = false
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setScannerOpen(false)
  }

  async function lookupBarcode(barcode: string) {
    setScannedBarcode(barcode)
    const res = await fetch(`/api/nutrition/barcode?barcode=${encodeURIComponent(barcode)}`)
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setMessage(data?.error || 'Barcode lookup failed.')
      return
    }

    if (!data?.found) {
      setMessage(data?.message || 'No food matched this barcode. Add it as a custom food to save it.')
      return
    }

    await selectFood(data.food, 'barcode')
    setMealName(getMealPeriodForLocalDate())
    setMessage('Barcode found. Review the nutrition and serving size before adding it.')
  }

  async function createCustomFood() {
    if (!customFood.name.trim()) {
      setMessage('Food name is required.')
      return
    }

    setAdding(true)
    setMessage('')
    const res = await fetch('/api/nutrition/custom-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...customFood,
        barcode: scannedBarcode || null,
        source: scannedBarcode ? 'barcode_custom' : 'custom',
      }),
    })
    const data = await res.json().catch(() => null)
    setAdding(false)

    if (!res.ok) {
      setMessage(data?.error || 'Custom food could not be saved.')
      return
    }

    setCustomFood({ name: '', calories: '', protein: '', carbs: '', fats: '', fiber: '' })
    await selectFood(data.food, scannedBarcode ? 'barcode' : 'manual')
    setMessage('Custom food saved. Review serving size, then add it to today.')
  }

  async function handlePhotoSelected(file: File | null) {
    if (!file || !capabilities.nutritionPhotoMacroEstimation) return

    setPhotoBusy(true)
    setPhotoMessage('')
    try {
      await requestCameraStream().then((stream) => stream.getTracks().forEach((track) => track.stop()))
      const form = new FormData()
      form.append('photo', file)
      const res = await fetch('/api/nutrition/photo-estimate', { method: 'POST', body: form })
      const data = await res.json().catch(() => null)
      setPhotoMessage(data?.error || 'Photo estimate could not be prepared.')
    } catch (error) {
      setPhotoMessage(error instanceof Error ? error.message : 'Camera permission could not be requested.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function saveRecurring(candidate: RecurringCandidate, action: 'prelog' | 'suggest') {
    const res = await fetch('/api/nutrition/recurring-foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action === 'suggest' ? 'suggest' : 'prelog',
        foodId: candidate.foodId,
        mealPeriod: candidate.mealPeriod,
        mealName: candidate.mealName,
        servingAmount: candidate.servingAmount,
        servingUnit: candidate.servingUnit,
        servingOptionId: candidate.servingOptionId,
        daysOfWeek: candidate.daysOfWeek,
        detectionMetadata: { frequency: candidate.frequency },
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setMessage(data?.error || 'Recurring food preference could not be saved.')
      return
    }
    setMessage(action === 'prelog' ? 'Recurring food saved. It will appear as a pre-logged option on matching days.' : 'Recurring food saved as a suggestion.')
    setDismissedRecurring((current) => new Set(current).add(candidate.foodId + candidate.mealPeriod))
    await loadRecurringFoods()
  }

  async function stopRecurring(patternId: string) {
    const res = await fetch('/api/nutrition/recurring-foods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', id: patternId }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setMessage(data?.error || 'Recurring food could not be stopped.')
      return
    }
    setMessage('Future pre-logging stopped for that food.')
    await loadRecurringFoods()
  }

  async function logRecurring(pattern: RecurringPattern) {
    const food = firstRelated(pattern.foods)
    setMealName((pattern.meal_period || 'Other') as MealPeriod)
    setServingAmount(String(pattern.serving_amount || 1))
    setSelectedServingOptionId(pattern.serving_option_id || '')
    await selectFood({ id: pattern.food_id, name: food?.name || 'Recurring food' }, 'recurring')
  }

  const visibleRecurring = recurringCandidates.filter((candidate) => !dismissedRecurring.has(candidate.foodId + candidate.mealPeriod))

  return (
    <div>
      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginBottom: 18 }}>
        <button type="button" style={styles.primaryButtonStyle} onClick={() => document.getElementById('nutrition-food-search')?.focus()}>
          Add Food
        </button>
        <button type="button" style={styles.secondaryButtonStyle} onClick={startBarcodeScan}>
          Scan Barcode
        </button>
        {capabilities.nutritionPhotoMacroEstimation ? (
          <label style={{ ...styles.secondaryButtonStyle, textAlign: 'center', cursor: photoBusy ? 'default' : 'pointer' }}>
            {photoBusy ? 'Analyzing...' : 'Take Photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(event) => void handlePhotoSelected(event.target.files?.[0] || null)}
            />
          </label>
        ) : (
          <button type="button" style={{ ...styles.secondaryButtonStyle, opacity: 0.55 }} disabled>
            Take Photo - PHOENIX
          </button>
        )}
      </div>

      {scannerOpen ? (
        <div style={{ ...styles.compactCardStyle, marginBottom: 18 }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000' }} />
          <p style={{ ...styles.compactCardTextStyle, marginTop: 10 }}>
            Camera access is used only to scan the food barcode.
          </p>
          <button type="button" style={{ ...styles.secondaryButtonStyle, marginTop: 10 }} onClick={stopBarcodeScan}>
            Stop Scanner
          </button>
        </div>
      ) : null}

      {photoMessage ? (
        <p role="status" style={{ ...styles.bodyStyle, marginBottom: 18 }}>
          Estimated from your photo - actual nutrition may vary. {photoMessage}
        </p>
      ) : null}

      {capabilities.nutritionRecurringFoodDetection ? (
        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          {visibleRecurring.map((candidate) => (
            <div key={`${candidate.foodId}-${candidate.mealPeriod}`} style={styles.compactCardStyle}>
              <h4 style={styles.compactCardTitleStyle}>{candidate.foodName}</h4>
              <p style={styles.compactCardTextStyle}>
                You have logged this for {candidate.mealPeriod.toLowerCase()} several times. Is this something you usually have?
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button type="button" style={{ ...styles.primaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => void saveRecurring(candidate, 'prelog')}>
                  Yes, pre-log it
                </button>
                <button type="button" style={{ ...styles.secondaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => void saveRecurring(candidate, 'suggest')}>
                  Suggest it instead
                </button>
                <button type="button" style={{ ...styles.secondaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => setDismissedRecurring((current) => new Set(current).add(candidate.foodId + candidate.mealPeriod))}>
                  Not usually
                </button>
              </div>
            </div>
          ))}

          {recurringPatterns.filter((pattern) => pattern.status === 'active').map((pattern) => {
            const food = firstRelated(pattern.foods)
            return (
              <div key={pattern.id} style={styles.compactCardStyle}>
                <h4 style={styles.compactCardTitleStyle}>{food?.name || 'Recurring food'}</h4>
                <p style={styles.compactCardTextStyle}>
                  Pre-logged option for {String(pattern.meal_period || 'meal').toLowerCase()}. Confirm before it counts toward today.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" style={{ ...styles.primaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => void logRecurring(pattern)}>
                    Review / Confirm
                  </button>
                  <button type="button" style={{ ...styles.secondaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => void stopRecurring(pattern.id)}>
                    Stop Future
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ ...styles.compactCardTextStyle, marginBottom: 18, opacity: 0.75 }}>
          Recurring food detection unlocks with IGNITE and PHOENIX.
        </p>
      )}

      <div style={styles.fieldWrap}>
        <label style={styles.labelStyle}>Meal</label>
        <select style={styles.inputStyle} value={mealName} onChange={(e) => setMealName(e.target.value as MealPeriod)}>
          {mealPeriods.map((period) => (
            <option key={period} value={period}>
              {period}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label style={styles.labelStyle}>Search Food</label>
        <input id="nutrition-food-search" style={styles.inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="egg, rice, yogurt..." />
      </div>

      <button type="button" style={{ ...styles.primaryButtonStyle, marginTop: '18px' }} onClick={searchFoods} disabled={searching || !search.trim()}>
        {searching ? 'Searching...' : 'Search Foods'}
      </button>

      <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
        {foods.map((food) => (
          <button key={food.id} type="button" onClick={() => void selectFood(food)} style={{ ...styles.secondaryButtonStyle, textAlign: 'left', opacity: selectedFood?.id === food.id ? 1 : 0.7 }}>
            {food.name}{food.brand_name ? ` - ${food.brand_name}` : ''}
          </button>
        ))}
      </div>

      {selectedFood && (
        <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>
          Selected: <strong>{selectedFood.name}</strong>
          {entrySource === 'barcode' ? ' - barcode source' : null}
          {entrySource === 'recurring' ? ' - recurring source' : null}
        </p>
      )}

      <div style={{ ...styles.compactCardStyle, marginTop: 20 }}>
        <h3 style={styles.sectionTitleStyle}>Create Custom Food</h3>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
          <input style={styles.inputStyle} value={customFood.name} onChange={(event) => setCustomFood((current) => ({ ...current, name: event.target.value }))} placeholder="Food name" />
          {(['calories', 'protein', 'carbs', 'fats', 'fiber'] as const).map((key) => (
            <input key={key} style={styles.inputStyle} type="number" min="0" step="1" value={customFood[key]} onChange={(event) => setCustomFood((current) => ({ ...current, [key]: event.target.value }))} placeholder={key === 'fats' ? 'fat g' : key} />
          ))}
        </div>
        <button type="button" style={{ ...styles.secondaryButtonStyle, marginTop: 12 }} onClick={createCustomFood} disabled={adding}>
          Save Custom Food
        </button>
      </div>

      {loadingServingOptions ? <p style={{ ...styles.bodyStyle, marginTop: '12px' }}>Loading serving sizes...</p> : null}

      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label style={styles.labelStyle}>Serving Amount</label>
        <input style={styles.inputStyle} type="number" min="0" step="0.25" value={servingAmount} onChange={(e) => setServingAmount(e.target.value)} />
      </div>

      {servingOptions.length > 0 && (
        <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
          <label style={styles.labelStyle}>Serving Size</label>
          <select style={styles.inputStyle} value={selectedServingOptionId} onChange={(e) => setSelectedServingOptionId(e.target.value)}>
            {servingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button type="button" style={{ ...styles.primaryButtonStyle, marginTop: '18px' }} onClick={() => void addMeal()} disabled={adding || searching || !selectedFood}>
        {adding ? 'Adding...' : 'Add Meal'}
      </button>

      <p style={{ ...styles.compactCardTextStyle, marginTop: 12 }}>
        Photo-based nutrition estimates are approximations. Portion size, ingredients, preparation methods, sauces, oils, brands, and other factors can significantly change calorie and macronutrient values. For the most accurate nutrition tracking, measure or weigh your food and verify nutrition information when available.
      </p>

      {message && (
        <p role="status" aria-live="polite" style={{ ...styles.bodyStyle, marginTop: '18px', padding: '14px 16px', borderRadius: 14, border: saved ? '1px solid rgba(224,122,66,.7)' : '1px solid rgba(255,255,255,.12)', background: saved ? 'linear-gradient(135deg,rgba(181,78,35,.25),rgba(224,122,66,.08))' : 'rgba(255,255,255,.03)' }}>
          {saved ? 'Saved. ' : ''}{message}
        </p>
      )}

      {todayMeals.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <h3 style={styles.sectionTitleStyle}>Today’s Logged Food</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {todayMeals.map((meal) => (
              <div key={meal.id} style={{ ...styles.compactCardStyle, display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={styles.compactCardTitleStyle}>{meal.foods?.name || 'Food'}</h4>
                  <p style={styles.compactCardTextStyle}>
                    {meal.meal_period || meal.meal_name} - {meal.serving_amount} {meal.serving_unit || 'serving'}
                    {meal.grams ? ` - ${Math.round(meal.grams)}g` : ''}
                  </p>
                  <p style={styles.compactCardTextStyle}>
                    {meal.entry_source === 'photo_estimate' ? 'Estimated from your photo - actual nutrition may vary.' : meal.entry_source === 'barcode' ? 'Barcode verified entry.' : meal.entry_source === 'recurring' ? 'Recurring entry confirmed today.' : 'Manual entry.'}
                  </p>
                </div>
                <button type="button" onClick={() => deleteMeal(meal.id)} disabled={Boolean(deletingMealId)} style={{ ...styles.secondaryButtonStyle, padding: '8px 14px', fontSize: '0.82rem', width: 'auto' }}>
                  {deletingMealId === meal.id ? 'Removing...' : 'Remove'}
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
            <div style={styles.compactCardStyle}><h4 style={styles.compactCardTitleStyle}>Calories</h4><p style={styles.compactCardTextStyle}>{roundValue(remaining.calories_remaining)}</p></div>
            <div style={styles.compactCardStyle}><h4 style={styles.compactCardTitleStyle}>Protein</h4><p style={styles.compactCardTextStyle}>{roundValue(remaining.protein_remaining_g)}g</p></div>
            <div style={styles.compactCardStyle}><h4 style={styles.compactCardTitleStyle}>Carbs</h4><p style={styles.compactCardTextStyle}>{roundValue(remaining.carbs_remaining_g)}g</p></div>
            <div style={styles.compactCardStyle}><h4 style={styles.compactCardTitleStyle}>Fats</h4><p style={styles.compactCardTextStyle}>{roundValue(remaining.fat_remaining_g)}g</p></div>
          </div>
        </div>
      )}
    </div>
  )
}
