'use client'

import { useEffect, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

const options = ['Full rest', 'Gentle walk', 'Mobility', 'Breathwork', 'Meditation', 'Warm soak']

export default function RecoveryLogger({ clientId }: { clientId: string }) {
  const [selected, setSelected] = useState('')
  const [minutes, setMinutes] = useState(20)
  const [saved, setSaved] = useState(false)
  const storageKey = `recovery-log:${clientId}:${new Date().toISOString().slice(0, 10)}`

  useEffect(() => {
    const existing = window.localStorage.getItem(storageKey)
    if (!existing) return
    const parsed = JSON.parse(existing)
    setSelected(parsed.type || '')
    setMinutes(parsed.minutes || 20)
    setSaved(true)
  }, [storageKey])

  function save() {
    if (!selected) return
    window.localStorage.setItem(storageKey, JSON.stringify({ type: selected, minutes, loggedAt: new Date().toISOString(), pendingSync: true }))
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
      <button type="button" disabled={!selected} onClick={save} style={{ ...styles.primaryButtonStyle, marginTop: '26px' }}>Save Recovery</button>
      {saved ? <p style={{ ...styles.bodyStyle, marginTop: '18px' }}>Recovery saved for today. Database sync will activate when the recovery table is connected.</p> : null}
    </section>
  )
}
