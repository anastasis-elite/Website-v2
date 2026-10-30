import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import CommunityOperations from './CommunityOperations'

export const dynamic = 'force-dynamic'

export default function CommunityAdminPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Admin access</p>
        <h1 style={styles.heroTitleStyle}>Community review and cleanup</h1>
        <p style={styles.heroTextStyle}>
          Review reported posts and prepare Community data cleanup. Preview each batch before confirming a change.
        </p>
        <CommunityOperations />
        <Link href="/aos" style={styles.quietLinkStyle}>Back to Command Center</Link>
      </div>
    </main>
  )
}
