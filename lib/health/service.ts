import { getClientDayRange } from '@/lib/schedule/time'
import { getClientTimeZone } from '@/lib/timezone'
import { aggregateHealthSamplesForDay } from './aggregate'
import { normalizeHealthSamples } from './normalize'
import type {
  HealthIntegrationState,
  HealthProvider,
  HealthSyncStatus,
  NormalizedHealthSample,
} from './types'

export const INITIAL_HEALTH_SYNC_DAYS = 30

type SupabaseClient = any

export function healthSyncWindow(lastSuccessfulSyncAt?: string | null) {
  const end = new Date()
  const start = lastSuccessfulSyncAt
    ? new Date(lastSuccessfulSyncAt)
    : new Date(end.getTime() - INITIAL_HEALTH_SYNC_DAYS * 24 * 60 * 60 * 1000)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    mode: lastSuccessfulSyncAt ? 'incremental' as const : 'initial' as const,
  }
}

export async function upsertHealthIntegration({
  supabase,
  userId,
  clientId,
  state,
}: {
  supabase: SupabaseClient
  userId: string
  clientId: string
  state: HealthIntegrationState
}) {
  const payload = {
    user_id: userId,
    client_id: clientId,
    ...state,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('health_integrations')
    .upsert(payload, { onConflict: 'user_id,provider' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getHealthIntegration({
  supabase,
  userId,
  provider,
}: {
  supabase: SupabaseClient
  userId: string
  provider: HealthProvider
}) {
  const { data, error } = await supabase
    .from('health_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function importNormalizedHealthSamples({
  supabase,
  userId,
  clientId,
  samples,
}: {
  supabase: SupabaseClient
  userId: string
  clientId: string
  samples: NormalizedHealthSample[]
}) {
  if (!samples.length) return { insertedOrUpdated: 0 }

  const rows = samples.map((sample) => ({
    user_id: userId,
    client_id: clientId,
    provider: sample.provider,
    metric_type: sample.metric_type,
    value: sample.value,
    unit: sample.unit,
    start_at: sample.start_at,
    end_at: sample.end_at,
    source_name: sample.source_name || null,
    source_device: sample.source_device || null,
    source_record_id: sample.source_record_id || null,
    dedupe_key: sample.dedupe_key,
    metadata: sample.metadata || {},
    imported_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('health_samples')
    .upsert(rows, { onConflict: 'user_id,provider,dedupe_key' })

  if (error) throw new Error(error.message)
  return { insertedOrUpdated: rows.length }
}

export async function rebuildDailyHealthMetrics({
  supabase,
  userId,
  client,
  dates,
}: {
  supabase: SupabaseClient
  userId: string
  client: any
  dates: string[]
}) {
  const timezone = getClientTimeZone(client)
  const uniqueDates = Array.from(new Set(dates)).sort()
  const upserted: string[] = []

  for (const date of uniqueDates) {
    const range = getClientDayRange(client, date)
    const { data: samples, error } = await supabase
      .from('health_samples')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', client.client_id)
      .gte('start_at', range.start.toISOString())
      .lt('start_at', range.end.toISOString())

    if (error) throw new Error(error.message)

    const metrics = aggregateHealthSamplesForDay({
      date,
      timezone,
      samples: samples || [],
    })

    if (!metrics.length) continue

    const rows = metrics.map((metric) => ({
      user_id: userId,
      client_id: client.client_id,
      ...metric,
      updated_at: new Date().toISOString(),
      computed_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabase
      .from('daily_health_metrics')
      .upsert(rows, { onConflict: 'user_id,client_id,metric_date,metric_type' })

    if (upsertError) throw new Error(upsertError.message)
    upserted.push(...metrics.map((metric) => metric.metric_type))
  }

  return { dates: uniqueDates, metricTypes: Array.from(new Set(upserted)) }
}

export function datesTouchedBySamples(samples: NormalizedHealthSample[], timezone = 'America/Chicago') {
  return Array.from(
    new Set(
      samples.map((sample) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(sample.start_at)),
      ),
    ),
  )
}

export async function completeHealthSync({
  supabase,
  userId,
  client,
  integration,
  samples,
  syncStatus = 'success',
  lastError = null,
}: {
  supabase: SupabaseClient
  userId: string
  client: any
  integration: HealthIntegrationState
  samples: unknown[]
  syncStatus?: HealthSyncStatus
  lastError?: string | null
}) {
  const normalized = normalizeHealthSamples(samples)
  await importNormalizedHealthSamples({
    supabase,
    userId,
    clientId: client.client_id,
    samples: normalized,
  })

  const aggregates = await rebuildDailyHealthMetrics({
    supabase,
    userId,
    client,
    dates: datesTouchedBySamples(normalized, getClientTimeZone(client)),
  })

  const now = new Date().toISOString()
  const savedIntegration = await upsertHealthIntegration({
    supabase,
    userId,
    clientId: client.client_id,
    state: {
      ...integration,
      connection_status:
        integration.permission_status === 'unavailable'
          ? 'unavailable'
          : integration.permission_status === 'denied'
            ? 'disconnected'
            : 'connected',
      sync_status: syncStatus,
      last_sync_completed_at: now,
      last_successful_sync_at: syncStatus === 'error' ? integration.last_successful_sync_at : now,
      last_error: lastError,
    },
  })

  return {
    integration: savedIntegration,
    imported: normalized.length,
    aggregates,
  }
}
