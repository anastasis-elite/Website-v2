'use client'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
type TriggerRenderProps = { open: boolean; addingWater: boolean; triggerRef: RefObject<HTMLButtonElement | null>; toggle: () => void }
type Props = { clientId: string; consumed: number; target: number; defaultOunces?: number; minimumOunces?: number; maximumOunces?: number; stepOunces?: number; onSaved?: (total: number) => void; renderTrigger: (props: TriggerRenderProps) => ReactNode }
export default function HydrationQuickAdd({ clientId, consumed, target, defaultOunces = 8, onSaved, renderTrigger }: Props) {
  const router = useRouter(); const triggerRef = useRef<HTMLButtonElement | null>(null); const dialogRef = useRef<HTMLDialogElement>(null); const lock = useRef(false); const submissionId = useRef<string | null>(null)
  const [open, setOpen] = useState(false); const [amount, setAmount] = useState(String(defaultOunces)); const [addingWater, setAdding] = useState(false); const [message, setMessage] = useState('')
  const lastAmount = useRef<number | null>(null)
  useEffect(() => { if (open) dialogRef.current?.showModal(); else dialogRef.current?.close() }, [open])
  async function addWater() {
    if (lock.current) return
    const ounces = Number(amount); if (!Number.isFinite(ounces) || ounces <= 0) { setMessage('Enter the amount you drank.'); return }
    lock.current = true; if (lastAmount.current !== ounces) submissionId.current = null; lastAmount.current = ounces; submissionId.current ||= crypto.randomUUID(); setAdding(true); setMessage('')
    try {
      const response = await fetch('/api/nutrition/add-water', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, ounces, submissionId: submissionId.current }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Water could not be saved.')
      submissionId.current = null
      onSaved?.(Number(payload.nutritionLog.water_consumed_oz)); setMessage(`${ounces} oz saved. Today’s plan is updated.`); router.refresh()
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Water could not be saved. Try again.') }
    finally { lock.current = false; setAdding(false) }
  }
  return <div className="hydration-quick-add">
    {renderTrigger({ open, addingWater, triggerRef, toggle: () => setOpen(!open) })}
    <dialog ref={dialogRef} className="daily-action-dialog" onCancel={() => setOpen(false)} onClose={() => { setOpen(false); triggerRef.current?.focus() }} aria-label="Log water">
      <div className="tier-panel-heading"><h2>Log water</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close water entry">Close</button></div>
      <p>{consumed > 0 ? `${Math.round(consumed)} oz logged` : 'No water logged yet'} · Daily target {Math.round(target)} oz</p>
      <p>Log what you’ve had, or choose a small drink at your own pace. Keep any fluid guidance from your care team.</p>
      <div className="tier-action-row">{[4, 8, 12].map(ounces => <button key={ounces} type="button" aria-pressed={Number(amount) === ounces} onClick={() => setAmount(String(ounces))}>{ounces} oz</button>)}</div>
      <label>Amount (oz)<input autoFocus type="number" inputMode="decimal" min="0.1" step="any" value={amount} onChange={e => setAmount(e.target.value)} disabled={addingWater}/></label>
      <button type="button" className="tier-primary-action" disabled={addingWater} onClick={() => void addWater()}>{addingWater ? 'Saving…' : `Log ${amount || 'water'} oz`}</button><p role="status">{message}</p>
    </dialog>
  </div>
}
