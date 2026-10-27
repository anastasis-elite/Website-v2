import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getClientLocalDate } from '@/lib/timezone'
import { dayBlockLabels, isDayBlockDate, scheduleDayHref, type DayBlock } from '@/lib/day/dayBlockRoutes'
import DayBlockCompletionForm from '@/components/DayBlockCompletionForm'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/detail-screens.css'
import '@/components/phone-app/day-blocks.css'

export default async function DayBlockPage({params,searchParams}:{params:Promise<{block:string}>;searchParams:Promise<{date?:string|string[]}>}) {
  const [{block:rawBlock},query]=await Promise.all([params,searchParams])
  if(!Object.prototype.hasOwnProperty.call(dayBlockLabels,rawBlock))notFound()
  const block=rawBlock as DayBlock
  const {supabase,client}=await getDashboardContext(),today=getClientLocalDate(client)
  if(query.date!==undefined&&!isDayBlockDate(query.date))notFound()
  const date=query.date||today,backHref=scheduleDayHref(date)
  const frame={backHref,backLabel:'Schedule',eyebrow:'Today’s intake',title:dayBlockLabels[block],subtitle:date}
  // Existing logging and personalized block calculations are for today only.
  // Do not relabel today's live targets as a historical/future day's plan.
  if(date!==today)return <div className="day-block-page" data-block={block}><PhoneAppFrame {...frame}><main className="day-block-content"><section className="detail-panel"><h2>Day-block details are available for today.</h2><p>Your selected schedule date is {date}. Historical and future block targets and checklists are unavailable here.</p><Link className="detail-action" href={backHref}>Back to this schedule day</Link><Link className="day-block-secondary" href={scheduleDayHref(today)}>Open today’s schedule</Link></section></main></PhoneAppFrame></div>
  const [dailyPlan,{data:recoveryLog,error}]=await Promise.all([
    getDailyExecutionPlan({supabase,client}),
    supabase.from('recovery_logs').select('daily_tasks').eq('client_id',client.client_id).eq('log_date',date).maybeSingle(),
  ])
  const card=dailyPlan.cards.find(item=>item.id===block)
  if(!card)notFound()
  const completedTasks=Array.isArray(recoveryLog?.daily_tasks)?recoveryLog.daily_tasks:[]
  const blockComplete=completedTasks.includes(`${block}-complete`)
  const targets=[['Protein',card.macroTarget?.protein,'g','◇'],['Carbs',card.macroTarget?.carbs,'g','♧'],['Fats',card.macroTarget?.fats,'g','◈'],['Water',card.macroTarget?.water,'oz','◊']] as const
  return <div className="day-block-page" data-block={block}><PhoneAppFrame {...frame} title={card.title}><main className="day-block-content">
    <section className="detail-panel day-block-focus"><span className="day-block-focus-symbol" aria-hidden="true">{block==='morning'?'❧':block==='midday'?'◎':'☾'}</span><div><h2>Your focus</h2><p>{card.body}</p><div className="day-block-timing"><span aria-hidden="true">◷</span><div><strong>Timing</strong><p>{card.timing}</p></div></div></div></section>
    <section className="day-block-targets" aria-label="Personalized block targets">{targets.map(([label,value,unit,symbol])=><div key={label}><span aria-hidden="true">{symbol}</span><div><h2>{label}</h2><p>{typeof value==='number'&&Number.isFinite(value)?value:'—'} <small>{unit}</small></p></div></div>)}</section>
    {block==='midday'?<Link className="day-block-tool" href={`/dashboard/program/${client.program||'ignite'}/workout`}><span aria-hidden="true">◇</span><span><strong>Training</strong><small>Open Workout</small></span><b aria-hidden="true">›</b></Link>:null}
    {block==='evening'?<Link className="day-block-tool" href="/dashboard/check-in"><span aria-hidden="true">▤</span><span><strong>Close the day</strong><small>Evening Check-In</small></span><b aria-hidden="true">›</b></Link>:null}
    {error?<section className="detail-panel"><p role="status">Your saved checklist could not be loaded. Refresh before completing this block.</p><Link href={backHref}>Back to schedule</Link></section>:<DayBlockCompletionForm key={`${date}:${block}`} clientId={client.client_id} block={block} items={card.items||[]} initialCompleted={blockComplete} initialCompletedTasks={completedTasks} logDate={date} returnHref={backHref}/>}
    <Link className="day-block-secondary" href={backHref}>Back to Schedule</Link>
  </main></PhoneAppFrame></div>
}
