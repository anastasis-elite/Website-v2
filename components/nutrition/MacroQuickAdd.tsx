'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { getMealPeriodForLocalDate } from '@/lib/nutrition/mealPeriod'
import { getClientLocalDateOffset } from '@/lib/timezone'

export type MacroRemaining = {
  calories_remaining?: number | null
  protein_remaining_g?: number | null
  carbs_remaining_g?: number | null
  fat_remaining_g?: number | null
}

type TriggerRenderProps = {
  open: boolean
  savingMacros: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  toggle: () => void
}

type Props = {
  clientId: string
  logDate: string
  timezone?: string
  nutritionLogId: string | null
  disabled?: boolean
  loading?: boolean
  initiallyOpen?: boolean
  onSaved?: (remaining: MacroRemaining | null) => Promise<void>
  onRefresh?: () => Promise<void>
  renderTrigger: (props: TriggerRenderProps) => ReactNode
}

const emptyEntry = { calories: '', protein: '', carbs: '', fats: '' }
const unknownSave = 'This macro save could not be confirmed. Check your saved totals before recording this entry again.'

export default function MacroQuickAdd({
  clientId, logDate, timezone, nutritionLogId, disabled = false, loading = false, initiallyOpen = false,
  onSaved, onRefresh, renderTrigger,
}: Props) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  // The endpoint adds another row each time. Keep a durable uncertainty marker
  // before sending; reopening or reloading must never silently retry that row.
  const storageKey = `aos:macro-submission:${clientId}:${logDate}`
  const scope = `${storageKey}:${nutritionLogId || ''}`
  const activeScope = useRef(scope)
  activeScope.current = scope
  const operation = useRef<symbol | null>(null)
  const [open, setOpen] = useState(initiallyOpen)
  const [macroEntry, setMacroEntry] = useState(emptyEntry)
  const [savingMacros, setSavingMacros] = useState(false)
  const [message, setMessage] = useState('')
  const [storageReady, setStorageReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    operation.current = null
    setMacroEntry(emptyEntry)
    setSavingMacros(false)
    setChecking(false)
    setReviewed(false)
    setStorageReady(false)
    setMessage('')
    try {
      const earlier = window.localStorage.getItem(storageKey) !== null
      setPending(earlier)
      setStorageReady(true)
      if (earlier) setMessage(unknownSave)
    } catch {
      setPending(true)
      setMessage('Macro entry is unavailable because this browser cannot retain a save confirmation. Enable browser storage and reload before adding macros.')
    }
  }, [storageKey, scope])

  useEffect(() => { if (initiallyOpen) setOpen(true) }, [initiallyOpen])
  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) {
      dialog.showModal()
      firstInputRef.current?.focus()
    } else if (!open && dialog?.open) dialog.close()
  }, [open])

  const controlsDisabled = disabled || loading || savingMacros || pending || !storageReady || !nutritionLogId
  const hasValues = Object.values(macroEntry).some(value => Number(value) > 0)

  async function handleMacroSubmit(event: FormEvent) {
    event.preventDefault()
    if (operation.current || controlsDisabled || !clientId || !nutritionLogId) return
    if (getClientLocalDateOffset({ timezone }) !== logDate) {
      setMessage('The logging day changed. Reload to open today’s macro entry.')
      return
    }
    const values = Object.fromEntries(Object.entries(macroEntry).map(([key, value]) => [key, Number(value || 0)]))
    if (!hasValues || Object.values(values).some(value => !Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
      setMessage('Enter at least one positive whole-number value. Leave unused fields blank.')
      return
    }

    const request = Symbol('macro-save')
    const submissionScope = scope
    const isCurrent = () => activeScope.current === submissionScope && operation.current === request
    operation.current = request
    setSavingMacros(true)
    setMessage('')
    let sent = false
    let confirmed = false
    const marker = JSON.stringify({ startedAt: new Date().toISOString(), nutritionLogId })
    const clearThisMarker = () => {
      if (window.localStorage.getItem(storageKey) === marker) window.localStorage.removeItem(storageKey)
    }

    try {
      // Recheck storage at the last moment, including a save begun in another tab.
      if (window.localStorage.getItem(storageKey) !== null) {
        setPending(true)
        setMessage(unknownSave)
        return
      }
      window.localStorage.setItem(storageKey, marker)
      setPending(true)
      sent = true
      const response = await fetch('/api/nutrition/add-macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutritionLogId, ...values, mealPeriod: getMealPeriodForLocalDate(new Date(), timezone) }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok && [400, 401, 403, 404].includes(response.status)) {
        // These route responses precede the insert. It is safe to edit and resubmit.
        clearThisMarker()
        if (isCurrent()) {
          setPending(false)
          setMessage(payload?.error || 'Macros were not saved. Review your entry and try again.')
        }
        return
      }
      if (!response.ok || payload?.success !== true || !payload?.entry?.id) throw new Error(unknownSave)

      confirmed = true
      clearThisMarker()
      if (!isCurrent()) return
      setPending(false)
      setMacroEntry(emptyEntry)
      // A confirmed insert stays confirmed even if refreshing the display fails.
      try {
        await onSaved?.(payload.remaining || null)
        if (isCurrent()) setMessage(payload.refreshStatus === 'degraded'
          ? 'Macros saved. Some totals are still refreshing. Do not add this entry again.'
          : 'Macros saved.')
      } catch {
        if (isCurrent()) setMessage('Macros saved. Saved totals could not be refreshed yet. Do not add this entry again.')
      }
    } catch {
      if (!isCurrent()) return
      if (confirmed) {
        setMacroEntry(emptyEntry)
        setMessage('Macros saved. This browser could not clear the save confirmation. Reload and check saved totals before adding another entry.')
      } else if (sent) {
        setMessage(unknownSave)
      } else {
        setStorageReady(false)
        setMessage('Macros were not sent. This browser could not retain a save confirmation. Enable browser storage and reload before adding macros.')
      }
    } finally {
      if (isCurrent()) {
        operation.current = null
        setSavingMacros(false)
      }
    }
  }

  async function checkSavedTotals() {
    if (!onRefresh || operation.current || checking) return
    const checkingScope = scope
    setChecking(true)
    setReviewed(false)
    try {
      await onRefresh()
      if (activeScope.current !== checkingScope) return
      setReviewed(true)
      setMessage('Saved totals refreshed. Check your daily targets before starting a separate entry. The earlier save will not be retried.')
    } catch {
      if (activeScope.current === checkingScope) setMessage('Saved totals could not be refreshed. The earlier macro save is still unconfirmed; do not add it again.')
    } finally {
      if (activeScope.current === checkingScope) setChecking(false)
    }
  }

  function startSeparateEntry() {
    if (!reviewed || checking || operation.current) return
    try {
      window.localStorage.removeItem(storageKey)
      setPending(false)
      setMacroEntry(emptyEntry)
      setReviewed(false)
      setMessage('Enter only new intake that you have not already recorded.')
      firstInputRef.current?.focus()
    } catch {
      setMessage('This browser could not clear the save confirmation. Reload and check saved totals before adding another entry.')
    }
  }

  return <div className="macro-quick-add">
    {renderTrigger({ open, savingMacros, triggerRef, toggle: () => setOpen(current => !current) })}
    <dialog ref={dialogRef} className="daily-action-dialog water-entry-dialog macro-entry-dialog"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={() => setOpen(false)} onClose={() => { setOpen(false); triggerRef.current?.focus() }}>
      <div className="tier-panel-heading"><h2 id={`${id}-title`}>Add Macros</h2><button type="button" aria-label="Close macro entry" onClick={() => setOpen(false)}>Close</button></div>
      <p id={`${id}-description`}>Enter the totals you want to record for this meal or block. Each save adds to today’s intake.</p>
      {loading ? <p role="status" aria-live="polite">Preparing today’s macro entry…</p>
        : !nutritionLogId ? <p role="status">Today’s macro entry is unavailable. Close this dialog and retry loading nutrition.</p> : null}
      <form onSubmit={handleMacroSubmit} className="nutrition-macro-form" aria-busy={savingMacros}>
        <div className="nutrition-macro-entry-grid">
          {([
            ['calories', 'Calories'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fats', 'Fat (g)'],
          ] as const).map(([key, label], index) => <label key={key} htmlFor={`${id}-${key}`}>
            <span>{label}</span>
            <input id={`${id}-${key}`} ref={index === 0 ? firstInputRef : undefined} type="number" inputMode="numeric"
              min="0" step="1" value={macroEntry[key]} disabled={controlsDisabled}
              onChange={event => setMacroEntry(current => ({ ...current, [key]: event.target.value }))} />
          </label>)}
        </div>
        <button type="submit" className="tier-primary-action" disabled={controlsDisabled || !hasValues}>{savingMacros ? 'Saving Macros…' : 'Add Macros'}</button>
      </form>
      <p className="water-entry-status" role="status" aria-live="polite">{message}</p>
      {pending && storageReady && !savingMacros ? <div className="macro-save-review">
        <button type="button" className="tier-secondary-action" disabled={checking || !onRefresh} onClick={() => void checkSavedTotals()}>{checking ? 'Checking saved totals…' : 'Check saved totals'}</button>
        {reviewed ? <button type="button" className="tier-secondary-action" disabled={checking} onClick={startSeparateEntry}>Start a separate entry</button> : null}
      </div> : null}
    </dialog>
  </div>
}
