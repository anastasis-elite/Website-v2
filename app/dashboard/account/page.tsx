import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import AccountProfileForm from '@/components/AccountProfileForm'

export default async function AccountPage() {
  const { client, user } = await getDashboardContext()

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Account</p>

        <h1 style={styles.heroTitleStyle}>Your profile settings.</h1>

        <p style={styles.heroTextStyle}>
          Manage your account details, password, and future upload areas.
        </p>

        <AccountProfileForm client={client} user={user} />
      </div>
    </main>
  )
}
