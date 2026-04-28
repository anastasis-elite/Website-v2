'use client'

import { Suspense } from 'react'
import Start2Content from './Start2Content'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Start2Content />
    </Suspense>
  )
}
