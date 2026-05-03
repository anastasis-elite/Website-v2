'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

function PaymentIssueContent() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || 'ember'

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Access Not Verified</p>

        <h1 style={styles.heroTitleStyle}>
          We couldn’t verify your payment yet.
        </h1>

        <p style={styles.heroTextStyle}>
          Your dashboard access is protected until your payment is successfully confirmed.
          This may be a temporary issue, or your checkout may not have completed.
        </p>

        <section style={styles.sectionStyle}>
          <h2 style={styles.sectionTitleStyle}>Next steps</h2>

          <div style={styles.bodyStyle}>
            <p>If your payment did not complete, return to checkout and try again.</p>
            <p>If you already paid, contact Anastasis Elite so we can help verify your access.</p>
          </div>
        </section>

        <div style={styles.buttonRowStyle}>
          <a
            href={`/program/${program}`}
            style={styles.primaryButtonStyle}
          >
            Return to Checkout
          </a>

          <a
            href="mailto:Anastasis.elite@gmail.com?subject=Payment%20Verification%20Issue"
            style={styles.secondaryButtonStyle}
          >
            Email Support
          </a>
        </div>
      </div>
    </main>
  )
}

export default function PaymentIssuePage() {
  return (
    <Suspense fallback={null}>
      <PaymentIssueContent />
    </Suspense>
  )
}
