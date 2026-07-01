import * as styles from '@/app/styles/globalstyles'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import AccountProfileForm from '@/components/AccountProfileForm'
import Link from 'next/link'

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

        <section style={{ ...styles.cartBoxStyle, marginTop: '28px' }}>
          <p style={styles.eyebrowStyle}>Daily Structure</p>
          <h2 style={styles.sectionTitleStyle}>Choose how the dashboard supports your day.</h2>
          <p style={styles.bodyStyle}>Update your timing, fixed commitments, and whether you want sections or one next step at a time.</p>
          <Link href="/dashboard/assessment/daily-structure" style={styles.primaryButtonStyle}>Update Daily Structure</Link>
        </section>
      </div>
    </main>
  )
}
