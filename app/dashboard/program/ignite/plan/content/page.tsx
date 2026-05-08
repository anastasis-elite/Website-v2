'use client'

import { Suspense } from 'react'
import PlanContent from './PlanContent'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div style={{ color: 'white', padding: 40 }}>
          Loading program…
        </div>
      }
    >
      <PlanContent />
    </Suspense>
  )
}
