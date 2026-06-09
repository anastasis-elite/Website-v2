import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import AssessmentPhotoUpload from '@/components/AssessmentPhotoUpload'

export default function ProgressPhotosPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Progress Photos</p>

        <h1 style={styles.heroTitleStyle}>
          Upload progress photos.
        </h1>

        <p style={styles.heroTextStyle}>
          These photos are for your private progress tracking inside your
          dashboard. They help you compare visual changes over time without
          relying only on the scale.
        </p>

        <AssessmentPhotoUpload />

        <div style={{ marginTop: '28px' }}>
          <Link href="/dashboard" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
