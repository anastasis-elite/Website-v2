'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
export default function DailyDisplayPreferences({ executionStyle = 'flow', carouselStyle = 'section', transitionMinutes = 10 }: { executionStyle?: string; carouselStyle?: string; transitionMinutes?: number }) {
  const router = useRouter(); const lock = useRef(false)
  const [style, setStyle] = useState(executionStyle); const [display, setDisplay] = useState(carouselStyle)
  const [buffer, setBuffer] = useState(transitionMinutes); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (lock.current) return; lock.current = true; setSaving(true)
    try { const response = await fetch('/api/dashboard/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ executionStyle: style, carouselStyle: display, transitionMinutes: buffer }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error)
      setMessage('Saved. Today’s view now follows your preferences.'); router.refresh()
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Preferences could not be saved.') }
    finally { lock.current = false; setSaving(false) }
  }
  return <details className="daily-preferences"><summary>How would you like to see your day?</summary><form onSubmit={save}>
    <label>Daily structure<select value={style} onChange={e => setStyle(e.target.value)}><option value="schedule">Structured schedule</option><option value="flow">Flexible rhythm</option><option value="hybrid">Hybrid</option></select></label>
    <label>Amount of guidance<select value={display} onChange={e => setDisplay(e.target.value)}><option value="section">Daily essentials</option><option value="step">One next step at a time</option></select></label>
    <label>Transition buffer (minutes)<input type="number" min="0" max="120" value={buffer} onChange={e => setBuffer(Number(e.target.value))}/></label>
    <p>Unblocked time is potentially available. Leave room for transitions, rest, and the unexpected.</p>
    <button className="tier-primary-action" disabled={saving}>{saving ? 'Saving…' : 'Save display preferences'}</button><p role="status">{message}</p>
  </form></details>
}
