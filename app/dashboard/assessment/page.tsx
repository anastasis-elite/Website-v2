'use client'

import { useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

function AssessmentIntroContent() {
  const searchParams = useSearchParams()
  const program = searchParams.get('program') || ''

  const programLabel =
    program === 'ember'
      ? 'Ember'
      : program === 'ignite'
        ? 'Ignite'
        : program === 'phoenix'
          ? 'Phoenix'
          : 'your program'

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        {/* keep your existing JSX exactly the same */}
      </div>
    </main>
  )
}

export default function AssessmentIntroPage() {
  return (
    <Suspense fallback={null}>
      <AssessmentIntroContent />
    </Suspense>
  )
}
