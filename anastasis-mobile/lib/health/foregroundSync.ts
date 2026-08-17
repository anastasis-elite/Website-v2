import AsyncStorage from '@react-native-async-storage/async-storage'

import { getHealthProviderAdapter } from './adapter'
import { getHealthSyncStatus, uploadHealthSync } from './api'

const LAST_FOREGROUND_SYNC_KEY = 'anastasis:last-health-foreground-sync'
const FOREGROUND_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000

export async function maybeSyncHealthOnForeground() {
  const adapter = getHealthProviderAdapter()
  if (!adapter) return

  const lastAttempt = Number(await AsyncStorage.getItem(LAST_FOREGROUND_SYNC_KEY))
  if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < FOREGROUND_SYNC_INTERVAL_MS) {
    return
  }

  await AsyncStorage.setItem(LAST_FOREGROUND_SYNC_KEY, String(Date.now()))

  const available = await adapter.isAvailable()
  if (!available) return

  const status = await getHealthSyncStatus(adapter.provider)
  if (
    !status.integration ||
    !['granted', 'partial'].includes(status.integration.permission_status)
  ) {
    return
  }

  const result = await adapter.syncHealthData(status.syncWindow)
  await uploadHealthSync({
    provider: adapter.provider,
    permissionStatus: result.permissionStatus,
    samples: result.samples,
    providerSyncState: result.providerSyncState,
    available,
  })
}
