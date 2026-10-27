'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const practices={
  'breath-reset':{title:'Breath Reset',seconds:120,copy:'Two minutes to slow the pace and return to the next clear step.',icon:'❀'},
  'calm-reset':{title:'Calm Reset',seconds:300,copy:'A gentle reset for a crowded day.',icon:'≋'},
  'sleep-wind-down':{title:'Sleep Wind Down',seconds:600,copy:'Lower the pace and prepare for sleep.',icon:'☾'},
  'recovery-meditation':{title:'Recovery Meditation',seconds:480,copy:'Make space for recovery without another task.',icon:'♧'},
} as const

export default function MeditationPractice({clientId,initialPractice}:{clientId:string;initialPractice:string}) {
  const router=useRouter(),lock=useRef(false),key=(initialPractice in practices?initialPractice:'breath-reset') as keyof typeof practices
  const [practice,setPractice]=useState<keyof typeof practices>(key),[remaining,setRemaining]=useState<number>(practices[key].seconds)
  const [running,setRunning]=useState(false),[started,setStarted]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[message,setMessage]=useState('')
  const current=practices[practice],elapsed=current.seconds-remaining
  useEffect(()=>{if(!running||remaining<=0)return;const timer=window.setInterval(()=>setRemaining(value=>Math.max(0,value-1)),1000);return()=>window.clearInterval(timer)},[running,remaining])
  function choose(next:keyof typeof practices){if(saving)return;setPractice(next);setRemaining(practices[next].seconds);setRunning(false);setStarted(false);setSaved(false);setMessage('')}
  async function complete(){
    if(lock.current||saved||elapsed<120)return
    lock.current=true;setRunning(false);setSaving(true);setMessage('')
    try {
      const response=await fetch('/api/recovery/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,activityType:practice==='breath-reset'?'Breathwork':'Meditation',minutes:Math.floor(elapsed/60)})})
      const payload=await response.json().catch(()=>null)
      if(!response.ok||payload?.success!==true)throw new Error(payload?.error||'Your practice could not be confirmed. Check your connection and retry.')
      setSaved(true);setMessage('Practice logged.');router.refresh()
    }catch(error){setMessage(error instanceof Error?error.message:'Your practice could not be saved. Retry when connected.')}finally{lock.current=false;setSaving(false)}
  }
  const phase=Math.floor(elapsed/4)%2===0?'Inhale':'Exhale'
  return <div className="meditation-practice">
    {!started?<><nav className="meditation-options" aria-label="Meditation types">{(Object.keys(practices) as Array<keyof typeof practices>).map(item=><button type="button" key={item} aria-pressed={item===practice} onClick={()=>choose(item)}><span className="detail-symbol" aria-hidden="true">{practices[item].icon}</span><span><strong>{practices[item].title}</strong><small>{practices[item].copy}</small></span><span className="meditation-duration">{practices[item].seconds/60} min</span></button>)}</nav><button className="detail-action" type="button" onClick={()=>{setStarted(true);setRunning(true)}}>Start practice</button></>:<section className="detail-panel meditation-timer-panel">
      <h2>{current.title}</h2><p>{current.seconds/60}-minute practice</p>
      <div className={`meditation-orbit${running&&remaining>0?' is-running':''}`}><span>{running&&remaining>0?phase:remaining===0?'Finished':'Paused'}</span></div>
      <strong className="meditation-timer" role="timer" aria-label="Time remaining">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong>
      <p>Follow the gentle rhythm. Breathe comfortably.</p>
      <div className="meditation-controls"><button type="button" disabled={saving||saved||remaining===0} onClick={()=>setRunning(value=>!value)}>{running?'Pause':'Continue'}</button><button type="button" disabled={saving} onClick={()=>{setRunning(false);setRemaining(current.seconds);setSaved(false);setMessage('')}}>Reset</button><button type="button" disabled={saving||saved||elapsed<120} onClick={complete}>{saving?'Saving…':saved?'Logged':'Complete'}</button></div>
      {elapsed<120?<p className="detail-note">Logging opens after two minutes of practice.</p>:null}
      <button type="button" className="detail-action" disabled={saving} onClick={()=>choose(practice)}>Choose another practice</button>
    </section>}
    <small className="detail-note">Silent timer and visual breathing prompts. Guided audio is unavailable.</small>
    {message?<p role="status">{message}</p>:null}
  </div>
}
