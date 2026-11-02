'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

const fields = [
  ['calories', 'Calories'], ['protein', 'Protein (g)'], ['carbs', 'Carbohydrates (g)'], ['fats', 'Fat (g)'], ['waterOz', 'Water (oz)'],
] as const
type Field = typeof fields[number][0]
type Values = Partial<Record<Field, string>>
type Intake = { nutritionLog?: { water_consumed_oz?: number } | null; entries?: Array<{ id: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }> }

export default function TrackerIntake({ clientId }: { clientId: string }) {
  const [values, setValues] = useState<Values>({})
  const [intake, setIntake] = useState<Intake>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState('')
  const lock = useRef(false)
  const pending = useRef<Record<string, unknown> | null>(null)
  async function refresh() {
    const response = await fetch(`/api/tracker/nutrition?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Saved intake could not be loaded.')
    setIntake(result); setLoaded(true)
  }
  useEffect(() => { void refresh().catch(() => setMessage('Saved intake could not be loaded. Reload this page to try again.'))
    // Identity changes remount the owner-scoped tracker page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    setMessage('')
    if (!pending.current) {
      const actual: Partial<Record<Field, number>> = {}
      for (const [key] of fields) {
        if (!(values[key] || '').trim()) continue
        const value = Number(values[key])
        if (!Number.isFinite(value) || value < 0 || value > (key === 'waterOz' ? 10000 : 1000000) || key === 'waterOz' && value === 0) {
          setMessage('Use valid nonnegative nutrition amounts and a positive water amount when included. Leave unrecorded fields blank.'); return
        }
        actual[key] = value
      }
      if (!Object.values(actual).some(value => value > 0)) { setMessage('Enter at least one amount you consumed.'); return }
      pending.current = { clientId, requestId: crypto.randomUUID(), ...actual }
    }
    lock.current = true; setSaving(true); setAttempted(true)
    try {
      const response = await fetch('/api/tracker/nutrition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current) })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.success !== true) throw new Error(result?.error || 'The save was not confirmed. Retry the same entry.')
      pending.current = null; setValues({}); setAttempted(false); setMessage('Intake saved.')
      try { await refresh() } catch { setMessage('Intake saved. Reload this page to update the displayed history.') }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The save was not confirmed. Retry the same entry.') }
    finally { lock.current = false; setSaving(false) }
  }
  return <section className="aos-card" aria-label="Tracker nutrition and hydration">
    <h2>Nutrition and hydration log</h2>
    <p>Record what you consumed. Tracker does not generate nutrition targets or coaching.</p>
    <form onSubmit={save}>
      <fieldset disabled={saving || attempted} className="activity-inputs"><legend>Actual intake</legend>
        {fields.map(([key, label]) => <label key={key}>{label}<input type="number" inputMode="decimal" min="0" max={key === 'waterOz' ? 10000 : 1000000} step="any" value={values[key] || ''} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} /></label>)}
      </fieldset>
      {attempted && !saving ? <p>Your entry is kept unchanged for a safe retry.</p> : null}
      <button type="submit" className="tier-primary-action" disabled={saving}>{saving ? 'Saving…' : attempted ? 'Retry save' : 'Save intake'}</button>
    </form>
    <p role="status">{message}</p>
    <h3>Saved today</h3>
    {loaded ? <>
      <p>Water recorded: {intake.nutritionLog?.water_consumed_oz ?? 0} oz</p>
      {intake.entries?.length ? <ul>{intake.entries.map(entry => <li key={entry.id}>{entry.calories ?? 0} calories · {entry.protein_g ?? 0} g protein · {entry.carbs_g ?? 0} g carbohydrates · {entry.fat_g ?? 0} g fat</li>)}</ul> : <p>No nutrition entries recorded today.</p>}
    </> : <p>Saved intake has not loaded yet.</p>}
  </section>
}
