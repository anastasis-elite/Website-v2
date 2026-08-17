export const HEALTH_PROVIDERS = ['apple_health', 'health_connect'] as const
export const HEALTH_PLATFORMS = ['ios', 'android'] as const

export const HEALTH_METRIC_TYPES = [
  'sleep_duration',
  'sleep_stage',
  'resting_heart_rate',
  'heart_rate_variability',
  'respiratory_rate',
  'body_temperature',
  'steps',
  'active_energy',
  'workout',
  'walking_running_distance',
  'body_weight',
  'body_fat_percentage',
] as const

export type HealthProvider = (typeof HEALTH_PROVIDERS)[number]
export type HealthPlatform = (typeof HEALTH_PLATFORMS)[number]
export type HealthMetricType = (typeof HEALTH_METRIC_TYPES)[number]

export type HealthConnectionStatus =
  | 'disconnected'
  | 'connected'
  | 'unavailable'
  | 'error'

export type HealthPermissionStatus =
  | 'unknown'
  | 'not_requested'
  | 'granted'
  | 'partial'
  | 'denied'
  | 'unavailable'

export type HealthSyncStatus =
  | 'idle'
  | 'syncing'
  | 'success'
  | 'partial_success'
  | 'error'

export type NormalizedHealthSample = {
  provider: HealthProvider
  metric_type: HealthMetricType
  value: number
  unit: string
  start_at: string
  end_at: string
  source_name?: string | null
  source_device?: string | null
  source_record_id?: string | null
  dedupe_key?: string
  metadata?: Record<string, unknown>
}

export type HealthIntegrationState = {
  provider: HealthProvider
  platform: HealthPlatform
  connection_status: HealthConnectionStatus
  permission_status: HealthPermissionStatus
  sync_status: HealthSyncStatus
  last_sync_started_at?: string | null
  last_sync_completed_at?: string | null
  last_successful_sync_at?: string | null
  last_error?: string | null
  provider_sync_state?: Record<string, unknown>
}

export type DailyHealthMetric = {
  metric_date: string
  metric_type: HealthMetricType
  value: number | null
  unit: string
  status: 'measured' | 'aggregated' | 'unavailable'
  sample_count: number
  provider_count: number
  source_providers: HealthProvider[]
  metadata: Record<string, unknown>
}
