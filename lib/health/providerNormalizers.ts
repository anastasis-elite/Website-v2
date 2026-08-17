import type { NormalizedHealthSample } from './types'

function iso(value: unknown) {
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error('Invalid health provider timestamp')
  return date.toISOString()
}

export function normalizeAppleHrvSample(record: any): NormalizedHealthSample {
  const start = iso(record.startDate || record.start || record.date)
  const end = iso(record.endDate || record.end || record.date || start)
  return {
    provider: 'apple_health',
    metric_type: 'heart_rate_variability',
    value: Number(record.value),
    unit: 'ms',
    start_at: start,
    end_at: end,
    source_name: record.sourceName || 'Apple Health',
    source_device: record.device || record.sourceBundleId || null,
    source_record_id: record.uuid || record.id || null,
    metadata: {
      nativeType: 'HeartRateVariability',
    },
  }
}

export function normalizeHealthConnectHrvSample(record: any): NormalizedHealthSample {
  const time = iso(record.time || record.startTime)
  return {
    provider: 'health_connect',
    metric_type: 'heart_rate_variability',
    value: Number(record.heartRateVariabilityMillis),
    unit: 'ms',
    start_at: time,
    end_at: time,
    source_name: record.metadata?.dataOrigin || 'Health Connect',
    source_device: record.metadata?.device ? JSON.stringify(record.metadata.device) : null,
    source_record_id: record.metadata?.id || record.metadata?.clientRecordId || null,
    metadata: {
      recordType: 'HeartRateVariabilityRmssd',
    },
  }
}
