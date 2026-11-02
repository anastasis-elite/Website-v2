'use client'

import { useLayoutEffect } from 'react'
import { acquireStrengthHistoryGuard } from '@/lib/assessments/strengthHistoryGuard'

export default function StrengthHistoryGuardRoot() {
  useLayoutEffect(acquireStrengthHistoryGuard, [])
  return null
}
