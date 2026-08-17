export type HealthProviderName = 'apple_health' | 'health_connect'
export type HealthPlatformName = 'ios' | 'android'

export type HealthMetricType =
  | 'sleep_duration'
  | 'sleep_stage'
  | 'resting_heart_rate'
  | 'heart_rate_variability'
  | 'respiratory_rate'
  | 'body_temperature'
  | 'steps'
  | 'active_energy'
  | 'workout'
  | 'walking_running_distance'
  | 'body_weight'
  | 'body_fat_percentage'

export type PermissionStatus =
  | 'unknown'
  | 'not_requested'
  | 'granted'
  | 'partial'
  | 'denied'
  | 'unavailable'

export type NormalizedHealthSample = {
  provider: HealthProviderName
  metric_type: HealthMetricType
  value: number
  unit: string
  start_at: string
  end_at: string
  source_name?: string | null
  source_device?: string | null
  source_record_id?: string | null
  metadata?: Record<string, unknown>
}

export type HealthSyncWindow = {
  start: string
  end: string
  mode: 'initial' | 'incremental'
}

export type HealthProviderAdapter = {
  provider: HealthProviderName
  platform: HealthPlatformName
  label: string
  isAvailable(): Promise<boolean>
  requestPermissions(): Promise<PermissionStatus>
  getPermissionStatus(): Promise<PermissionStatus>
  syncHealthData(window: HealthSyncWindow): Promise<{
    permissionStatus: PermissionStatus
    samples: NormalizedHealthSample[]
    providerSyncState?: Record<string, unknown>
  }>
  getLastSyncState(): Promise<Record<string, unknown>>
  openSettings?(): Promise<void>
}
