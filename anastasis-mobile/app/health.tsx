import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import SectionHeader from '../components/SectionHeader'
import { getHealthProviderAdapter } from '../lib/health/adapter'
import { getHealthSyncStatus, uploadHealthSync } from '../lib/health/api'
import { colors } from '../lib/theme'

function statusLabel(value?: string | null) {
  if (!value) return 'Not connected'
  return value.replace(/_/g, ' ')
}

function formatTime(value?: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function HealthScreen() {
  const adapter = useMemo(() => getHealthProviderAdapter(), [])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [integration, setIntegration] = useState<any | null>(null)
  const [syncWindow, setSyncWindow] = useState<any | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    if (!adapter) {
      setAvailable(false)
      setLoading(false)
      return
    }

    try {
      setError(null)
      const isAvailable = await adapter.isAvailable()
      setAvailable(isAvailable)
      const status = await getHealthSyncStatus(adapter.provider)
      setIntegration(status.integration)
      setSyncWindow(status.syncWindow)
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Health integration status could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [adapter])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadStatus()
    })
    return () => subscription.remove()
  }, [loadStatus])

  async function syncNow() {
    if (!adapter || !syncWindow) return

    try {
      setSyncing(true)
      const availableNow = await adapter.isAvailable()
      setAvailable(availableNow)
      if (!availableNow) {
        await uploadHealthSync({
          provider: adapter.provider,
          permissionStatus: 'unavailable',
          samples: [],
          available: false,
        })
        await loadStatus()
        return
      }

      const result = await adapter.syncHealthData(syncWindow)
      const uploaded = await uploadHealthSync({
        provider: adapter.provider,
        permissionStatus: result.permissionStatus,
        samples: result.samples,
        providerSyncState: result.providerSyncState,
        available: true,
      })
      await loadStatus()
      Alert.alert(
        'Health sync complete',
        `${uploaded.imported} health records were processed. Your next action has been refreshed.`,
      )
    } catch (syncError) {
      Alert.alert(
        'Health sync unavailable',
        syncError instanceof Error ? syncError.message : 'Health data could not be synced.',
      )
    } finally {
      setSyncing(false)
    }
  }

  return (
    <AppShell active="profile">
      <SectionHeader
        eyebrow="Health & Wearables"
        title={adapter?.label || 'Health integration unavailable'}
        copy="Connecting health data allows Anastasis to reduce manual tracking and make more informed daily recommendations."
      />

      <AOSCard>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <View style={styles.statusGrid}>
              <StatusRow label="Provider" value={adapter?.label || 'Unsupported'} />
              <StatusRow
                label="Availability"
                value={available ? 'Available' : 'Unavailable on this device'}
              />
              <StatusRow
                label="Connection"
                value={statusLabel(integration?.connection_status)}
              />
              <StatusRow
                label="Permissions"
                value={statusLabel(integration?.permission_status)}
              />
              <StatusRow
                label="Last sync"
                value={formatTime(integration?.last_successful_sync_at)}
              />
              <StatusRow label="Sync state" value={statusLabel(integration?.sync_status)} />
            </View>

            {integration?.last_error ? (
              <Text style={styles.error}>{integration.last_error}</Text>
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <View style={styles.actions}>
              <AOSButton disabled={!adapter || syncing} onPress={syncNow}>
                {syncing ? 'Syncing' : integration ? 'Sync Now' : `Connect ${adapter?.label || 'Health'}`}
              </AOSButton>
              {adapter?.openSettings ? (
                <Pressable onPress={() => adapter.openSettings?.()} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Manage Permissions</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </AOSCard>

      <AOSCard muted>
        <Text style={styles.eyebrow}>Optional</Text>
        <Text style={styles.copy}>
          Manual check-ins, workout logging, nutrition, hydration, and recovery tracking continue to work when health data is unavailable or partially granted.
        </Text>
      </AOSCard>
    </AppShell>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGrid: {
    gap: 12,
  },
  row: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  rowValue: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  actions: {
    gap: 12,
    marginTop: 20,
  },
  secondary: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.copper,
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#E0B29D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  copy: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    marginTop: 14,
    color: '#FFB4A3',
    fontSize: 13,
    lineHeight: 19,
  },
})
