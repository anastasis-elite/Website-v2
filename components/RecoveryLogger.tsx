'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

const options = ['Full rest', 'Gentle walk', 'Mobility', 'Breathwork', 'Meditation', 'Warm soak']

export default function RecoveryLogger({ clientId }: { clientId: string }) {
  const [selected, setSelected] = useState('')
  const [minutes, setMinutes] = useState(20)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!selected) return
    setSaving(true);setError('')
    const response=await fetch('/api/recovery/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,activityType:selected,minutes})})
    const payload=await response.json();setSaving(false)
    if(!response.ok){setError(payload.error||'Recovery could not be saved.');return}
    setSaved(true)
  }

  return (
    <section style={styles.cartBoxStyle}>
      <p style={styles.eyebrowStyle}>Log Recovery</p>
      <h2 style={styles.sectionTitleStyle}>What can your body receive?</h2>
      <div style={styles.buttonRowStyle}>
        {options.map((option) => (
          <button key={option} type="button" onClick={() => { setSelected(option); setSaved(false) }} style={selected === option ? styles.primaryButtonStyle : styles.secondaryButtonStyle}>{option}</button>
        ))}
      </div>
      {selected && selected !== 'Full rest' ? (
        <label style={{ display: 'grid', gap: '12px', marginTop: '26px' }}>
          <span style={styles.labelStyle}>Duration: <strong>{minutes} minutes</strong></span>
          <input type="range" min="5" max="90" step="5" value={minutes} onChange={(event) => { setMinutes(Number(event.target.value)); setSaved(false) }} />
        </label>
      ) : null}
      <button type="button" disabled={!selected||saving} onClick={save} style={{ ...styles.primaryButtonStyle, marginTop: '26px' }}>{saving?'Saving…':'Save Recovery'}</button>
      {saved ? <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>Recovery saved for today.</p> : null}
      {error ? <p style={{ ...styles.bodyStyle, marginTop: '18px' }} role="alert">{error}</p> : null}
    </section>
  )
}
