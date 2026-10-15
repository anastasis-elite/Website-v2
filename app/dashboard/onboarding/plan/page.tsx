import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import GenerateSavedPlan from '@/components/GenerateSavedPlan'
import * as styles from '@/app/styles/globalstyles'

export default async function SavedPlanSetupPage() {
  const { supabase, client } = await getDashboardContext()
  const [plan, strength] = await Promise.all([
    supabase.from('program_outputs').select('id').eq('client_id', client.client_id).eq('program', client.program).limit(1).maybeSingle(),
    supabase.from('assessments').select('id').eq('client_id', client.client_id).eq('assessment_type', 'strength').limit(1).maybeSingle(),
  ])
  if (plan.error || strength.error) throw new Error('Your saved setup could not be loaded. Please try again.')
  if (plan.data) redirect(`/dashboard/program/${client.program}`)
  if (!strength.data) redirect('/dashboard/assessment/start')
  return <main style={styles.pageStyle}><div style={styles.containerStyle}><p style={styles.eyebrowStyle}>Member Setup</p><h1 style={styles.heroTitleStyle}>Your assessments are saved.</h1><p style={styles.bodyStyle}>Create your starting training plan from your recorded assessments. If saving failed earlier, this retries plan creation without asking you to repeat the forms. Any safety signal still pauses generation.</p><GenerateSavedPlan clientId={client.client_id} program={client.program} /></div></main>
}
