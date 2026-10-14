'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import HydrationQuickAdd from '@/components/hydration/HydrationQuickAdd'
import NutritionFoodLogger from '@/components/NutritionFoodLogger'
import { getTierCapabilities, type ProgramTier } from '@/lib/entitlements'
import { createClient } from '@/lib/supabase/client'
import { prepareDirectFoodEntry, readDirectEntryLog, type DirectEntryLog } from '@/lib/nutrition/directEntry'
import type { NutritionLoggingIntent } from '@/lib/nutrition/loggingIntent'
import type { MealPeriod } from '@/lib/nutrition/mealPeriod'

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
  const [nutritionLog, setNutritionLog] = useState(initialLog)
  const [loading, setLoading] = useState(!water && capabilities.nutritionMealLogging && !initialLog && !initialError)
  const [error, setError] = useState(initialError || '')
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const [waterTotal, setWaterTotal] = useState<number | null>(null)

  useEffect(() => {
    if ((water && !retry) || (!water && !capabilities.nutritionMealLogging) || (initialLog && !retry) || (initialError && !retry)) return
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      const saved = retry ? await readDirectEntryLog(supabase, clientId, logDate) : null
      const prepared = saved || (water ? null : await prepareDirectFoodEntry({ supabase, clientId, logDate, program, signal: controller.signal }))
      if (!cancelled) setNutritionLog(prepared)
    })().catch(failure => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : 'Today’s logging could not be loaded.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [supabase, clientId, logDate, program, capabilities.nutritionMealLogging, water, initialLog, initialError, retry])

  const consumed = waterTotal ?? (Number(nutritionLog?.water_consumed_oz) || 0)
  const target = Number(nutritionLog?.water_oz) || 0
  return <main className="aos-nutrition-page nutrition-direct-entry">
    <section className="nutrition-dashboard-panel" data-tier={program} aria-labelledby="nutrition-entry-title">
      <div className="nutrition-direct-entry-heading tier-panel-heading">
        <h1 id="nutrition-entry-title">{water ? 'Log Water' : !capabilities.nutritionMealLogging ? 'Nutrition Guidance' : loggingIntent.action === 'meal' ? 'Log Meal' : 'Log Food'}</h1>
        <a className="tier-secondary-action" href="/dashboard">Done</a>
      </div>
      {water ? <HydrationQuickAdd clientId={clientId} logDate={logDate} consumed={consumed} consumedKnown={!error || waterTotal !== null} target={target} initiallyOpen
        onSaved={setWaterTotal} renderTrigger={({ toggle, triggerRef }) => <button ref={triggerRef} type="button" className="tier-primary-action" onClick={toggle}>Log water</button>} />
        : !capabilities.nutritionMealLogging ? <div><p>Your EMBER plan includes nutrition guidance and macro entry. Food and meal logging require IGNITE or PHOENIX.</p><a className="tier-primary-action" href="/dashboard/nutrition">Open nutrition guidance and macros</a></div>
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
  </main>
}
