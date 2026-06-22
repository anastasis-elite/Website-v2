import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import OnboardingProfileForm from '@/components/OnboardingProfileForm'

export default async function OnboardingProfilePage() {
  const { client } = await getDashboardContext({
    allowIncompleteOnboarding: true,
  })

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Account Setup</p>

        <h1 style={styles.heroTitleStyle}>Complete your profile.</h1>

        <p style={styles.heroTextStyle}>
          Before your dashboard fully opens, we need your birthdate, shipping
          address, and cycle status so your system can personalize safely.
        </p>

        <OnboardingProfileForm client={client} />
      </div>
    </main>
  )
}
