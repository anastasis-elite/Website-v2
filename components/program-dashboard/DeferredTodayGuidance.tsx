'use client'

import { useEffect, useState } from 'react'
import type GuidedToday from './GuidedToday'

type Props = Parameters<typeof GuidedToday>[0]

export default function DeferredTodayGuidance(props: Props) {
  const [Guidance, setGuidance] = useState<typeof GuidedToday | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let disposed = false
    setFailed(false)
    // This import begins only after accurate enrichment mounts this section.
    // Catch download failures here so the verified day stays usable, and retry
    // the import rather than caching a rejected React.lazy component.
    void import('./GuidedToday').then(module => {
      if (!disposed) setGuidance(() => module.default)
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true }
  }, [attempt])
  if (Guidance) return <Guidance {...props} />
  return <div role="status">{failed ? <>
    <p>Additional guidance could not be downloaded. Your verified day is still available.</p>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry guidance download</button>
  </> : <p>Opening your current guidance…</p>}</div>
}
