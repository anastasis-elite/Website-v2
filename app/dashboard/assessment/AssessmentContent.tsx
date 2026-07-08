import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { AOSCard } from '@/components/aos-ui/AOSCard'

export default async function AssessmentContent(){
  const {supabase,client}=await getDashboardContext();const monthly=await getMonthlyAssessmentStatus(supabase,client.client_id)
  const actions=[
    {title:'Daily Check-In',body:'Log sleep, energy, stress, soreness, mood, hunger, cycle status, and symptoms.',href:'/dashboard/check-in',cta:'Check In Today',primary:true},
    ...(monthly.due?[{title:'Monthly Assessment Due',body:'It has been 30 days or this is your first monthly assessment.',href:'/dashboard/assessment/monthly',cta:'Open Monthly Assessment',primary:true}]:[]),
    {title:'Strength Assessment',body:'Update strength and training baselines when your program needs recalibration.',href:'/dashboard/assessment/start',cta:'Open Strength Assessment',primary:false},
    {title:'Measurements',body:'Record consistent physical measurements.',href:'/dashboard/assessment/measurements',cta:'Open Measurements',primary:false},
    {title:'Photos',body:'Upload private progress and assessment photos.',href:'/dashboard/assessment/photos',cta:'Open Photos',primary:false},
  ]
  return <main className="aos-flow-page"><div className="aos-flow-shell"><header className="aos-flow-hero"><p className="aos-eyebrow">Assessments</p><h1>Use the right check-in for the right job.</h1><p>Daily signals guide today. Monthly and strength assessments update the longer plan.</p></header><div className="aos-assessment-grid">{actions.map((action)=><AOSCard key={action.title}><h2 className="aos-card-title">{action.title}</h2><p className="aos-muted-copy">{action.body}</p><Link href={action.href} className={action.primary?'aos-primary-link':'aos-secondary-link'}>{action.cta}</Link></AOSCard>)}</div>{!monthly.due?<AOSCard><h2 className="aos-card-title">Monthly assessment complete</h2><p className="aos-muted-copy">It will return when 30 days have passed.</p></AOSCard>:null}</div></main>
}
