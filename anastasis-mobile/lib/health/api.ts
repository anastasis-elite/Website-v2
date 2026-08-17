import { Platform } from 'react-native'

import { supabase } from '../supabase'
import type {
  HealthProviderName,
  HealthSyncWindow,
  NormalizedHealthSample,
  PermissionStatus,
} from './types'

const apiUrl = process.env.EXPO_PUBLIC_APP_API_URL

if (!apiUrl) {
  throw new Error('Missing EXPO_PUBLIC_APP_API_URL')
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No authenticated session')
  }

  return session.access_token
}

async function mobileHealthFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    method: init?.method || 'GET',
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || 'Health request could not be completed.')
  }

  return payload as T
}

export async function getHealthSyncStatus(provider: HealthProviderName) {
  const params = new URLSearchParams({
    provider,
    platform: Platform.OS,
  })

  return mobileHealthFetch<{
    integration: any | null
    syncWindow: HealthSyncWindow
  }>(`/api/mobile/health/sync?${params.toString()}`)
}

export async function uploadHealthSync({
  provider,
  permissionStatus,
  samples,
  providerSyncState,
  available = true,
}: {
  provider: HealthProviderName
  permissionStatus: PermissionStatus
  samples: NormalizedHealthSample[]
  providerSyncState?: Record<string, unknown>
  available?: boolean
}) {
  return mobileHealthFetch<{
    success: true
    imported: number
    integration: any
    aggregates: { dates: string[]; metricTypes: string[] }
    nextAction: any
  }>('/api/mobile/health/sync', {
    method: 'POST',
    body: JSON.stringify({
      provider,
      platform: Platform.OS,
      permissionStatus,
      samples,
      providerSyncState,
      available,
    }),
  })
}
