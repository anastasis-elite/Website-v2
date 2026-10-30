'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import HydrationQuickAdd from '@/components/hydration/HydrationQuickAdd'
import NutritionFoodLogger from '@/components/NutritionFoodLogger'
import { getTierCapabilities, type ProgramTier } from '@/lib/entitlements'
import { createClient } from '@/lib/supabase/client'
import { prepareDirectFoodEntry, readDirectEntryLog, readDirectWaterEntry, type DirectEntryLog, type DirectWaterEntry } from '@/lib/nutrition/directEntry'
import type { NutritionLoggingIntent } from '@/lib/nutrition/loggingIntent'
import type { MealPeriod } from '@/lib/nutrition/mealPeriod'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'

export type DirectRecipeContext = { title: string; meal: MealPeriod; ingredients: string[] }

export default function DirectNutritionEntry({
  clientId, program, timezone, logDate, loggingIntent, initialLog, initialError, recipe,
}: {
  clientId: string
  program: ProgramTier
  timezone: string
  logDate: string
  loggingIntent: NutritionLoggingIntent
  initialLog: DirectEntryLog | null
  initialError?: string
  recipe?: DirectRecipeContext
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const capabilities = getTierCapabilities(program)
  const water = loggingIntent.action === 'water'
  const initialScopedLog = initialLog?.client_id === clientId && initialLog.log_date === logDate ? initialLog : null
  const [nutritionLog, setNutritionLog] = useState(initialScopedLog)
  const [loading, setLoading] = useState(!initialError && (water ? !(Number.isFinite(Number(initialScopedLog?.water_oz)) && Number(initialScopedLog?.water_oz) > 0) : capabilities.nutritionMealLogging && !initialScopedLog))
  const [error, setError] = useState(initialError || '')
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const [waterTotal, setWaterTotal] = useState<{ clientId: string; logDate: string; total: number } | null>(null)
  const [waterEntry, setWaterEntry] = useState<DirectWaterEntry | null>(null)
  const [dayChanged, setDayChanged] = useState(false)
  const waterReadVersion = useRef(0)

  useEffect(() => {
    setError(initialError || '')
    setWaterEntry(null)
    // A same-day server refresh preserves this component and the food draft.
    // Adopt its confirmed row without remounting the logger or retaining a
    // previous local water total over the newly persisted total.
    if (initialScopedLog) {
      setNutritionLog(initialScopedLog)
      setWaterTotal(null)
      setLoading(false)
    } else if (!initialError && water) {
      setNutritionLog(null)
      setWaterTotal(null)
    }
  }, [initialScopedLog, initialError, water, clientId, logDate])

  useEffect(() => {
    if (!water || typeof window === 'undefined') return
    setDayChanged(false)
    const checkDay = () => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
      const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
      if (today !== logDate) { setDayChanged(true); router.refresh() }
    }
    checkDay()
    const timer = window.setInterval(checkDay, 30_000)
    window.addEventListener('focus', checkDay)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', checkDay) }
  }, [water, timezone, logDate, router])

  useEffect(() => {
    if ((!water && !capabilities.nutritionMealLogging) || (initialScopedLog && !retry && (!water || Number.isFinite(Number(initialScopedLog.water_oz)) && Number(initialScopedLog.water_oz) > 0)) || (initialError && !retry)) return
    const controller = new AbortController()
    const version = ++waterReadVersion.current
    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      if (water) {
        const entry = await readDirectWaterEntry(clientId, logDate, controller.signal)
        if (!cancelled && waterReadVersion.current === version) setWaterEntry(entry)
        return
      }
      const saved = retry ? await readDirectEntryLog(supabase, clientId, logDate) : null
      const prepared = saved || await prepareDirectFoodEntry({ supabase, clientId, logDate, program, signal: controller.signal })
      if (!cancelled) setNutritionLog(prepared)
    })().catch(failure => {
      if (!cancelled && waterReadVersion.current === version) setError(failure instanceof Error ? failure.message : 'Today’s logging could not be loaded.')
    }).finally(() => { if (!cancelled && waterReadVersion.current === version) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [supabase, clientId, logDate, program, capabilities.nutritionMealLogging, water, initialScopedLog, initialError, retry])

  const currentWater = waterEntry?.clientId === clientId && waterEntry.logDate === logDate ? waterEntry : null
  const scopedLog = nutritionLog?.client_id === clientId && nutritionLog.log_date === logDate ? nutritionLog : null
  const currentWaterTotal = waterTotal?.clientId === clientId && waterTotal.logDate === logDate ? waterTotal.total : null
  const consumed = currentWaterTotal ?? currentWater?.consumed ?? (Number(scopedLog?.water_consumed_oz) || 0)
  const savedTarget = Number(scopedLog?.water_oz)
  const target = dayChanged ? 0 : Number.isFinite(savedTarget) && savedTarget > 0 ? savedTarget : currentWater?.target || 0
  function waterSaved(total: number, confirmedTarget?: number) {
    waterReadVersion.current++
    setLoading(false)
    setError('')
    setWaterTotal({ clientId, logDate, total })
    if (confirmedTarget) {
      setWaterEntry({ clientId, logDate, target: confirmedTarget, consumed: total })
      if (nutritionLog) setNutritionLog({ ...nutritionLog, water_oz: confirmedTarget })
    }
  }
  if (water) return <PhoneAppFrame eyebrow="Hydration" title="A moment to refill." subtitle="Choose what you drank, then add it."><main className="aos-nutrition-page nutrition-direct-entry">
    <HydrationQuickAdd inline clientId={clientId} logDate={logDate} consumed={consumed} consumedKnown={!dayChanged && (!error || currentWaterTotal !== null)} target={target}
      targetStatus={loading && !target ? 'loading' : target > 0 ? 'ready' : 'error'} disabled={dayChanged}
      onSaved={waterSaved}
      onClosed={() => router.replace('/dashboard')} renderTrigger={() => null}>
      {dayChanged ? <div><p role="alert">The logging day changed. Reload to open today’s water entry.</p><button type="button" className="tier-secondary-action" onClick={() => router.refresh()}>Reload today</button></div> : null}
      {error ? <div><p role="alert">{error}</p><button type="button" className="tier-secondary-action" disabled={loading} onClick={() => setRetry(current => current + 1)}>Retry loading saved intake</button></div> : null}
    </HydrationQuickAdd>
  </main></PhoneAppFrame>

  return <PhoneAppFrame eyebrow="Nutrition" title="Make room for nourishment." subtitle="Record what you actually ate."><main className="aos-nutrition-page nutrition-direct-entry">
    <section className="nutrition-dashboard-panel" data-tier={program} aria-labelledby="nutrition-entry-title">
      <div className="nutrition-direct-entry-heading tier-panel-heading">
        <h1 id="nutrition-entry-title">{!capabilities.nutritionMealLogging ? 'Nutrition Guidance' : loggingIntent.action === 'meal' ? 'Log Meal' : 'Log Food'}</h1>
        <a className="tier-secondary-action" href="/dashboard">Done</a>
      </div>
      {!capabilities.nutritionMealLogging ? <div><p>EMBER includes macro targets, macro entry and water logging. Food and meal logging are not included.</p><a className="tier-primary-action" href="/dashboard/nutrition">Open macro targets and entry</a></div>
          : <>
            {recipe ? <details className="nutrition-entry-recipe-context"><summary>Recipe: {recipe.title}</summary><p>Log the foods and portions you ate from this recipe.</p><ul>{recipe.ingredients.map(ingredient => <li key={ingredient}>{ingredient}</li>)}</ul></details> : null}
            {nutritionLog ? <NutritionFoodLogger key={nutritionLog.id} nutritionLogId={nutritionLog.id} timezone={timezone}
              initialMealPeriod={loggingIntent.meal || recipe?.meal} capabilities={capabilities}
              onUpdated={(_remaining, action) => { setMessage(action === 'removed' ? 'Food removed. Your saved daily totals are updated.' : 'Food saved. Your daily totals are updated.'); router.refresh() }} /> : null}
            {loading ? <p role="status" aria-live="polite">Preparing today’s food entry…</p> : null}
          </>}
      {error ? <div><p role="alert">{error}</p><button type="button" className="tier-secondary-action" disabled={loading} onClick={() => setRetry(current => current + 1)}>Retry loading saved intake</button></div> : null}
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
    </section>
  </main></PhoneAppFrame>
}
