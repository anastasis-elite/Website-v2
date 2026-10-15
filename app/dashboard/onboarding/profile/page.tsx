import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import OnboardingProfileForm from '@/components/OnboardingProfileForm'
import { redirect } from 'next/navigation'
import { isClientOnboardingComplete } from '@/lib/dashboard/isClientOnboardingComplete'

export default async function OnboardingProfilePage() {
  const { client, supabase } = await getDashboardContext({
    allowIncompleteOnboarding: true,
  })
  const [programResult, initialResult, strengthResult] = await Promise.all([
    supabase.from('program_outputs').select('id').eq('client_id', client.client_id).eq('program', client.program).limit(1).maybeSingle(),
    supabase.from('assessments').select('id').eq('client_id', client.client_id).eq('assessment_type', 'initial').limit(1).maybeSingle(),
    supabase.from('assessments').select('id').eq('client_id', client.client_id).eq('assessment_type', 'strength').limit(1).maybeSingle(),
  ])
  if (programResult.error || initialResult.error || strengthResult.error) throw new Error('Saved member setup could not be loaded.')
  const setupStep = programResult.data ? 'dashboard' : strengthResult.data ? 'plan_generation' : initialResult.data ? 'strength_assessment' : 'initial_assessment'
  if (isClientOnboardingComplete(client)) {
    redirect(setupStep === 'initial_assessment' ? '/dashboard/assessment/start'
      : setupStep === 'strength_assessment' ? '/dashboard/assessment/start2'
      : setupStep === 'plan_generation' ? '/dashboard/onboarding/plan'
      : `/dashboard/program/${client.program || 'ignite'}`)
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Account Setup</p>

        <h1 style={styles.heroTitleStyle}>Complete your profile.</h1>

        <p style={styles.heroTextStyle}>
          Save your birthdate, address, preferences, and cycle status. This completes
          your account profile.
        </p>
        {setupStep === 'initial_assessment' ? <p style={styles.bodyStyle}>Next, the member assessment asks about training availability, equipment, goals, limitations, sleep, and recovery. A separate strength baseline then supplies the starting loads for your saved training plan. The brief public Capacity Audit does not replace these steps.</p> : null}
        {setupStep === 'strength_assessment' ? <p style={styles.bodyStyle}>Your first member assessment is saved. Continue to the strength baseline after this profile to create your starting training plan.</p> : null}
        {setupStep === 'dashboard' ? <p style={styles.bodyStyle}>Your earlier training setup is saved. Continue to your dashboard after updating this profile.</p> : null}
        {setupStep === 'plan_generation' ? <p style={styles.bodyStyle}>Your assessments are saved. Continue to create your plan from those records; you do not need to repeat the forms.</p> : null}

        <OnboardingProfileForm client={client} setupStep={setupStep} />
      </div>
    </main>
  )
}
