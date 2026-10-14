'use client'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { beginWaterSubmission, confirmWaterSubmission, pendingWaterSubmission, type WaterSubmission } from '@/lib/hydration/waterSubmission'
type TriggerRenderProps = { open: boolean; addingWater: boolean; triggerRef: RefObject<HTMLButtonElement | null>; toggle: () => void }
type Props = { clientId: string; logDate: string; consumed: number; target: number; defaultOunces?: number; minimumOunces?: number; maximumOunces?: number; stepOunces?: number; onSaved?: (total: number) => void; renderTrigger: (props: TriggerRenderProps) => ReactNode }
export default function HydrationQuickAdd({ clientId, logDate, consumed, target, defaultOunces = 8, onSaved, renderTrigger }: Props) {
  const router = useRouter(); const triggerRef = useRef<HTMLButtonElement | null>(null); const dialogRef = useRef<HTMLDialogElement>(null); const lock = useRef(false)
  const [open, setOpen] = useState(false); const [amount, setAmount] = useState(String(defaultOunces)); const [addingWater, setAdding] = useState(false); const [message, setMessage] = useState('')
  const [pending, setPending] = useState<WaterSubmission | null>(null)
  useEffect(() => {
    try {
      const saved = pendingWaterSubmission(clientId)
      setPending(saved)
      if (saved) {
        setAmount(String(saved.ounces))
        setMessage(saved.logDate === logDate ? `Retry the pending ${saved.ounces} oz save to confirm your total.` : `The ${saved.ounces} oz save for ${saved.logDate} could not be confirmed. Review that day’s hydration before logging again.`)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Water retry storage is unavailable.') }
  }, [clientId, logDate])
  useEffect(() => { if (open) dialogRef.current?.showModal(); else dialogRef.current?.close() }, [open])
  async function addWater() {
    if (lock.current) return
    const ounces = Number(amount); if (!Number.isFinite(ounces) || ounces <= 0) { setMessage('Enter the amount you drank.'); return }
    lock.current = true; setAdding(true); setMessage('')
    try {
      const submission = beginWaterSubmission(clientId, ounces, logDate)
      setPending(submission)
      const response = await fetch('/api/nutrition/add-water', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, ...submission }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Water could not be saved.')
      const total = Number(payload.nutritionLog?.water_consumed_oz)
      if (!Number.isFinite(total) || total < 0) throw new Error('The saved water total could not be confirmed. Retry this same drink.')
      confirmWaterSubmission(clientId, submission.submissionId)
      setPending(null)
      onSaved?.(total); setMessage(`${ounces} oz saved. Today’s plan is updated.`); router.refresh()
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Water could not be saved. Try again.') }
    finally { lock.current = false; setAdding(false) }
  }
  return <div className="hydration-quick-add">
    {renderTrigger({ open, addingWater, triggerRef, toggle: () => setOpen(!open) })}
    <dialog ref={dialogRef} className="daily-action-dialog" onCancel={() => setOpen(false)} onClose={() => { setOpen(false); triggerRef.current?.focus() }} aria-label="Log water">
      <div className="tier-panel-heading"><h2>Log water</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close water entry">Close</button></div>
      <p>{consumed > 0 ? `${Math.round(consumed)} oz logged` : 'No water logged yet'} · Daily target {Math.round(target)} oz</p>
      <p>Log what you’ve had, or choose a small drink at your own pace. Keep any fluid guidance from your care team.</p>
      <div className="tier-action-row">{[4, 8, 12].map(ounces => <button key={ounces} type="button" disabled={addingWater || Boolean(pending)} aria-pressed={Number(amount) === ounces} onClick={() => setAmount(String(ounces))}>{ounces} oz</button>)}</div>
      <label>Amount (oz)<input autoFocus type="number" inputMode="decimal" min="0.1" step="any" value={amount} onChange={e => setAmount(e.target.value)} disabled={addingWater || Boolean(pending)}/></label>
      <button type="button" className="tier-primary-action" disabled={addingWater || Boolean(pending && pending.logDate !== logDate)} onClick={() => void addWater()}>{addingWater ? 'Saving…' : pending ? `Retry ${pending.ounces} oz save` : `Log ${amount || 'water'} oz`}</button><p role="status">{message}</p>
    </dialog>
  </div>
}
