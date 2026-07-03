import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'

export default async function AssessmentContent(){
  const {supabase,client}=await getDashboardContext();const monthly=await getMonthlyAssessmentStatus(supabase,client.client_id)
  const actions=[
    {title:'Daily Check-In',body:'Log sleep, energy, stress, soreness, mood, hunger, cycle status, and symptoms.',href:'/dashboard/check-in',cta:'Check In Today',primary:true},
    ...(monthly.due?[{title:'Monthly Assessment Due',body:'It has been 30 days or this is your first monthly assessment.',href:'/dashboard/assessment/monthly',cta:'Open Monthly Assessment',primary:true}]:[]),
    {title:'Strength Assessment',body:'Update strength and training baselines when your program needs recalibration.',href:'/dashboard/assessment/start',cta:'Open Strength Assessment',primary:false},
    {title:'Measurements',body:'Record consistent physical measurements.',href:'/dashboard/assessment/measurements',cta:'Open Measurements',primary:false},
    {title:'Photos',body:'Upload private progress and assessment photos.',href:'/dashboard/assessment/photos',cta:'Open Photos',primary:false},
  ]
  return <main style={styles.pageStyle}><div style={styles.containerStyle}><p style={styles.eyebrowStyle}>Assessments</p><h1 style={styles.heroTitleStyle}>Use the right check-in for the right job.</h1><p style={styles.heroTextStyle}>Daily signals guide today. Monthly and strength assessments update the longer plan.</p><div style={styles.cardGridStyle}>{actions.map((action)=><section key={action.title} style={styles.cartBoxStyle}><h2 style={styles.sectionTitleStyle}>{action.title}</h2><p style={styles.bodyStyle}>{action.body}</p><Link href={action.href} style={action.primary?styles.primaryButtonStyle:styles.secondaryButtonStyle}>{action.cta}</Link></section>)}</div>{!monthly.due?<section style={styles.cartBoxStyle}><h2 style={styles.sectionTitleStyle}>Monthly assessment complete</h2><p style={styles.bodyStyle}>It will return when 30 days have passed.</p></section>:null}</div></main>
}
