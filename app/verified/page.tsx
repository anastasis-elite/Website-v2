import Link from 'next/link'
import * as styles from '../styles/globalstyles'

type Props = {
  searchParams?: {
    session_id?: string
    program?: string
    client_id?: string
    clientId?: string
    email?: string
    birthdate?: string
  }
}

export default function VerifiedPage({ searchParams }: Props) {
  const program = searchParams?.program || ''
  const clientId = searchParams?.client_id || searchParams?.clientId || ''
  const email = searchParams?.email || ''
  const birthdate = searchParams?.birthdate || ''

  const createLoginHref = `/create-login?program=${encodeURIComponent(
    program
  )}&client_id=${encodeURIComponent(clientId)}&email=${encodeURIComponent(
    email
  )}&birthdate=${encodeURIComponent(birthdate)}`

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Payment Verified</p>

        <h1 style={styles.heroTitleStyle}>You’re in.</h1>

        <p style={styles.heroTextStyle}>
          Your payment has been processed. The next step is creating your private
          login so your assessment, program, and progress stay securely connected
          to your account.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Your next step</h2>

          <p style={styles.bodyStyle}>
            Create your private login first. Once your account is connected,
            your dashboard, assessments, and program data will automatically stay
            linked to your client profile.
          </p>

          <div style={styles.buttonRowStyle}>
            <Link href={createLoginHref} style={styles.primaryButtonStyle}>
              Create Your Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
