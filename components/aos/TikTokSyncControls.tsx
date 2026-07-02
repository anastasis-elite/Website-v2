'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type SyncKind = 'profile' | 'videos'

export default function TikTokSyncControls({ connected }: { connected: boolean }) {
  const [status, setStatus] = useState<string>('')
  const [running, setRunning] = useState<SyncKind | null>(null)

  async function sync(kind: SyncKind) {
    setRunning(kind)
    setStatus('')
    const endpoint = kind === 'profile'
      ? '/api/internal/tiktok/sync'
      : '/api/internal/tiktok/videos/sync'
    try {
      const response = await fetch(endpoint, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Sync failed.')
      setStatus(kind === 'profile' ? 'Profile synced.' : `${payload.videos} videos synced.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setRunning(null)
    }
  }

  if (!connected) return null

  return (
    <div>
      <div style={styles.buttonRowStyle}>
        <button type="button" style={styles.secondaryButtonStyle} disabled={Boolean(running)} onClick={() => sync('profile')}>
          {running === 'profile' ? 'Syncing…' : 'Sync profile'}
        </button>
        <button type="button" style={styles.secondaryButtonStyle} disabled={Boolean(running)} onClick={() => sync('videos')}>
          {running === 'videos' ? 'Syncing…' : 'Sync videos'}
        </button>
      </div>
      {status && <p aria-live="polite" style={{ ...styles.bodyStyle, marginTop: '16px' }}>{status}</p>}
    </div>
  )
}
