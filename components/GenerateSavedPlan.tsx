'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'

export default function GenerateSavedPlan({ clientId, program }: { clientId: string; program: string }) {
  const router = useRouter()
  const locked = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function generate() {
    if (locked.current) return
    locked.current = true
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/program/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Your plan could not be saved. Your assessments remain saved; try again.')
      router.push(`/dashboard/program/${encodeURIComponent(program)}`)
      router.refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your plan could not be saved. Try again.')
    } finally {
      locked.current = false
      setSaving(false)
    }
  }
  return <><button type="button" disabled={saving} onClick={generate} style={styles.primaryButtonStyle}>{saving ? 'Creating your plan…' : 'Create Plan From Saved Assessments'}</button>{error ? <p role="alert" style={styles.bodyStyle}>{error}</p> : null}</>
}
