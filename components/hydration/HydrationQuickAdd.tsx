'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { archiveWaterSubmission, archivedWaterSubmissions, beginWaterSubmission, confirmWaterSubmission, pendingWaterSubmission, retainWaterSubmission, type WaterSubmission } from '@/lib/hydration/waterSubmission'
import { readWaterReceiptStatus } from '@/lib/hydration/reconcileWaterSubmission'

type TriggerRenderProps = {
  open: boolean
  addingWater: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  toggle: () => void
}
type Props = {
  clientId: string
  logDate: string
  consumed: number
  consumedKnown?: boolean
  target: number
  defaultOunces?: number
  minimumOunces?: number
  maximumOunces?: number
  stepOunces?: number
  initiallyOpen?: boolean
  inline?: boolean
  onSaved?: (total: number) => void
  onClosed?: () => void
  children?: ReactNode
  renderTrigger: (props: TriggerRenderProps) => ReactNode
}

export default function HydrationQuickAdd({
  clientId, logDate, consumed, consumedKnown = true, target, defaultOunces = 8,
  minimumOunces = 4, maximumOunces = 64, stepOunces = 4,
  initiallyOpen = false, inline = false, onSaved, onClosed, children, renderTrigger,
}: Props) {
  const router = useRouter()
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const reconciliationAttempt = useRef(0)
  const scope = `${clientId}:${logDate}`
  const activeScope = useRef(scope)
  activeScope.current = scope
  const [open, setOpen] = useState(initiallyOpen)
  const [amount, setAmount] = useState(String(defaultOunces))
  const [addingWater, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<WaterSubmission | null>(null)
  const [archived, setArchived] = useState<WaterSubmission[]>([])
  const [checkingEarlier, setCheckingEarlier] = useState(false)
  const [receiptCheck, setReceiptCheck] = useState(0)
  const [confirmed, setConfirmed] = useState<{ scope: string; total: number } | null>(null)

  useEffect(() => {
    reconciliationAttempt.current++
    setPending(null)
    setAmount(String(defaultOunces))
    setMessage('')
    setConfirmed(null)
    try {
      const saved = pendingWaterSubmission(clientId)
      setPending(saved)
      setArchived(archivedWaterSubmissions(clientId))
      if (saved) {
        setAmount(String(saved.ounces))
        setMessage(saved.logDate === logDate
          ? `Retry the pending ${saved.ounces} oz save to confirm your total.`
          : `The ${saved.ounces} oz save for ${saved.logDate} could not be confirmed. Review that day’s hydration before logging again.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Water retry storage is unavailable.')
    }
  }, [clientId, logDate, defaultOunces])

  useEffect(() => {
    if (!pending || pending.logDate === logDate) { setCheckingEarlier(false); return }
    const receipt = pending
    const attempt = ++reconciliationAttempt.current
    const receiptScope = scope
    setCheckingEarlier(true)
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const status = await readWaterReceiptStatus(createClient(), clientId, receipt)
        if (activeScope.current !== receiptScope || reconciliationAttempt.current !== attempt) return
        if (status === 'confirmed') {
          confirmWaterSubmission(clientId, receipt.submissionId)
          setPending(null)
          setAmount(String(defaultOunces))
          setMessage(`Your ${receipt.ounces} oz save for ${receipt.logDate} is confirmed. You can log today’s water.`)
        } else {
          setMessage(`The ${receipt.ounces} oz save for ${receipt.logDate} could not be confirmed. You can keep that receipt for review and start a separate log for today.`)
        }
      } catch (error) {
        if (activeScope.current === receiptScope && reconciliationAttempt.current === attempt) {
          setMessage(error instanceof Error ? error.message : 'The earlier save could not be checked. Its receipt has been kept.')
        }
      } finally {
        if (activeScope.current === receiptScope && reconciliationAttempt.current === attempt) setCheckingEarlier(false)
      }
    })()
  }, [pending, clientId, logDate, scope, defaultOunces, receiptCheck])

  useEffect(() => setConfirmed(null), [consumed])
  useEffect(() => { if (initiallyOpen) setOpen(true) }, [initiallyOpen])
  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
    else if (!open && dialog?.open) dialog.close()
  }, [open])

  const logged = confirmed?.scope === scope ? confirmed.total : consumed
  const totalKnown = confirmed?.scope === scope || consumedKnown
  const minimum = Number.isFinite(minimumOunces) && minimumOunces > 0 ? minimumOunces : 4
  const maximum = Number.isFinite(maximumOunces) && maximumOunces > minimum ? maximumOunces : Math.max(64, minimum + 1)
  const step = Number.isFinite(stepOunces) && stepOunces > 0 ? stepOunces : 4
  const ounces = Number(amount)
  const validAmount = amount.trim() !== '' && Number.isFinite(ounces) && ounces > 0
  const sliderValue = validAmount ? ounces : minimum
  // Manual amounts remain exact, even when they sit outside the usual slider range.
  const sliderMinimum = Math.min(minimum, sliderValue)
  const sliderMaximum = Math.max(maximum, sliderValue)
  const sliderStep = Number.isInteger((sliderValue - sliderMinimum) / step) ? step : 'any'
  const controlsDisabled = addingWater || Boolean(pending)
  const presets = [4, 8, 12, 16]

  function startToday() {
    if (!pending || pending.logDate === logDate || lock.current) return
    reconciliationAttempt.current++
    try {
      archiveWaterSubmission(clientId, pending)
      setArchived(archivedWaterSubmissions(clientId))
      setPending(null)
      setCheckingEarlier(false)
      setAmount(String(defaultOunces))
      setMessage(`The earlier ${pending.ounces} oz save for ${pending.logDate} is kept for review. Today’s water will use a separate receipt.`)
    } catch (error) {
      setCheckingEarlier(false)
      setMessage(error instanceof Error ? error.message : 'The earlier receipt could not be retained. Today’s water log has not started.')
    }
  }

  async function addWater() {
    if (lock.current || !clientId) return
    if (!validAmount) { setMessage('Enter the amount you drank.'); return }
    const submissionScope = scope
    lock.current = true
    setAdding(true)
    setMessage('')
    try {
      const submission = pending ? retainWaterSubmission(clientId, pending, logDate) : beginWaterSubmission(clientId, ounces, logDate)
      setPending(submission)
      const response = await fetch('/api/nutrition/add-water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...submission }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Water could not be saved.')
      const savedTotal = payload.nutritionLog?.water_consumed_oz
      const total = typeof savedTotal === 'number' || (typeof savedTotal === 'string' && savedTotal.trim() !== '') ? Number(savedTotal) : NaN
      if (!Number.isFinite(total) || total < 0) throw new Error('The saved water total could not be confirmed. Retry this same drink.')
      confirmWaterSubmission(clientId, submission.submissionId)
      if (activeScope.current !== submissionScope) return
      setPending(null)
      setConfirmed({ scope: submissionScope, total })
      onSaved?.(total)
      setMessage(`${ounces} oz saved. ${total} oz logged today.`)
      router.refresh()
    } catch (error) {
      if (activeScope.current === submissionScope) setMessage(error instanceof Error ? error.message : 'Water could not be saved. Try again.')
    } finally {
      lock.current = false
      setAdding(false)
    }
  }

  const content = <>
      <div className="tier-panel-heading"><h2 id={`${id}-title`}>A little water, at your pace.</h2>{!inline ? <button type="button" onClick={() => setOpen(false)} aria-label="Close water entry">Close</button> : null}</div>
      <p id={`${id}-summary`} className="water-entry-summary">{!totalKnown ? 'Saved water total unavailable' : logged > 0 ? `${logged} oz logged` : 'No water logged yet'}{Number.isFinite(target) && target > 0 ? ` · Daily target ${Math.round(target)} oz` : ' · Daily target unavailable'}</p>
      <p className="water-entry-help">Choose the amount you drank. Follow any fluid guidance from your care team.</p>
      {children}
      {pending && pending.logDate !== logDate ? <div className="water-earlier-save">
        <p>{checkingEarlier ? 'Checking your earlier saved water…' : `Your ${pending.ounces} oz save for ${pending.logDate} needs review.`}</p>
        <button type="button" disabled={checkingEarlier || addingWater} onClick={() => setReceiptCheck(current => current + 1)}>Check earlier save</button>
        <button type="button" disabled={addingWater} onClick={startToday}>Keep earlier save and log today</button>
      </div> : null}
      <div className="water-amount-control">
        <label htmlFor={`${id}-slider`}>Water amount <strong>{validAmount ? `${amount} oz` : 'Choose an amount'}</strong></label>
        <input id={`${id}-slider`} className="water-amount-slider" type="range"
          style={{ '--aos-range-progress': `${(sliderValue - sliderMinimum) / Math.max(1, sliderMaximum - sliderMinimum) * 100}%` } as CSSProperties}
          min={sliderMinimum} max={sliderMaximum} step={sliderStep} value={sliderValue}
          aria-valuetext={`${sliderValue} fluid ounces`} aria-controls={`${id}-manual`}
          onChange={event => setAmount(event.target.value)} disabled={controlsDisabled} />
        <div className="water-slider-labels" aria-hidden="true"><span>{sliderMinimum} oz</span><span>{sliderMaximum} oz</span></div>
      </div>
      <div className="water-presets" aria-label="Water amount presets">{presets.map(preset => <button key={preset} type="button"
        disabled={controlsDisabled} aria-pressed={validAmount && ounces === preset}
        onClick={() => setAmount(String(preset))}>{preset} oz</button>)}</div>
      <label className="water-manual-entry" htmlFor={`${id}-manual`}>Or enter ounces
        <input id={`${id}-manual`} type="number" inputMode="decimal" min="0.1" step="any"
          value={amount} onChange={event => setAmount(event.target.value)} disabled={controlsDisabled} />
      </label>
      <button type="button" className="tier-primary-action water-save-action"
        disabled={addingWater || !clientId || !validAmount || Boolean(pending && pending.logDate !== logDate)}
        onClick={() => void addWater()}>{addingWater ? 'Saving…' : pending ? `Retry ${pending.ounces} oz save` : `${inline ? 'Add' : 'Log'} ${amount || 'water'} oz`}</button>
      <p className="water-entry-status" role="status" aria-live="polite">{message}</p>
      {archived.length ? <details className="water-earlier-receipts"><summary>Earlier water saves kept for review ({archived.length})</summary>
        <p>These earlier receipts remain in this browser. They are not retried or included in today’s water log.</p>
        <ul>{archived.map(receipt => <li key={receipt.submissionId}>{receipt.logDate}: {receipt.ounces} oz · confirmation unknown</li>)}</ul>
      </details> : null}
    </>
  return <div className="hydration-quick-add">
    {renderTrigger({ open, addingWater, triggerRef, toggle: () => setOpen(current => !current) })}
    {inline ? <section className="phone-app-water-entry" aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>{content}</section> : <dialog ref={dialogRef} className="daily-action-dialog water-entry-dialog"
      onCancel={() => setOpen(false)}
      onClose={() => { setOpen(false); triggerRef.current?.focus(); onClosed?.() }}
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>{content}</dialog>}
  </div>
}
