import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import GenerateSavedPlan from '@/components/GenerateSavedPlan'
import { getSavedPlanState } from '@/lib/program/getSavedPlanState'
import * as styles from '@/app/styles/globalstyles'

export default async function SavedPlanSetupPage() {
  const { supabase, client, user } = await getDashboardContext()
  const [plan, strength] = await Promise.all([
    supabase.from('program_outputs').select('id,program,program_json').eq('client_id', client.client_id).eq('program', client.program).or(`auth_user_id.eq.${user.id},auth_user_id.is.null`).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('assessments').select('id').eq('client_id', client.client_id).eq('assessment_type', 'strength').limit(1).maybeSingle(),
  ])
  if (plan.error || strength.error) throw new Error('Your saved setup could not be loaded. Please try again.')
  const planState = getSavedPlanState(plan.data)
  if (planState.status === 'ready') redirect(`/dashboard/program/${client.program}`)
  if (!strength.data) redirect('/dashboard/assessment/start')
  const repair = planState.status === 'incomplete'
  return <main style={styles.pageStyle}><div style={styles.containerStyle}><p style={styles.eyebrowStyle}>{repair ? 'Saved Plan Review' : 'Member Setup'}</p><h1 style={styles.heroTitleStyle}>{repair ? 'Your saved plan needs a repair.' : 'Your assessments are saved.'}</h1><p style={styles.bodyStyle}>{repair ? 'Your plan has an unavailable training day. Recheck your saved assessments and equipment to create a usable replacement. Your prior plans and completed workout history stay saved. Nothing changes until you choose repair and saving succeeds.' : 'Create your starting training plan from your recorded assessments. If saving failed earlier, this retries plan creation without asking you to repeat the forms. Any safety signal still pauses generation.'}</p>{repair ? <p style={styles.bodyStyle}><Link href="/dashboard/account" style={styles.quietLinkStyle}>Review recorded equipment</Link></p> : null}<GenerateSavedPlan clientId={client.client_id} program={client.program} repairOutputId={repair ? plan.data?.id : undefined} /></div></main>
}
