'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
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
  brand?: string | null
  brandName?: string | null
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
  timezone?: string
  initialMealPeriod?: MealPeriod
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

type InputMethod = 'manual' | 'barcode' | 'image'

type ServingOption = {
  id: string
  label: string
  unit: string
  grams: number
  is_default: boolean
}

type MealEntry = {
  id: string
  food_id?: string
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
  foods: Food | null
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

export default function NutritionFoodLogger(props: Props) {
  const mealId = useId()
  const [mealName, setMealName] = useState<MealPeriod>(() => props.initialMealPeriod || getMealPeriodForLocalDate(new Date(), props.timezone))
  const [method, setMethod] = useState<InputMethod>('manual')
  const [visitedMethods, setVisitedMethods] = useState<InputMethod[]>(['manual'])
  const [photoAvailable, setPhotoAvailable] = useState<boolean | null>(null)
  const [photoAvailabilityMessage, setPhotoAvailabilityMessage] = useState('')
  const methods: InputMethod[] = ['manual', ...(props.capabilities.nutritionBarcodeScanning ? ['barcode' as const] : []), ...(props.capabilities.nutritionPhotoMacroEstimation ? ['image' as const] : [])]
  const enabledMethods = methods.filter(inputMethod => inputMethod !== 'image' || photoAvailable === true)
  const descriptions = { manual: 'Find or enter what I ate', barcode: 'Scan packaged food', image: 'Take or upload a picture' }
  function changeMethod(next: InputMethod) {
    if (!enabledMethods.includes(next)) return
    setVisitedMethods(current => current.includes(next) ? current : [...current, next])
    setMethod(next)
  }
  useEffect(() => {
    if (!props.capabilities.nutritionPhotoMacroEstimation) return
    let cancelled = false
    setPhotoAvailable(null)
    void fetch('/api/nutrition/photo-estimate', { cache: 'no-store' })
      .then(async response => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (cancelled) return
        const available = ok && data.available === true
        setPhotoAvailable(available)
        setPhotoAvailabilityMessage(available ? '' : data.message || 'Photo estimation is unavailable. Search / manual and barcode entry are still available.')
      })
      .catch(() => {
        if (cancelled) return
        setPhotoAvailable(false)
        setPhotoAvailabilityMessage('Photo estimation is unavailable. Search / manual and barcode entry are still available.')
      })
    return () => { cancelled = true }
  }, [props.capabilities.nutritionPhotoMacroEstimation])
  useEffect(() => {
    if (props.initialMealPeriod) setMealName(props.initialMealPeriod)
  }, [props.initialMealPeriod])
  return <div className="focused-meal-entry">
    <div className="nutrition-entry-fields" style={styles.fieldWrap}>
      <label style={styles.labelStyle} htmlFor={`${mealId}-meal`}>Meal</label>
      <select id={`${mealId}-meal`} style={styles.inputStyle} value={mealName} onChange={event => setMealName(event.target.value as MealPeriod)}>
        {mealPeriods.map(period => <option key={period} value={period}>{period}</option>)}
      </select>
    </div>
    <div className="tier-tab-list" role="tablist" aria-label="Meal logging method">
      {methods.map(inputMethod => <button key={inputMethod} id={`meal-method-${inputMethod}`} role="tab" type="button" disabled={!enabledMethods.includes(inputMethod)} aria-describedby={inputMethod === 'image' && photoAvailable !== true ? `${mealId}-photo-status` : undefined} tabIndex={method === inputMethod ? 0 : -1} aria-selected={method === inputMethod} aria-controls={`meal-entry-panel-${inputMethod}`} className={method === inputMethod ? 'is-active' : ''} onClick={() => changeMethod(inputMethod)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const index = enabledMethods.indexOf(inputMethod)
        const next = event.key === 'Home' ? enabledMethods[0] : event.key === 'End' ? enabledMethods.at(-1)! : enabledMethods[(index + (event.key === 'ArrowRight' ? 1 : enabledMethods.length - 1)) % enabledMethods.length]
        changeMethod(next)
        document.getElementById(`meal-method-${next}`)?.focus()
      }}>{inputMethod === 'manual' ? 'Search / manual' : inputMethod === 'barcode' ? 'Barcode' : photoAvailable === true ? 'Photo' : 'Photo unavailable'}</button>)}
    </div>
    {props.capabilities.nutritionPhotoMacroEstimation && photoAvailable !== true ? <p id={`${mealId}-photo-status`} role="status" style={{ ...styles.bodyStyle, marginTop: 12 }}>{photoAvailabilityMessage || 'Photo estimation is unavailable. Search / manual and barcode entry are still available.'}</p> : null}
    {methods.map(inputMethod => <div key={inputMethod} id={`meal-entry-panel-${inputMethod}`} role="tabpanel" aria-labelledby={`meal-method-${inputMethod}`} hidden={method !== inputMethod}>
      <p style={{ ...styles.bodyStyle, marginTop: 12 }}>{descriptions[inputMethod]}</p>
      {visitedMethods.includes(inputMethod) ? <FoodInputLogger {...props} mealName={mealName} onMealChange={setMealName} method={inputMethod} active={method === inputMethod} onMethodChange={changeMethod} photoAvailable={photoAvailable}/> : null}
    </div>)}
  </div>
}

