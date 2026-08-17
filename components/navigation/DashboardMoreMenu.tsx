'use client'

import Link from 'next/link'
import { useEffect,useRef,useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardMoreMenu({program}:{program:'ember'|'ignite'|'phoenix'}){
  const router=useRouter();const ref=useRef<HTMLDivElement|null>(null);const [open,setOpen]=useState(false);const [loggingOut,setLoggingOut]=useState(false)
  useEffect(()=>{if(!open)return;const outside=(event:MouseEvent|TouchEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('mousedown',outside);document.addEventListener('touchstart',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('touchstart',outside);document.removeEventListener('keydown',escape)}},[open])
  const items=[['Schedule','/dashboard/schedule'],['Account','/dashboard/account'],['Monthly Assessment','/dashboard/assessment/monthly'],...(program==='phoenix'?[['Recipes','/dashboard/nutrition#phoenix-recipes']]:[]),['Help & Support','mailto:Anastasis.elite@gmail.com?subject=Account%20Support']] as string[][]
  async function logout(){setLoggingOut(true);await fetch('/api/auth/logout',{method:'POST'});router.replace('/login');router.refresh()}
  return <div ref={ref} className="dashboard-more-menu"><button type="button" className="dashboard-more-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen((value)=>!value)}><span aria-hidden="true">•••</span>More</button>{open?<div className="dashboard-more-backdrop" onClick={()=>setOpen(false)}><div className="dashboard-more-sheet" role="dialog" aria-modal="true" aria-label="More options" onClick={(event)=>event.stopPropagation()}><div className="dashboard-more-heading"><div><small>{program}</small><h2>More</h2></div><button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Close more menu">×</button></div><nav>{items.map(([label,href])=>href.startsWith('mailto:')?<a key={label} href={href} onClick={()=>setOpen(false)}>{label}<span>›</span></a>:<Link key={label} href={href} onClick={()=>setOpen(false)}>{label}<span>›</span></Link>)}</nav><button type="button" className="dashboard-more-logout" disabled={loggingOut} onClick={logout}>{loggingOut?'Signing Out…':'Log Out'}</button></div></div>:null}</div>
}
