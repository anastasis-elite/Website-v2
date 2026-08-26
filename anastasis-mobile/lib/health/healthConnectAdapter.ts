import { Linking, Platform } from 'react-native'

import type {
  HealthProviderAdapter,
  HealthSyncWindow,
  NormalizedHealthSample,
  PermissionStatus,
} from './types'

declare const require: any

const provider = 'health_connect' as const

const permissions = [
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'RespiratoryRate' },
  { accessType: 'read', recordType: 'BodyTemperature' },
  { accessType: 'read', recordType: 'SkinTemperature' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'BasalMetabolicRate' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'BodyFat' },
] as const

function module() {
  try {
    return require('react-native-health-connect')
  } catch {
    return null
  }
}

function asArray(result: any) {
  return Array.isArray(result?.records)
    ? result.records
    : Array.isArray(result?.result)
      ? result.result
      : []
}

function timeRange(window: HealthSyncWindow) {
  return {
    timeRangeFilter: {
      operator: 'between',
      startTime: window.start,
      endTime: window.end,
    },
  }
}

function source(record: any) {
  return {
    source_name: record.metadata?.dataOrigin || 'Health Connect',
    source_device: record.metadata?.device ? JSON.stringify(record.metadata.device) : null,
    source_record_id: record.metadata?.id || record.metadata?.clientRecordId || null,
  }
}

function interval(record: any) {
  const start = record.startTime || record.time
  const end = record.endTime || record.time || start
  return {
    start_at: new Date(start).toISOString(),
    end_at: new Date(end).toISOString(),
  }
}

function valueFrom(record: any, key: string, nested?: string) {
  const raw = nested ? record[key]?.[nested] : record[key]
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function normalize(record: any, metric_type: NormalizedHealthSample['metric_type'], unit: string, key: string, nested?: string) {
  const value = valueFrom(record, key, nested)
  if (value === null) return null
  return {
    provider,
    metric_type,
    value,
    unit,
    ...interval(record),
    ...source(record),
    metadata: { recordType: record.recordType },
  }
}

async function read(recordType: string, window: HealthSyncWindow) {
  const HealthConnect = module()
  if (!HealthConnect?.readRecords) return []
  try {
    return asArray(await HealthConnect.readRecords(recordType, timeRange(window)))
  } catch {
    return []
  }
}

async function permissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'unavailable'
  const HealthConnect = module()
  if (!HealthConnect?.initialize) return 'unavailable'
  const initialized = await HealthConnect.initialize().catch(() => false)
  if (!initialized) return 'unavailable'

  const granted = await HealthConnect.getGrantedPermissions?.().catch(() => [])
  if (!Array.isArray(granted) || !granted.length) return 'not_requested'
  if (granted.length >= permissions.length) return 'granted'
  return 'partial'
}

export const HealthConnectAdapter: HealthProviderAdapter = {
  provider,
  platform: 'android',
  label: 'Health Connect',
  async isAvailable() {
    if (Platform.OS !== 'android') return false
    const HealthConnect = module()
    return Boolean(await HealthConnect?.initialize?.().catch(() => false))
  },
  async requestPermissions() {
    const HealthConnect = module()
    if (!HealthConnect?.requestPermission) return 'unavailable'
    const available = await this.isAvailable()
    if (!available) return 'unavailable'
    const granted = await HealthConnect.requestPermission([...permissions]).catch(() => [])
    if (!Array.isArray(granted) || !granted.length) return 'denied'
    return granted.length >= permissions.length ? 'granted' : 'partial'
  },
  getPermissionStatus: permissionStatus,
  async getLastSyncState() {
    return {}
  },
  async openSettings() {
    await Linking.openSettings()
  },
  async syncHealthData(window: HealthSyncWindow) {
    const status = await this.requestPermissions()
    if (status === 'denied' || status === 'unavailable') {
      return { permissionStatus: status, samples: [] }
    }

    const samples: NormalizedHealthSample[] = []

    for (const record of await read('SleepSession', window)) {
      const { start_at, end_at } = interval(record)
      const duration = (new Date(end_at).getTime() - new Date(start_at).getTime()) / 3600000
      if (duration > 0) {
        samples.push({
          provider,
          metric_type: 'sleep_duration',
          value: duration,
          unit: 'h',
          start_at,
          end_at,
          ...source(record),
          metadata: { recordType: record.recordType },
        })
      }
      for (const stage of record.stages || []) {
        const stageStart = new Date(stage.startTime).toISOString()
        const stageEnd = new Date(stage.endTime).toISOString()
        const stageHours = (new Date(stageEnd).getTime() - new Date(stageStart).getTime()) / 3600000
        if (stageHours > 0) {
          samples.push({
            provider,
            metric_type: 'sleep_stage',
            value: stageHours,
            unit: 'h',
            start_at: stageStart,
            end_at: stageEnd,
            ...source(record),
            metadata: { stage: stage.stage || stage.stageType || 'unknown' },
          })
        }
      }
    }

    const mappings: Array<[string, NormalizedHealthSample['metric_type'], string, string, string?]> = [
      ['RestingHeartRate', 'resting_heart_rate', 'bpm', 'beatsPerMinute'],
      ['HeartRateVariabilityRmssd', 'heart_rate_variability', 'ms', 'heartRateVariabilityMillis'],
      ['RespiratoryRate', 'respiratory_rate', 'breaths/min', 'rate'],
      ['BodyTemperature', 'body_temperature', 'degC', 'temperature', 'inCelsius'],
      ['Steps', 'steps', 'count', 'count'],
      ['ActiveCaloriesBurned', 'active_energy', 'kcal', 'energy', 'inKilocalories'],
      ['BasalMetabolicRate', 'resting_energy', 'kcal', 'basalMetabolicRate', 'inKilocaloriesPerDay'],
      ['Distance', 'walking_running_distance', 'm', 'distance', 'inMeters'],
      ['Weight', 'body_weight', 'kg', 'weight', 'inKilograms'],
      ['BodyFat', 'body_fat_percentage', 'percent', 'percentage'],
    ]

    for (const [recordType, metric, unit, key, nested] of mappings) {
      for (const record of await read(recordType, window)) {
        const item = normalize(record, metric, unit, key, nested)
        if (item) samples.push(item)
      }
    }

    for (const record of await read('ExerciseSession', window)) {
      const { start_at, end_at } = interval(record)
      const minutes = (new Date(end_at).getTime() - new Date(start_at).getTime()) / 60000
      if (minutes > 0) {
        samples.push({
          provider,
          metric_type: 'workout',
          value: minutes,
          unit: 'min',
          start_at,
          end_at,
          ...source(record),
          metadata: {
            workout_type: record.exerciseType || record.exerciseRoute || 'exercise',
            title: record.title || null,
          },
        })
      }
    }

    return {
      permissionStatus: status,
      samples,
      providerSyncState: { lastWindowEnd: window.end },
    }
  },
}
