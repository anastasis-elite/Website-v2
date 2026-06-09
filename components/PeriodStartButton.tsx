'use client'

import { useState } from 'react'

type Props = {
  clientId: string
  compact?: boolean
}

export default function PeriodStartButton({ clientId, compact = false }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )

  async function handleClick() {
    try {
      setStatus('saving')

      const res = await fetch('/api/cycle/start-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Could not save cycle start')
      }

      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'saving' || status === 'saved'}
      style={{
        border: '1px solid rgba(181,110,67,0.32)',
        color: '#f5f0e8',
        padding: compact ? '9px 12px' : '13px 18px',
        borderRadius: '999px',
        fontWeight: 500,
        background:
          status === 'saved'
            ? 'rgba(181,110,67,0.24)'
            : 'rgba(181,110,67,0.12)',
        fontSize: compact ? '0.78rem' : '0.92rem',
        cursor: status === 'saved' ? 'default' : 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {status === 'saving'
        ? 'Saving...'
        : status === 'saved'
          ? 'Cycle Day 1 Saved'
          : status === 'error'
            ? 'Try Again'
            : 'Period Started Today'}
    </button>
  )
}
