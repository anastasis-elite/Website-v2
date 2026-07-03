'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'
import SymptomLogger from '@/components/SymptomLogger'

type Values = { sleepHours:number; sleepQuality:number; stress:number; soreness:number; energy:number; mood:number; hunger:number; notes:string; periodStarted:boolean }

export default function DailyCheckInForm({ clientId, program, initial, cycleTrackingEnabled }: { clientId:string; program:string; initial:Partial<Values>; cycleTrackingEnabled:boolean }) {
  const router = useRouter()
  const [values,setValues] = useState<Values>({sleepHours:initial.sleepHours ?? 7,sleepQuality:initial.sleepQuality ?? 5,stress:initial.stress ?? 5,soreness:initial.soreness ?? 5,energy:initial.energy ?? 5,mood:initial.mood ?? 5,hunger:initial.hunger ?? 5,notes:initial.notes ?? '',periodStarted:false})
  const [saving,setSaving] = useState(false)
  const [message,setMessage] = useState('')
  const slider = (key:keyof Values,label:string) => <label style={styles.fieldWrap}><span style={styles.labelStyle}>{label}: <strong>{String(values[key])}{key==='sleepHours'?' hours':'/10'}</strong></span><input type="range" min={key==='sleepHours'?0:1} max={key==='sleepHours'?12:10} step={key==='sleepHours'?0.5:1} value={Number(values[key])} onChange={(event)=>setValues((current)=>({...current,[key]:Number(event.target.value)}))}/></label>

  async function save(event:React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/daily-check-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,...values})})
      const payload = await response.json()
      if(!response.ok){setMessage(payload.error||'Check-in could not be saved.');return}
      setMessage('Saved. Today’s recommendations are updating.')
      router.push(`/dashboard/program/${program}`); router.refresh()
    } catch {
      setMessage('Check-in could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="daily-check-in-layout"><form onSubmit={save} style={styles.cartBoxStyle}><p style={styles.eyebrowStyle}>Today&apos;s signals</p><h2 style={styles.sectionTitleStyle}>How are you, actually?</h2><div style={styles.gridTwoCol}>{slider('sleepHours','Sleep duration')}{slider('sleepQuality','Sleep quality')}{slider('energy','Energy')}{slider('stress','Stress')}{slider('soreness','Soreness')}{slider('mood','Mood')}{slider('hunger','Hunger')}</div>{cycleTrackingEnabled?<label style={{...styles.labelStyle,display:'flex',gap:12,alignItems:'center',marginTop:20}}><input type="checkbox" checked={values.periodStarted} onChange={(event)=>setValues((current)=>({...current,periodStarted:event.target.checked}))}/> My period started today</label>:null}<label style={{...styles.labelStyle,display:'grid',gap:10,marginTop:20}}>Optional notes<textarea style={styles.textareaStyle} value={values.notes} onChange={(event)=>setValues((current)=>({...current,notes:event.target.value}))}/></label><button type="submit" disabled={saving} style={{...styles.primaryButtonStyle,marginTop:22}}>{saving?'Saving…':'Save Daily Check-In'}</button>{message?<p style={styles.bodyStyle} role="status">{message}</p>:null}</form><div><p style={styles.eyebrowStyle}>Symptoms</p><h2 style={styles.sectionTitleStyle}>Add any body signal.</h2><p style={styles.bodyStyle}>Optional. Tap the body only when something needs to be logged.</p><SymptomLogger clientId={clientId}/></div></div>
}
