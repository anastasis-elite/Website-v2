'use client'

import { Suspense } from 'react'
import StartContent from './AssessmentContent'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StartContent />
    </Suspense>
  )
}
