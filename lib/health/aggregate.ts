import type {
  DailyHealthMetric,
  HealthMetricType,
  HealthProvider,
  NormalizedHealthSample,
} from './types'

type StoredHealthSample = NormalizedHealthSample & {
  id?: string
  provider: HealthProvider
}

const sumMetrics = new Set<HealthMetricType>([
  'sleep_duration',
  'steps',
  'active_energy',
  'resting_energy',
  'walking_running_distance',
])

const averageMetrics = new Set<HealthMetricType>([
  'resting_heart_rate',
  'heart_rate_variability',
  'respiratory_rate',
  'body_temperature',
])

const latestMetrics = new Set<HealthMetricType>([
  'body_weight',
  'body_fat_percentage',
])

function round(value: number, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function providers(samples: StoredHealthSample[]) {
  return Array.from(new Set(samples.map((sample) => sample.provider)))
}

function stageSummary(samples: StoredHealthSample[]) {
  return samples.reduce<Record<string, number>>((summary, sample) => {
    const stage = String(sample.metadata?.stage || 'unknown')
    summary[stage] = round((summary[stage] || 0) + sample.value, 2)
    return summary
  }, {})
}

export function aggregateHealthSamplesForDay({
  date,
  timezone,
  samples,
}: {
  date: string
  timezone: string
  samples: StoredHealthSample[]
}): DailyHealthMetric[] {
  const byMetric = new Map<HealthMetricType, StoredHealthSample[]>()
  for (const sample of samples) {
    const rows = byMetric.get(sample.metric_type) || []
    rows.push(sample)
    byMetric.set(sample.metric_type, rows)
  }

  const metrics: DailyHealthMetric[] = []

  for (const [metric_type, rows] of byMetric.entries()) {
    const sourceProviders = providers(rows)
    const firstUnit = rows[0]?.unit || 'count'

    if (sumMetrics.has(metric_type)) {
      metrics.push({
        metric_date: date,
        metric_type,
        value: round(rows.reduce((total, sample) => total + sample.value, 0)),
        unit: firstUnit,
        status: 'aggregated',
        sample_count: rows.length,
        provider_count: sourceProviders.length,
        source_providers: sourceProviders,
        metadata: { aggregation: 'sum', timezone },
      })
      continue
    }

    if (averageMetrics.has(metric_type)) {
      metrics.push({
        metric_date: date,
        metric_type,
        value: round(
          rows.reduce((total, sample) => total + sample.value, 0) / rows.length,
        ),
        unit: firstUnit,
        status: rows.length === 1 ? 'measured' : 'aggregated',
        sample_count: rows.length,
        provider_count: sourceProviders.length,
        source_providers: sourceProviders,
        metadata: { aggregation: rows.length === 1 ? 'latest_measurement' : 'average', timezone },
      })
      continue
    }

    if (latestMetrics.has(metric_type)) {
      const latest = [...rows].sort(
        (a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime(),
      )[0]
      metrics.push({
        metric_date: date,
        metric_type,
        value: round(latest.value),
        unit: latest.unit,
        status: 'measured',
        sample_count: rows.length,
        provider_count: sourceProviders.length,
        source_providers: sourceProviders,
        metadata: { aggregation: 'latest', timezone },
      })
      continue
    }

    if (metric_type === 'sleep_stage') {
      metrics.push({
        metric_date: date,
        metric_type,
        value: round(rows.reduce((total, sample) => total + sample.value, 0)),
        unit: firstUnit,
        status: 'aggregated',
        sample_count: rows.length,
        provider_count: sourceProviders.length,
        source_providers: sourceProviders,
        metadata: { aggregation: 'stage_sum', timezone, stages: stageSummary(rows) },
      })
      continue
    }

    if (metric_type === 'workout') {
      metrics.push({
        metric_date: date,
        metric_type,
        value: round(rows.reduce((total, sample) => total + sample.value, 0)),
        unit: firstUnit,
        status: 'aggregated',
        sample_count: rows.length,
        provider_count: sourceProviders.length,
        source_providers: sourceProviders,
        metadata: {
          aggregation: 'duration_sum',
          timezone,
          workout_count: rows.length,
          types: rows.map((sample) => sample.metadata?.workout_type).filter(Boolean),
        },
      })
    }
  }

  return metrics
}
