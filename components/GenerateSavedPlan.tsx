'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'

export default function GenerateSavedPlan({ clientId, program, repairOutputId }: { clientId: string; program: string; repairOutputId?: string }) {
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
      const response = await fetch('/api/program/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, ...(repairOutputId ? { repair_output_id: repairOutputId } : {}) }) })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.success !== true || !result.savedProgram?.id) throw new Error(result?.error || 'Your plan could not be saved. Your assessments remain saved; try again.')
      router.push(`/dashboard/program/${encodeURIComponent(program)}`)
      router.refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your plan could not be saved. Try again.')
    } finally {
      locked.current = false
      setSaving(false)
    }
  }
  return <div aria-busy={saving}><button type="button" disabled={saving} onClick={generate} style={styles.primaryButtonStyle}>{saving ? repairOutputId ? 'Repairing your saved plan…' : 'Creating your plan…' : repairOutputId ? 'Repair Plan From Saved Assessments' : 'Create Plan From Saved Assessments'}</button>{saving ? <p role="status" style={styles.bodyStyle}>Checking your saved assessments and available equipment. Keep this page open until saving is confirmed.</p> : null}{error ? <p role="alert" style={styles.bodyStyle}>{error}</p> : null}</div>
}
