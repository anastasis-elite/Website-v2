'use client'

import { Suspense } from 'react'
import SignupContent from './SignupContent'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  )
}
