import { Linking, Platform } from 'react-native'

import type {
  HealthProviderAdapter,
  HealthSyncWindow,
  NormalizedHealthSample,
  PermissionStatus,
} from './types'

declare const require: any

const provider = 'apple_health' as const

function healthKit() {
  try {
    return require('react-native-health').default || require('react-native-health')
  } catch {
    return null
  }
}

function callHealth<T>(method: string, options: Record<string, unknown>) {
  return new Promise<T[]>((resolve) => {
    const AppleHealthKit = healthKit()
    if (!AppleHealthKit?.[method]) return resolve([])
    AppleHealthKit[method](options, (_error: string, results: T[]) => {
      resolve(Array.isArray(results) ? results : [])
    })
  })
}

function sampleTime(row: any) {
  const start = row.startDate || row.start || row.date || row.creationDate
  const end = row.endDate || row.end || start
  return {
    start_at: new Date(start).toISOString(),
    end_at: new Date(end).toISOString(),
  }
}

function source(row: any) {
  return {
    source_name: row.sourceName || row.source || 'Apple Health',
    source_device: row.device || row.sourceBundleId || null,
    source_record_id: row.uuid || row.id || row.metadata?.HKMetadataKeySyncIdentifier || null,
  }
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalized(row: any, metric_type: NormalizedHealthSample['metric_type'], unit: string, valueKey = 'value') {
  const value = numeric(row[valueKey])
  if (value === null) return null
  return {
    provider,
    metric_type,
    value,
    unit,
    ...sampleTime(row),
    ...source(row),
    metadata: { nativeType: metric_type },
  }
}

async function requestOrCheckPermissions(request = false): Promise<PermissionStatus> {
  if (Platform.OS !== 'ios') return 'unavailable'
  const AppleHealthKit = healthKit()
  if (!AppleHealthKit?.initHealthKit) return 'unavailable'

  const permissions = AppleHealthKit.Constants?.Permissions
  if (!permissions) return 'unavailable'

  const options = {
    permissions: {
      read: [
        permissions.SleepAnalysis,
        permissions.RestingHeartRate,
        permissions.HeartRateVariability,
        permissions.RespiratoryRate,
        permissions.BodyTemperature,
        permissions.Steps,
        permissions.ActiveEnergyBurned,
        permissions.Workout,
        permissions.DistanceWalkingRunning,
        permissions.Weight,
        permissions.BodyFatPercentage,
      ].filter(Boolean),
      write: [],
    },
  }

  if (!request) return 'unknown'

  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(options, (error: string) => {
      resolve(error ? 'denied' : 'granted')
    })
  })
}

export const AppleHealthAdapter: HealthProviderAdapter = {
  provider,
  platform: 'ios',
  label: 'Apple Health',
  async isAvailable() {
    if (Platform.OS !== 'ios') return false
    const AppleHealthKit = healthKit()
    if (!AppleHealthKit?.isAvailable) return false
    return new Promise((resolve) => {
      AppleHealthKit.isAvailable((_error: object, available: boolean) => {
        resolve(Boolean(available))
      })
    })
  },
  requestPermissions() {
    return requestOrCheckPermissions(true)
  },
  getPermissionStatus() {
    return requestOrCheckPermissions(false)
  },
  async getLastSyncState() {
    return {}
  },
  async openSettings() {
    await Linking.openSettings()
  },
  async syncHealthData(window: HealthSyncWindow) {
    const permissionStatus = await requestOrCheckPermissions(true)
    if (permissionStatus === 'denied' || permissionStatus === 'unavailable') {
      return { permissionStatus, samples: [] }
    }

    const options = { startDate: window.start, endDate: window.end, ascending: true }
    const samples: NormalizedHealthSample[] = []

    const sleep = await callHealth<any>('getSleepSamples', options)
    for (const row of sleep) {
      const { start_at, end_at } = sampleTime(row)
      const hours = (new Date(end_at).getTime() - new Date(start_at).getTime()) / 3600000
      if (hours > 0) {
        samples.push({
          provider,
          metric_type: 'sleep_duration',
          value: hours,
          unit: 'h',
          start_at,
          end_at,
          ...source(row),
          metadata: { stage: row.value || row.sleepState || 'asleep' },
        })
      }
    }

    for (const row of await callHealth<any>('getRestingHeartRateSamples', options)) {
      const item = normalized(row, 'resting_heart_rate', 'bpm')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getHeartRateVariabilitySamples', options)) {
      const item = normalized(row, 'heart_rate_variability', 'ms')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getRespiratoryRateSamples', options)) {
      const item = normalized(row, 'respiratory_rate', 'breaths/min')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getBodyTemperatureSamples', options)) {
      const item = normalized(row, 'body_temperature', 'degF')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getDailyStepCountSamples', options)) {
      const item = normalized(row, 'steps', 'count')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getActiveEnergyBurned', options)) {
      const item = normalized(row, 'active_energy', 'kcal')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getDailyDistanceWalkingRunningSamples', options)) {
      const item = normalized(row, 'walking_running_distance', 'mi')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getWeightSamples', options)) {
      const item = normalized(row, 'body_weight', 'lb')
      if (item) samples.push(item)
    }
    for (const row of await callHealth<any>('getBodyFatPercentageSamples', options)) {
      const item = normalized(row, 'body_fat_percentage', 'percent')
      if (item) samples.push(item)
    }

    return {
      permissionStatus: samples.length ? 'granted' : permissionStatus,
      samples,
      providerSyncState: { lastWindowEnd: window.end },
    }
  },
}
