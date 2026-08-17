import crypto from 'crypto'
import {
  HEALTH_METRIC_TYPES,
  HEALTH_PROVIDERS,
  type HealthMetricType,
  type HealthProvider,
  type NormalizedHealthSample,
} from './types'

const metricSet = new Set<string>(HEALTH_METRIC_TYPES)
const providerSet = new Set<string>(HEALTH_PROVIDERS)

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid health sample ${field}`)
  }
  return value.trim()
}

function isoDate(value: unknown, field: string) {
  const raw = requiredString(value, field)
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid health sample ${field}`)
  }
  return date.toISOString()
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(',')}}`
}

export function buildHealthSampleDedupeKey(sample: NormalizedHealthSample) {
  if (sample.source_record_id) {
    return `source:${sample.metric_type}:${sample.source_record_id}:${sample.start_at}:${sample.end_at}`
  }

  const identity = [
    sample.provider,
    sample.metric_type,
    sample.start_at,
    sample.end_at,
    sample.value,
    sample.unit,
    sample.source_name || '',
    sample.source_device || '',
    stableJson(sample.metadata || {}),
  ].join('|')

  return `hash:${crypto.createHash('sha256').update(identity).digest('hex')}`
}

export function normalizeHealthSample(input: unknown): NormalizedHealthSample {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid health sample payload')
  }

  const raw = input as Record<string, unknown>
  const provider = requiredString(raw.provider, 'provider') as HealthProvider
  const metricType = requiredString(raw.metric_type, 'metric_type') as HealthMetricType

  if (!providerSet.has(provider)) {
    throw new Error(`Unsupported health provider: ${provider}`)
  }

  if (!metricSet.has(metricType)) {
    throw new Error(`Unsupported health metric: ${metricType}`)
  }

  const value = Number(raw.value)
  if (!Number.isFinite(value)) {
    throw new Error('Invalid health sample value')
  }

  const sample: NormalizedHealthSample = {
    provider,
    metric_type: metricType,
    value,
    unit: requiredString(raw.unit, 'unit'),
    start_at: isoDate(raw.start_at, 'start_at'),
    end_at: isoDate(raw.end_at, 'end_at'),
    source_name: typeof raw.source_name === 'string' ? raw.source_name : null,
    source_device: typeof raw.source_device === 'string' ? raw.source_device : null,
    source_record_id:
      typeof raw.source_record_id === 'string' && raw.source_record_id.trim()
        ? raw.source_record_id.trim()
        : null,
    metadata:
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
  }

  sample.dedupe_key =
    typeof raw.dedupe_key === 'string' && raw.dedupe_key.trim()
      ? raw.dedupe_key.trim()
      : buildHealthSampleDedupeKey(sample)

  return sample
}

export function normalizeHealthSamples(input: unknown) {
  if (!Array.isArray(input)) return []
  return input.map(normalizeHealthSample)
}
