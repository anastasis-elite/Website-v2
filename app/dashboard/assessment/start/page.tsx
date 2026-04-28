'use client'

import { Suspense } from 'react'
import StartContent from './StartContent'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div style={{ color: 'white', padding: 40 }}>
          Loading assessment…
        </div>
      }
    >
      <StartContent />
    </Suspense>
  )
}
