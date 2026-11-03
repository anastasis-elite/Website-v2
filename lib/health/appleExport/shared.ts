import { addLocalDays, localDateKey } from '@/lib/timezone'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'

export const APPLE_EXPORT_LIMITS = {
  compressedBytes: 256 * 1024 * 1024,
  uncompressedBytes: 512 * 1024 * 1024,
  chunkBytes: 64 * 1024,
  xmlTokenChars: 64 * 1024,
  xmlDepth: 64,
  xmlElements: 4_000_000,
  records: 2_000_000,
  selectedRecords: 20_000,
  zipEntries: 256,
  zipDirectoryBytes: 2 * 1024 * 1024,
  zipCompressionRatio: 200,
  zipInflateChunkBytes: 1024,
  zipNoOutputBytes: 128 * 1024,
  batchRecords: 100,
  bodyBytes: 128 * 1024,
} as const

export type ExportRecord = {
  metric: 'heart_rate' | 'resting_heart_rate'
  value: number
  unit: 'count/min'
  startAt: string
  endAt: string
  creationAt: string | null
  sourceName: string
  sourceVersion: string
  sourceDevice: string
}
export type ExportSelection = { date: string; timezone: string; startAt: string; endAt: string }
export type ExportPreview = {
  records: ExportRecord[]
  stats: { recordsSeen: number; matched: number; malformed: number; skipped: number }
  range: { startAt: string; endAt: string } | null
  sources: string[]
}

const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const calendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function validateExportSelection(date: unknown, timezone: unknown): ExportSelection | null {
  if (!calendarDate(date) || typeof timezone !== 'string' || timezone.length > 100 ||
    !(timezone === 'UTC' || /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(timezone))) return null
  try {
    const zone = new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone
    const start = zonedDateTimeToUtc(date, '00:00', zone), end = zonedDateTimeToUtc(addLocalDays(date, 1), '00:00', zone)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || localDateKey(start, zone) !== date) return null
    return { date, timezone: zone, startAt: start.toISOString(), endAt: end.toISOString() }
  } catch { return null }
}

/** Explicit offsets are required. Validate calendar fields before Date can roll them over. */
export function normalizeExportTimestamp(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 40) return null
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))? ?(Z|[+-]\d{2}:?\d{2})$/.exec(input)
  if (!match || !calendarDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null
  const offset = match[6] === 'Z' ? 'Z' : match[6].replace(/([+-]\d{2}):?(\d{2})/, '$1:$2')
  if (offset !== 'Z' && (Number(offset.slice(1, 3)) > 14 || Number(offset.slice(4)) > 59 || Number(offset.slice(1, 3)) === 14 && Number(offset.slice(4)) !== 0)) return null
  const date = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${(match[5] || '').padEnd(3, '0')}${offset}`)
  if (!Number.isFinite(date.getTime())) return null
  const normalized = date.toISOString()
  return calendarDate(normalized.slice(0, 10)) ? normalized : null
}

const fields = ['metric', 'value', 'unit', 'startAt', 'endAt', 'creationAt', 'sourceName', 'sourceVersion', 'sourceDevice']
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value)

export function validateExportRecord(input: unknown, selection: ExportSelection): ExportRecord | null {
  if (!object(input) || Object.keys(input).length !== fields.length || Object.keys(input).some(key => !fields.includes(key)) ||
    !['heart_rate', 'resting_heart_rate'].includes(String(input.metric)) || input.unit !== 'count/min' ||
    typeof input.value !== 'number' || !Number.isFinite(input.value) || input.value <= 0 || input.value > Number.MAX_SAFE_INTEGER ||
    !text(input.sourceName, 200) || !input.sourceName.trim() || !text(input.sourceVersion, 100) || !text(input.sourceDevice, 1000)) return null
  const startAt = normalizeExportTimestamp(input.startAt), endAt = normalizeExportTimestamp(input.endAt)
  const creationAt = input.creationAt === null ? null : normalizeExportTimestamp(input.creationAt)
  if (!startAt || !endAt || startAt !== input.startAt || endAt !== input.endAt ||
    input.creationAt !== null && (!creationAt || creationAt !== input.creationAt) || endAt < startAt ||
    startAt < selection.startAt || startAt >= selection.endAt) return null
  return { metric: input.metric as ExportRecord['metric'], value: input.value, unit: 'count/min', startAt, endAt, creationAt,
    sourceName: input.sourceName, sourceVersion: input.sourceVersion, sourceDevice: input.sourceDevice }
}

export function normalizeAppleRecord(attributes: Record<string, string>, date: string, timezone: string, validatedSelection?: ExportSelection):
  { kind: 'matched'; record: ExportRecord } | { kind: 'skipped' } | { kind: 'malformed' } {
  const metric = attributes.type === 'HKQuantityTypeIdentifierHeartRate' ? 'heart_rate' :
    attributes.type === 'HKQuantityTypeIdentifierRestingHeartRate' ? 'resting_heart_rate' : null
  if (!metric) return { kind: 'skipped' }
  const selection = validatedSelection || validateExportSelection(date, timezone)
  const startAt = normalizeExportTimestamp(attributes.startDate), endAt = normalizeExportTimestamp(attributes.endDate)
  if (!selection || !startAt || !endAt) return { kind: 'malformed' }
  if (startAt < selection.startAt || startAt >= selection.endAt) return { kind: 'skipped' }
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(attributes.value || '')) return { kind: 'malformed' }
  const creationAt = attributes.creationDate === undefined ? null : normalizeExportTimestamp(attributes.creationDate)
  if (attributes.creationDate !== undefined && !creationAt) return { kind: 'malformed' }
  const record = validateExportRecord({ metric, value: Number(attributes.value), unit: attributes.unit,
    startAt, endAt, creationAt, sourceName: attributes.sourceName || '', sourceVersion: attributes.sourceVersion || '', sourceDevice: attributes.device || '' }, selection)
  return record ? { kind: 'matched', record } : { kind: 'malformed' }
}
