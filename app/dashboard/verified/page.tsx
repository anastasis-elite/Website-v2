'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

function VerifiedContent() {
  const searchParams = useSearchParams()
  const program = searchParams.get('program') || ''

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Payment Verified</p>

        <h1 style={styles.heroTitleStyle}>You’re in.</h1>

        <p style={styles.heroTextStyle}>
          Your payment has been processed. The next step is creating your private
          login so your assessment, program, and progress can stay connected to
          your account.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Your next step</h2>

          <p style={styles.bodyStyle}>
            Create your private login first. Once your account is connected, your
            assessment and dashboard will stay tied to your client profile.
          </p>

          <div style={styles.buttonRowStyle}>
            <Link
  href={`/create-login?program=${program}&email=${email}&client_id=${client_id}&birthdate=${birthdate}`}
  style={styles.primaryButtonStyle}
>
  Continue
</Link>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function VerifiedPage() {
  return (
    <Suspense fallback={null}>
      <VerifiedContent />
    </Suspense>
  )
}
