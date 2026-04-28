'use client'

import { useSearchParams } from 'next/navigation'
import * as styles from '../../styles/globalstyles'

export default function StartContent() {
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
        {/* your existing content */}
      </div>
    </main>
  )
}
