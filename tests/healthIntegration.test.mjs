import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

async function importTypescriptModule(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const { normalizeAppleHrvSample, normalizeHealthConnectHrvSample } =
  await importTypescriptModule('lib/health/providerNormalizers.ts')
const { aggregateHealthSamplesForDay } =
  await importTypescriptModule('lib/health/aggregate.ts')
const { buildDailyScheduleState } =
  await importTypescriptModule('lib/schedule/engine.ts')

function loadCommonJsTypescript(path, localModules = {}) {
  const source = readFileSync(path, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  const require = (id) => {
    if (localModules[id]) return localModules[id]
    return id === 'crypto' ? awaitImportCrypto : {}
  }
  vm.runInNewContext(compiled, { exports: module.exports, module, require })
  return module.exports
}

const awaitImportCrypto = crypto
const healthTypes = loadCommonJsTypescript('lib/health/types.ts')
const { normalizeHealthSample, buildHealthSampleDedupeKey } = loadCommonJsTypescript(
  'lib/health/normalize.ts',
  { './types': healthTypes },
)

test('Apple Health HRV normalizes to the Anastasis metric contract', () => {
  const sample = normalizeAppleHrvSample({
    uuid: 'apple-hrv-1',
    value: 58,
    startDate: '2026-08-17T12:00:00.000Z',
    endDate: '2026-08-17T12:00:00.000Z',
    sourceName: 'Apple Watch',
  })

  assert.equal(sample.provider, 'apple_health')
  assert.equal(sample.metric_type, 'heart_rate_variability')
  assert.equal(sample.value, 58)
  assert.equal(sample.unit, 'ms')
})

test('Health Connect HRV normalizes to the same Anastasis metric contract', () => {
  const sample = normalizeHealthConnectHrvSample({
    heartRateVariabilityMillis: 58,
    time: '2026-08-17T12:00:00.000Z',
    metadata: { id: 'hc-hrv-1', dataOrigin: 'com.sample.watch' },
  })

  assert.equal(sample.provider, 'health_connect')
  assert.equal(sample.metric_type, 'heart_rate_variability')
  assert.equal(sample.value, 58)
  assert.equal(sample.unit, 'ms')
})

test('dedupe uses source record ids when available', () => {
  const sample = normalizeHealthSample({
    provider: 'apple_health',
    metric_type: 'steps',
    value: 120,
    unit: 'count',
    start_at: '2026-08-17T12:00:00Z',
    end_at: '2026-08-17T12:10:00Z',
    source_record_id: 'native-id',
  })

  assert.equal(
    sample.dedupe_key,
    'source:steps:native-id:2026-08-17T12:00:00.000Z:2026-08-17T12:10:00.000Z',
  )
})

test('dedupe is deterministic when native ids are unavailable', () => {
  const sample = {
    provider: 'health_connect',
    metric_type: 'steps',
    value: 120,
    unit: 'count',
    start_at: '2026-08-17T12:00:00.000Z',
    end_at: '2026-08-17T12:10:00.000Z',
    source_name: 'Health Connect',
    source_device: 'phone',
    metadata: { recording: 'automatic' },
  }

  assert.equal(
    buildHealthSampleDedupeKey(sample),
    buildHealthSampleDedupeKey({ ...sample }),
  )
})

test('daily aggregation handles missing metrics and aggregates available values', () => {
  const metrics = aggregateHealthSamplesForDay({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    samples: [
      {
        provider: 'apple_health',
        metric_type: 'steps',
        value: 1000,
        unit: 'count',
        start_at: '2026-08-17T12:00:00.000Z',
        end_at: '2026-08-17T13:00:00.000Z',
      },
      {
        provider: 'health_connect',
        metric_type: 'steps',
        value: 1500,
        unit: 'count',
        start_at: '2026-08-17T13:00:00.000Z',
        end_at: '2026-08-17T14:00:00.000Z',
      },
    ],
  })

  assert.equal(metrics.length, 1)
  assert.equal(metrics[0].metric_type, 'steps')
  assert.equal(metrics[0].value, 2500)
  assert.equal(metrics[0].provider_count, 2)
})

test('schedule refresh consumes Daily State context without provider-specific types', () => {
  const state = buildDailyScheduleState({
    date: '2026-08-17',
    timezone: 'America/Chicago',
    now: new Date('2026-08-17T13:00:00.000Z'),
    dayStart: new Date('2026-08-17T05:00:00.000Z'),
    dayEnd: new Date('2026-08-18T05:00:00.000Z'),
    events: [
      {
        id: 'workout',
        user_id: 'user-a',
        client_id: 'client-a',
        title: 'Workout',
        description: null,
        event_type: 'workout',
        source: 'program',
        start_at: '2026-08-17T15:00:00.000Z',
        end_at: '2026-08-17T16:00:00.000Z',
        timezone: 'America/Chicago',
        all_day: false,
        status: 'scheduled',
        completed_at: null,
        flexibility_type: 'flexible',
        priority: 'medium',
        required: true,
        movable: true,
        approval_required: false,
        earliest_start_at: null,
        latest_end_at: null,
        preferred_time: null,
        estimated_duration_minutes: 60,
        external_provider_name: null,
        external_contact_type: null,
        external_contact_value: null,
        external_event_id: null,
        external_calendar_source: null,
        reschedule_allowed: false,
        reschedule_requires_approval: true,
        last_reschedule_requested_at: null,
        delegation_status: null,
        delegation_notes: null,
        adaptive_reason: null,
        adjusted_start_at: null,
        adjusted_end_at: null,
        adjusted_duration_minutes: null,
      },
    ],
    logic: {
      capacityStatus: { status: 'low_capacity' },
      recoveryStatus: { status: 'modify_workout' },
    },
  })

  assert.equal(state.adjustments[0].adjustment_type, 'reduce_duration')
  assert.equal(JSON.stringify(state).includes('HealthKit'), false)
  assert.equal(JSON.stringify(state).includes('HealthConnect'), false)
})
