'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AOSButton } from '@/components/aos-ui/AOSButton'

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function DayBlockCompletionForm({
  clientId,
  block,
  items,
  initialCompleted = false,
  initialCompletedTasks = [],
  returnHref = '/dashboard',
  logDate,
}: {
  clientId: string
  block: 'morning' | 'midday' | 'evening'
  items: string[]
  initialCompleted?: boolean
  initialCompletedTasks?: string[]
  returnHref?: string
  logDate?: string
}) {
  const router = useRouter()
  const taskIds = useMemo(
    () => items.map((item, index) => `${block}-${slugify(item) || `task-${index + 1}`}`),
    [block, items]
  )
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(taskIds.map((taskId) => [taskId, initialCompleted || initialCompletedTasks.includes(taskId)]))
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    setSaving(true)
    setMessage('')
    const completedTasks = taskIds.filter((taskId) => checked[taskId])
    try {
      const response = await fetch('/api/day-block/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, block, completedTasks, ...(logDate ? {logDate} : {}) }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success !== true) {
        setMessage(payload?.error || 'This block could not be confirmed. Check your connection and retry.')
        return
      }
      setMessage(returnHref.startsWith('/dashboard/schedule') ? 'Saved. Returning to your schedule.' : 'Saved. Returning to dashboard.')
      router.push(returnHref)
      router.refresh()
    } catch {
      setMessage('This block could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="aos-card aos-block-checklist">
      <div className="aos-section-header">
        <div>
          <p className="aos-eyebrow">Block checklist</p>
          <h2>{initialCompleted ? 'Your checklist · completed' : 'Your checklist'}</h2>
        </div>
      </div>

      <div className="aos-checklist-stack">
        {items.map((item, index) => {
          const taskId = taskIds[index]
          return (
            <label key={taskId} className="aos-check-row">
              <input
                type="checkbox"
                checked={Boolean(checked[taskId])}
                onChange={(event) =>
                  setChecked((current) => ({ ...current, [taskId]: event.target.checked }))
                }
              />
              <span>{item}</span>
            </label>
          )
        })}
      </div>

      <AOSButton type="button" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : initialCompleted ? 'Save Updates' : `Complete ${block}`}
      </AOSButton>
      {message ? <p className="aos-status" role="status">{message}</p> : null}
    </section>
  )
}
