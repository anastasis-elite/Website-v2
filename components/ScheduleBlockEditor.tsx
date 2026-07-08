'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type Block = { id?: string; block_type: string; label: string; days_of_week: number[]; start_time: string; end_time: string }
const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const emptyBlock = (): Block => ({ block_type: 'work', label: '', days_of_week: [1,2,3,4,5], start_time: '09:00', end_time: '17:00' })

export default function ScheduleBlockEditor({ clientId, initialBlocks }: { clientId: string; initialBlocks: Block[] }) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const update = (index: number, patch: Partial<Block>) => setBlocks((current) => current.map((block, position) => position === index ? { ...block, ...patch } : block))
  async function save() {
    setSaving(true); setStatus('')
    const response = await fetch('/api/daily-structure/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, blocks }) })
    const data = await response.json(); setSaving(false)
    setStatus(response.ok ? 'Schedule saved. Open time is now available to your daily plan.' : data.error || 'Schedule could not be saved.')
  }
  return <section style={styles.cartBoxStyle}>
    <h2 style={styles.sectionTitleStyle}>Blocked time and available capacity</h2>
    <p style={styles.bodyStyle}>Add recurring obligations. Everything outside these blocks remains available for training, walking, nourishment, mobility, or recovery.</p>
    <div style={{ display: 'grid', gap: 16 }}>
      {blocks.map((block, index) => <div key={block.id || index} style={styles.compactCardStyle}>
        <div style={styles.gridTwoCol}>
          <select value={block.block_type} onChange={(event) => update(index, { block_type: event.target.value })} style={styles.inputStyle}><option value="sleep">Sleep</option><option value="work">Work</option><option value="school_dropoff">School drop-off</option><option value="school_pickup">School pickup</option><option value="commute">Commute</option><option value="appointment">Appointment</option><option value="other">Other obligation</option></select>
          <input value={block.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Optional label" style={styles.inputStyle} />
          <input type="time" value={block.start_time.slice(0,5)} onChange={(event) => update(index, { start_time: event.target.value })} style={styles.inputStyle} />
          <input type="time" value={block.end_time.slice(0,5)} onChange={(event) => update(index, { end_time: event.target.value })} style={styles.inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{days.map((label, day) => <button type="button" key={label} onClick={() => update(index, { days_of_week: block.days_of_week.includes(day) ? block.days_of_week.filter((value) => value !== day) : [...block.days_of_week, day] })} style={block.days_of_week.includes(day) ? styles.primaryButtonStyle : styles.secondaryButtonStyle}>{label}</button>)}</div>
        <button type="button" onClick={() => setBlocks((current) => current.filter((_, position) => position !== index))} style={{ ...styles.secondaryButtonStyle, marginTop: 12 }}>Remove</button>
      </div>)}
    </div>
    <div style={{ ...styles.buttonRowStyle, marginTop: 20 }}><button type="button" onClick={() => setBlocks((current) => [...current, emptyBlock()])} style={styles.secondaryButtonStyle}>Add blocked time</button><button type="button" onClick={save} disabled={saving} style={styles.primaryButtonStyle}>{saving ? 'Saving…' : 'Save schedule'}</button></div>
    {status ? <p role="status" style={styles.bodyStyle}>{status}</p> : null}
  </section>
}