function FoodInputLogger({
  nutritionLogId,
  capabilities,
  initialRemaining = null,
  onUpdated,
  method,
  onMethodChange,
  active,
  mealName,
  onMealChange,
  photoAvailable,
}: Props & { method: InputMethod; active: boolean; onMethodChange: (method: InputMethod) => void; mealName: MealPeriod; onMealChange: (meal: MealPeriod) => void; photoAvailable: boolean | null }) {
  const router = useRouter()
  const inputId = useId()
  const submitLock = useRef(false)
  const requestId = useRef<string | null>(null)
  const lastSubmission = useRef('')
  const [showCustom, setShowCustom] = useState(false)
  const [search, setSearch] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [servingAmount, setServingAmount] = useState('1')
  const [entrySource, setEntrySource] = useState<'manual' | 'barcode' | 'recurring' | 'photo_estimate'>(method === 'image' ? 'photo_estimate' : method)
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
  const [barcodeBusy, setBarcodeBusy] = useState(false)
  const [barcodeMessage, setBarcodeMessage] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const [recurringCandidates, setRecurringCandidates] = useState<RecurringCandidate[]>([])
  const [recurringPatterns, setRecurringPatterns] = useState<RecurringPattern[]>([])
  const [dismissedRecurring, setDismissedRecurring] = useState<Set<string>>(new Set())
  const [customFood, setCustomFood] = useState({
    name: '',
    brand: '',
    servingSize: '1',
    servingUnit: 'serving',
    servingGrams: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    fiber: '',
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanningRef = useRef(false)
  const todayMealsRequest = useRef(0)

  const loadTodayMeals = useCallback(async () => {
    const attempt = ++todayMealsRequest.current
    try {
    const res = await fetch(`/api/today-meals?nutritionLogId=${nutritionLogId}`)
    const data = await res.json()

    if (res.ok && attempt === todayMealsRequest.current) {
      setTodayMeals(data.meals || [])
    }
    } catch {
      if (attempt === todayMealsRequest.current) setMessage("Today's logged food could not be loaded. Please try again.")
    }
  }, [nutritionLogId])

  const loadRecurringFoods = useCallback(async () => {
    if (!capabilities.nutritionRecurringFoodDetection) return
    try {
    const res = await fetch('/api/nutrition/recurring-foods')
    const data = await res.json().catch(() => null)
    if (res.ok) {
      setRecurringCandidates(data?.suggestions || [])
      setRecurringPatterns(data?.active || [])
    }
    } catch {
      // Recurring suggestions must not prevent adding or refreshing a meal.
    }
  }, [capabilities.nutritionRecurringFoodDetection])

  useEffect(() => {
    if (!active) return
    void loadTodayMeals()
    if (method === 'manual') void loadRecurringFoods()
    // Revalidate recorded food after a PWA resume without replacing the search,
    // selected food, serving amount or inactive method drafts.
    const resume = () => {
      if (document.visibilityState === 'visible') void loadTodayMeals()
    }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [loadTodayMeals, loadRecurringFoods, active, method])

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
    setFoods([])
    setEntrySource(source)
    setServingOptions([])
    setSelectedServingOptionId('')
    setMessage('')
    setLoadingServingOptions(true)
    try {
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
    } catch {
      setMessage('Unable to load serving options. Please try again.')
    } finally {
    setLoadingServingOptions(false)
    }
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
    if (submitLock.current) return
    if (!selectedFood) {
      setMessage('Select a food first.')
      return
    }

    submitLock.current = true
    const fingerprint = JSON.stringify([nutritionLogId, selectedFood.id, mealName, servingAmount, selectedServingOptionId, source, recurringFoodId])
    if (lastSubmission.current !== fingerprint) requestId.current = null
    lastSubmission.current = fingerprint
    requestId.current ||= crypto.randomUUID()
    setAdding(true)
    setMessage('')
    setSaved(false)
    try {
    const selectedServingOption = servingOptions.find((option) => option.id === selectedServingOptionId)
    const res = await fetch('/api/nutrition/add-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nutritionLogId,
        requestId: requestId.current,
        foodId: selectedFood.id,
        mealName,
        mealPeriod: mealName,
        servingAmount: Number(servingAmount),
        servingUnit: selectedServingOption?.label || 'serving',
        servingOptionId: selectedServingOptionId,
        entrySource: source,
        entryState: 'confirmed',
        recurringFoodId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Unable to add this food. Please try again.')
      setAdding(false)
      return
    }

    if (data.remaining) setRemaining(data.remaining)

    setMessage(
      data.refreshStatus === 'degraded'
        ? 'Food logged. Today’s remaining totals are refreshing.'
        : source === 'photo_estimate'
          ? 'Estimated food logged after review.'
          : 'Food logged. Today’s progress and remaining macros are updated.'
    )
    setSaved(true)
    requestId.current = null
    if (!onUpdated) router.refresh()
    setSearch('')
    setFoods([])
    setSelectedFood(null)
    setServingAmount('1')
    setServingOptions([])
    setSelectedServingOptionId('')
    setScannedBarcode('')
    setEntrySource(method === 'image' ? 'photo_estimate' : method)
    setAdding(false)

    onUpdated?.(data.remaining || null, 'added')
    await Promise.all([loadTodayMeals(), loadRecurringFoods()])
    } catch {
      setMessage('Unable to add this food. Please try again.')
    } finally {
      submitLock.current = false
      setAdding(false)
    }
  }

  async function deleteMeal(mealEntryId: string) {
    setDeletingMealId(mealEntryId)
    setMessage('')
    setSaved(false)
    try {
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
    } catch {
      setMessage('Food could not be removed. Please try again.')
    } finally {
      setDeletingMealId('')
    }
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
      throw new Error('Camera access was not granted. Enter the barcode below or return to Search / manual.')
    }
  }

  async function startBarcodeScan() {
    if (!capabilities.nutritionBarcodeScanning) return

    setBarcodeMessage('')
    setSaved(false)
    if (!window.BarcodeDetector) {
      setBarcodeMessage('Camera scanning is unavailable in this browser. Enter the barcode below or use Manual.')
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
      setBarcodeMessage(error instanceof Error ? error.message : 'Camera permission could not be requested.')
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
      setBarcodeMessage('Barcode scan could not read this label. Try better light or use Manual.')
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
    setBarcodeBusy(true)
    setBarcodeMessage('')
    setScannedBarcode(barcode)
    try {
    const res = await fetch(`/api/nutrition/barcode?barcode=${encodeURIComponent(barcode)}`)
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setBarcodeMessage(data?.error || "We couldn't find that barcode. Try searching for the food manually.")
      return
    }

    if (!data?.found) {
      setBarcodeMessage(data?.message || "We couldn't find that barcode. Try searching for the food manually.")
      return
    }

    await selectFood(data.food, 'barcode')
    setBarcodeMessage('Barcode found. Review the nutrition and serving size before adding it.')
    } catch {
      setBarcodeMessage("We couldn't find that barcode. Try searching for the food manually.")
    } finally {
      setBarcodeBusy(false)
    }
  }

  async function createCustomFood() {
    if (!customFood.name.trim()) {
      setMessage('Food name is required.')
      return
    }

    setAdding(true)
    setMessage('')
    try {
    const res = await fetch('/api/nutrition/custom-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...customFood,
        fiber: customFood.fiber.trim() ? customFood.fiber : undefined,
        ...(method === 'barcode' && scannedBarcode ? { barcode: scannedBarcode } : {}),
      }),
    })
    const data = await res.json().catch(() => null)
    setAdding(false)

    if (!res.ok) {
      setMessage(data?.error || 'Custom food could not be saved.')
      return
    }

    if (!data?.food) {
      setMessage('Custom food saved. Search for it if it does not appear right away.')
      return
    }

    setCustomFood({ name: '', brand: '', servingSize: '1', servingUnit: 'serving', servingGrams: '', calories: '', protein: '', carbs: '', fats: '', fiber: '' })
    setShowCustom(false)
    await selectFood(data.food, method === 'barcode' ? 'barcode' : 'manual')
    setMessage('Custom food saved. Review serving size, then add it to today.')
    } catch {
      setMessage('Custom food could not be saved. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  async function handlePhotoSelected(file: File | null) {
    if (!file || !capabilities.nutritionPhotoMacroEstimation || photoAvailable !== true) return

    setPhotoBusy(true)
    setPhotoMessage('')
    try {
      const form = new FormData()
      form.append('photo', file)
      const res = await fetch('/api/nutrition/photo-estimate', { method: 'POST', body: form })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.food?.id) { await selectFood(data.food, 'photo_estimate'); setPhotoMessage('Review the estimated food and serving amount, then confirm to log it.') }
      else setPhotoMessage(data?.error || "We couldn't analyze this image. You can add the food manually instead.")
    } catch {
      setPhotoMessage("We couldn't analyze this image. You can add the food manually instead.")
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
    setMessage(action === 'prelog' ? 'Recurring option saved. Review and confirm it before it counts toward today.' : 'Recurring food saved as a suggestion.')
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
    setMessage('Recurring option stopped for that food.')
    await loadRecurringFoods()
  }

  async function logRecurring(pattern: RecurringPattern) {
    const food = firstRelated(pattern.foods)
    onMealChange((pattern.meal_period || 'Other') as MealPeriod)
    setServingAmount(String(pattern.serving_amount || 1))
    await selectFood({ id: pattern.food_id, name: food?.name || 'Recurring food' }, 'recurring')
    setSelectedServingOptionId(pattern.serving_option_id || '')
  }

  useEffect(() => {
    if (!active) {
      scanningRef.current = false
      cameraStream?.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
      setScannerOpen(false)
    }
  }, [active, cameraStream])

  const visibleRecurring = recurringCandidates.filter((candidate) => !dismissedRecurring.has(candidate.foodId + candidate.mealPeriod))

  return (
    <div>
      {method === 'barcode' ? <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
        <button type="button" style={styles.secondaryButtonStyle} onClick={startBarcodeScan}>
          Scan Barcode
        </button>
        <label style={styles.labelStyle} htmlFor="nutrition-barcode">Or enter a barcode</label>
        <input id="nutrition-barcode" style={styles.inputStyle} inputMode="numeric" value={scannedBarcode} onChange={(event) => setScannedBarcode(event.target.value)} />
        <button type="button" style={styles.primaryButtonStyle} disabled={barcodeBusy || !scannedBarcode.trim()} onClick={() => void lookupBarcode(scannedBarcode.trim())}>{barcodeBusy ? 'Looking up...' : 'Find Product'}</button>
        {barcodeMessage ? <p role="status" style={styles.bodyStyle}>{barcodeMessage}</p> : null}<button type="button" onClick={() => onMethodChange('manual')}>Return to Search / manual</button>
      </div> : null}
      {method === 'image' ? (
        <div>
          <label style={{ ...styles.secondaryButtonStyle, textAlign: 'center', cursor: photoBusy || photoAvailable !== true ? 'default' : 'pointer' }}>
            {photoBusy ? 'Analyzing…' : photoAvailable === null ? 'Checking photo availability…' : photoAvailable ? 'Take or upload a photo' : 'Photo estimation unavailable'}
            <input
              type="file"
              accept="image/*"
              disabled={photoBusy || photoAvailable !== true}
              style={{ display: 'none' }}
              onChange={(event) => void handlePhotoSelected(event.target.files?.[0] || null)}
            />
          </label>
          <p style={{ ...styles.compactCardTextStyle, marginTop: 12 }}>Image estimates require your review before logging. Portion size and ingredients can change the nutrition values.</p>
        </div>
      ) : null}

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
          {photoMessage}<button type="button" onClick={() => onMethodChange('manual')}>Search / manual</button>
        </p>
      ) : null}


      <>
      {method === 'manual' ? <>
      {todayMeals.some(meal => meal.foods?.id) ? <div style={{ marginTop: 14 }}>
        <p style={styles.labelStyle}>Recently logged today</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {todayMeals.filter((meal, index, all) => meal.foods?.id && all.findIndex(item => item.foods?.id === meal.foods?.id) === index).slice(0, 5).map(meal => <button key={meal.foods!.id} type="button" style={{ ...styles.secondaryButtonStyle, width: 'auto' }} onClick={() => void selectFood(meal.foods!)}>{meal.foods!.name}</button>)}
        </div>
      </div> : null}
      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label htmlFor={`${inputId}-food-search`} style={styles.labelStyle}>Search food</label>
        <input id={`${inputId}-food-search`} style={styles.inputStyle} type="search" enterKeyHint="search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !searching && search.trim()) { event.preventDefault(); void searchFoods() } }} placeholder="egg, rice, yogurt..." />
      </div>

      <button type="button" style={{ ...styles.primaryButtonStyle, marginTop: '18px' }} onClick={searchFoods} disabled={searching || !search.trim()}>
        {searching ? 'Searching...' : 'Search Foods'}
      </button>

      <div className="nutrition-food-results" style={{ display: 'grid', gap: '10px', marginTop: '12px', maxHeight: 256, overflowY: 'auto' }}>
        {foods.map((food) => (
          <button key={food.id} type="button" onClick={() => void selectFood(food)} style={{ ...styles.secondaryButtonStyle, textAlign: 'left', opacity: selectedFood?.id === food.id ? 1 : 0.7 }}>
            {food.name}{food.brand ? ` - ${food.brand}` : ''}
          </button>
        ))}
      </div>
      </> : null}

      {selectedFood && (
        <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>
          Selected: <strong>{selectedFood.name}</strong>
          {entrySource === 'barcode' ? ' - barcode source' : null}
          {entrySource === 'recurring' ? ' - recurring source' : null}
        </p>
      )}

      {method !== 'image' ? <button type="button" className="tier-secondary-action" onClick={() => setShowCustom(!showCustom)}>{showCustom ? 'Close custom food' : method === 'barcode' ? 'Create a custom packaged food' : 'Can’t find it? Create a custom food'}</button> : null}
      {showCustom && method !== 'image' ? <div style={{ ...styles.compactCardStyle, marginTop: 20 }}>
        <h3 style={styles.sectionTitleStyle}>Create Custom Food</h3>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
          <input style={styles.inputStyle} value={customFood.name} onChange={(event) => setCustomFood((current) => ({ ...current, name: event.target.value }))} aria-label="Custom food name" placeholder="Food name" />
          <input style={styles.inputStyle} value={customFood.brand} onChange={(event) => setCustomFood((current) => ({ ...current, brand: event.target.value }))} aria-label="Brand (optional)" placeholder="Brand optional" />
          <input style={styles.inputStyle} type="number" min="0.01" step="0.25" value={customFood.servingSize} onChange={(event) => setCustomFood((current) => ({ ...current, servingSize: event.target.value }))} aria-label="Custom serving size" placeholder="Serving size" />
          <input style={styles.inputStyle} value={customFood.servingUnit} onChange={(event) => setCustomFood((current) => ({ ...current, servingUnit: event.target.value }))} aria-label="Custom serving unit" placeholder="Serving unit" />
          <input style={styles.inputStyle} type="number" min="0.01" step="0.1" value={customFood.servingGrams} onChange={(event) => setCustomFood((current) => ({ ...current, servingGrams: event.target.value }))} aria-label="Serving weight (grams)" placeholder="Serving weight g" />
          {(['calories', 'protein', 'carbs', 'fats', 'fiber'] as const).map((key) => (
            <input key={key} style={styles.inputStyle} type="number" min="0" step="1" value={customFood[key]} onChange={(event) => setCustomFood((current) => ({ ...current, [key]: event.target.value }))} aria-label={key} placeholder={key === 'fats' ? 'fat g' : key} />
          ))}
        </div>
        <button type="button" style={{ ...styles.secondaryButtonStyle, marginTop: 12 }} onClick={createCustomFood} disabled={adding}>
          Save Custom Food
        </button>
      </div> : null}

      {selectedFood ? <>
      {loadingServingOptions ? <p style={{ ...styles.bodyStyle, marginTop: '12px' }}>Loading serving sizes...</p> : null}

      <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
        <label htmlFor={`${inputId}-serving-amount`} style={styles.labelStyle}>Serving amount</label>
        <input style={styles.inputStyle} id={`${inputId}-serving-amount`} type="number" inputMode="decimal" min="0.01" step="0.25" value={servingAmount} onChange={(e) => setServingAmount(e.target.value)} />
      </div>

      {servingOptions.length > 0 && (
        <div style={{ ...styles.fieldWrap, marginTop: '18px' }}>
          <label htmlFor={`${inputId}-serving-size`} style={styles.labelStyle}>Serving unit</label>
          <select id={`${inputId}-serving-size`} style={styles.inputStyle} value={selectedServingOptionId} onChange={(e) => setSelectedServingOptionId(e.target.value)}>
            {servingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {!loadingServingOptions && servingOptions.length === 0 ? <p style={styles.bodyStyle}>Amount is in standard servings for this food. Create a custom food if you need a different serving size.</p> : null}

      <button type="button" style={{ ...styles.primaryButtonStyle, marginTop: '18px' }} onClick={() => void addMeal()} disabled={adding || searching || loadingServingOptions || !selectedFood || !Number.isFinite(Number(servingAmount)) || Number(servingAmount) <= 0}>
        {adding ? 'Saving…' : 'Confirm meal and save'}
      </button>
      </> : null}
      </>

      {message && (
        <p role="status" aria-live="polite" style={{ ...styles.bodyStyle, marginTop: '18px', padding: '14px 16px', borderRadius: 14, border: saved ? '1px solid rgba(224,122,66,.7)' : '1px solid rgba(255,255,255,.12)', background: saved ? 'linear-gradient(135deg,rgba(181,78,35,.25),rgba(224,122,66,.08))' : 'rgba(255,255,255,.03)' }}>
          {saved ? 'Saved. ' : ''}{message}
        </p>
      )}

      {method === 'manual' && capabilities.nutritionRecurringFoodDetection && (visibleRecurring.length > 0 || recurringPatterns.some(pattern => pattern.status === 'active')) ? (
        <details className="nutrition-entry-secondary">
          <summary>Recurring foods</summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 12, marginBottom: 20 }}>
          {visibleRecurring.map((candidate) => (
            <div key={`${candidate.foodId}-${candidate.mealPeriod}`} style={styles.compactCardStyle}>
              <h4 style={styles.compactCardTitleStyle}>{candidate.foodName}</h4>
              <p style={styles.compactCardTextStyle}>
                You have logged this for {candidate.mealPeriod.toLowerCase()} several times. Is this something you usually have?
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button type="button" style={{ ...styles.primaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => void saveRecurring(candidate, 'prelog')}>
                  Save as a recurring option
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
                  Recurring option for {String(pattern.meal_period || 'meal').toLowerCase()}. Review and confirm before it counts toward today.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button type="button" style={{ ...styles.primaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => void logRecurring(pattern)}>
                    Review / Confirm
                  </button>
                  <button type="button" style={{ ...styles.secondaryButtonStyle, width: 'auto', padding: '8px 12px' }} onClick={() => void stopRecurring(pattern.id)}>
                    Stop recurring option
                  </button>
                </div>
              </div>
            )
          })}
          </div>
        </details>
      ) : null}

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
                    {meal.entry_source === 'photo_estimate' ? 'Estimated from your photo - actual nutrition may vary.' : meal.entry_source === 'barcode' ? 'Added using a barcode.' : meal.entry_source === 'recurring' ? 'Recurring entry confirmed today.' : 'Manual entry.'}
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
