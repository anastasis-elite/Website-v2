'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSInput } from '@/components/aos-ui/AOSInput'
import { calculateSleepHours } from '@/lib/sleep/calculateSleepHours'

type SleepValues = {duration:number|'';quality:number|'';bedtime:string;wakeTime:string;notes:string}
export default function SleepLogger({clientId,initial}:{clientId:string;initial:SleepValues}) {
  const router=useRouter(),lock=useRef(false)
  const [values,setValues]=useState(initial),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
  async function save(event:React.FormEvent) {
    event.preventDefault()
    if(lock.current)return
    if(values.duration===''||values.quality===''){setMessage('Enter sleep duration and choose your sleep quality before saving.');return}
    lock.current=true;setSaving(true);setMessage('')
    try {
      const response=await fetch('/api/sleep',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,durationHours:values.duration,quality:values.quality,bedtime:values.bedtime,wakeTime:values.wakeTime,notes:values.notes})})
      const payload=await response.json().catch(()=>null)
      if(!response.ok||payload?.success!==true)throw new Error(payload?.error||'Sleep could not be confirmed. Check your connection and retry.')
      setMessage('Sleep saved. Review today’s plan.');router.refresh()
    }catch(error){setMessage(error instanceof Error?error.message:'Sleep could not be saved. Check your connection and retry.')}finally{lock.current=false;setSaving(false)}
  }
  function updateTime(key:'bedtime'|'wakeTime',value:string){setValues(current=>{const next={...current,[key]:value};return {...next,duration:calculateSleepHours(next.bedtime,next.wakeTime)??next.duration}})}
  return <form className="aos-card aos-sleep-form" onSubmit={save} aria-busy={saving}><h2>Last night</h2>
    {(!values.bedtime||!values.wakeTime)?<p className="detail-note">{!values.bedtime?'Bedtime is not recorded. ':''}{!values.wakeTime?'Wake time is not recorded.':''}</p>:null}
    <div className="aos-time-grid"><AOSInput label="Bedtime" type="time" value={values.bedtime} onChange={event=>updateTime('bedtime',event.target.value)}/><AOSInput label="Wake time" type="time" value={values.wakeTime} onChange={event=>updateTime('wakeTime',event.target.value)}/></div>
    <AOSInput label="Duration (hours)" type="number" min="0" max="24" step="0.25" required value={values.duration} onChange={event=>setValues(current=>({...current,duration:event.target.value===''?'':Number(event.target.value)}))}/>
    <small className="detail-note">Calculated from bedtime and wake time when both are entered.</small>
    <label className="aos-slider"><span><span>Sleep quality</span><strong>{values.quality===''?'Not recorded':`${values.quality}/10`}</strong></span><input type="range" onPointerUp={event=>setValues(current=>({...current,quality:Number(event.currentTarget.value)}))} min="1" max="10" value={values.quality===''?5:values.quality} onChange={event=>setValues(current=>({...current,quality:Number(event.target.value)}))}/></label>
    <AOSInput multiline label="Notes (optional)" rows={3} value={values.notes} onChange={event=>setValues(current=>({...current,notes:event.target.value}))}/>
    <AOSButton type="submit" disabled={saving}>{saving?'Saving…':'Save Sleep'}</AOSButton>{message?<p className="aos-status" role="status">{message}</p>:null}
  </form>
}
