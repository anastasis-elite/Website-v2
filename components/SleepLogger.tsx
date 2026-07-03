'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSInput } from '@/components/aos-ui/AOSInput'
import { AOSSlider } from '@/components/aos-ui/AOSSlider'

export default function SleepLogger({clientId,initial}:{clientId:string;initial:{duration:number;quality:number;bedtime:string;wakeTime:string;notes:string}}){
  const router=useRouter();const [values,setValues]=useState(initial);const [saving,setSaving]=useState(false);const [message,setMessage]=useState('')
  async function save(event:React.FormEvent){event.preventDefault();setSaving(true);setMessage('');const response=await fetch('/api/sleep',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,durationHours:values.duration,quality:values.quality,bedtime:values.bedtime,wakeTime:values.wakeTime,notes:values.notes})});const payload=await response.json();setSaving(false);if(!response.ok){setMessage(payload.error||'Sleep could not be saved.');return}setMessage('Sleep saved. Recovery and today’s plan are updating.');router.refresh()}
  return <form className="aos-card aos-sleep-form" onSubmit={save}><div className="aos-slider-grid"><AOSSlider label="Sleep duration" value={values.duration} min={0} max={12} step={.25} suffix=" hours" onChange={(duration)=>setValues((current)=>({...current,duration}))}/><AOSSlider label="Sleep quality" value={values.quality} min={1} max={10} suffix="/10" onChange={(quality)=>setValues((current)=>({...current,quality}))}/></div><div className="aos-time-grid"><AOSInput label="Bedtime" type="time" value={values.bedtime} onChange={(event)=>setValues((current)=>({...current,bedtime:event.target.value}))}/><AOSInput label="Wake time" type="time" value={values.wakeTime} onChange={(event)=>setValues((current)=>({...current,wakeTime:event.target.value}))}/></div><AOSInput multiline label="Sleep notes" rows={3} placeholder="Optional: interruptions, restlessness, or anything unusual." value={values.notes} onChange={(event)=>setValues((current)=>({...current,notes:event.target.value}))}/><AOSButton type="submit" disabled={saving}>{saving?'Saving…':'Save Sleep'}</AOSButton>{message?<p className="aos-status" role="status">{message}</p>:null}</form>
}
