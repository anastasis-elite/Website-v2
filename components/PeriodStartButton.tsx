'use client'

import { useState } from 'react'
import { AOSButton } from '@/components/aos-ui/AOSButton'

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
  throw new Error(data?.error || data?.details || 'Could not save cycle start')
}

      setStatus('saved')
    } catch (error) {
  console.error('PERIOD START ERROR:', error)
  alert(error instanceof Error ? error.message : 'Unknown error')
  setStatus('error')
}
  }

  return (
    <AOSButton
      type="button"
      variant={status === 'saved' ? 'secondary' : 'primary'}
      onClick={handleClick}
      disabled={status === 'saving' || status === 'saved'}
      className={compact ? 'aos-button--compact' : ''}
    >
      {status === 'saving'
        ? 'Saving...'
        : status === 'saved'
          ? 'Cycle Day 1 Saved'
          : status === 'error'
            ? 'Try Again'
            : 'Period Started Today'}
    </AOSButton>
  )
}
