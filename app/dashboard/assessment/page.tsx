'use client'

import { Suspense } from 'react'
import StartContent from './StartContent'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StartContent />
    </Suspense>
  )
}
