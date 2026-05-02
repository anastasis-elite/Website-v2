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
          Your payment has been processed. Your dashboard access is now being prepared,
          and the next step is completing your assessment so your execution plan can be built correctly.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Before you begin</h2>

          <p style={styles.bodyStyle}>
            The next assessment will ask for current strength inputs. If you want to complete it now,
            be near your weights, gym equipment, or cable machine so your numbers are as accurate as possible.
          </p>

          <p style={styles.bodyStyle}>
            If you’re not ready to test right now, you can explore your dashboard first and come back when you’re prepared.
          </p>

          <div style={styles.buttonRowStyle}>
            <Link
              href={`/dashboard/assessment/start?program=${program}`}
              style={styles.primaryButtonStyle}
            >
              Begin Assessment
            </Link>

            <Link href="/dashboard" style={styles.secondaryButtonStyle}>
              Explore Dashboard
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
