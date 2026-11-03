import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { membershipCan } from '@/lib/membership/policy'
import { validateExportRecord, validateExportSelection } from '@/lib/health/appleExport/shared'
import type { ExportSelection } from '@/lib/health/appleExport/shared'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const provenance = 'Apple Health export; user imported'
const maxBytes = 128 * 1024
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function receipt(input: unknown, selection: ExportSelection) {
  if (!object(input) || typeof input.id !== 'string' || !uuid.test(input.id) || input.date !== selection.date || input.timezone !== selection.timezone ||
    !Number.isInteger(input.inputCount) || Number(input.inputCount) < 1 || Number(input.inputCount) > 100 ||
    !Number.isInteger(input.imported) || !Number.isInteger(input.alreadyPresent) || Number(input.imported) < 0 || Number(input.alreadyPresent) < 0 ||
    Number(input.imported) + Number(input.alreadyPresent) !== input.inputCount || typeof input.confirmedAt !== 'string' || !Number.isFinite(Date.parse(input.confirmedAt))) return null
  return { id: input.id, date: selection.date, timezone: selection.timezone, inputCount: input.inputCount,
    imported: input.imported, alreadyPresent: input.alreadyPresent, confirmedAt: input.confirmedAt }
}

function sameOrigin(request: Request, mutation: boolean) {
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  return (!mutation && !origin || origin === new URL(request.url).origin) && (!site || site === 'same-origin')
}

async function identity(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { response: json({ error: 'Sign in to review imported readings.' }, 401) } as const
  if (!user.email_confirmed_at) return { response: json({ error: 'Verify your email before reviewing imported readings.' }, 403) } as const
  const { data: client, error: clientError } = await supabase.from('clients')
    .select('client_id,auth_user_id,program,access,active,verified_purchase,subscription_ends_at,membership_expires_at')
    .eq('auth_user_id', user.id).maybeSingle()
  if (clientError) return { response: json({ error: 'Your account could not be confirmed. Retry.' }, 503) } as const
  if (!client || client.auth_user_id !== user.id || !membershipCan(client, 'healthRecords')) return { response: json({ error: 'Imported health records are unavailable for this membership.' }, 403) } as const
  // These headers bind an already-previewed file/read to its current account;
  // they never choose the authenticated owner or client used below.
  if (request.headers.get('x-expected-client-id') !== client.client_id || request.headers.get('x-expected-user-id') !== user.id) {
    return { response: json({ error: 'Your signed-in account changed. Reopen the importer and preview again.', code: 'ACCOUNT_CHANGED' }, 409) } as const
  }
  return { supabase, client } as const
}

async function boundedJson(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new Error('too_large')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, text = ''
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('too_large') }
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text)
  } finally { reader.releaseLock() }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request, true)) return json({ error: 'Open the importer on Anastasis before confirming an import.' }, 403)
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Send only confirmed normalized records.' }, 415)
    const context = await identity(request); if ('response' in context) return context.response
    let body: unknown
    try { body = await boundedJson(request) } catch (error) {
      return json({ error: error instanceof Error && error.message === 'too_large' ? 'This batch is too large. Preview the file again.' : 'This import batch could not be read.' }, error instanceof Error && error.message === 'too_large' ? 413 : 400)
    }
    if (!object(body) || Object.keys(body).some(key => !['date', 'timezone', 'records'].includes(key))) return json({ error: 'Review the selected day and records before importing.' }, 400)
    const selection = validateExportSelection(body.date, body.timezone)
    if (!selection || !Array.isArray(body.records) || body.records.length < 1 || body.records.length > 100) return json({ error: 'Choose one valid day, timezone and a batch of up to 100 records.' }, 400)
    const records = body.records.map(record => validateExportRecord(record, selection))
    if (records.some(record => !record)) return json({ error: 'The confirmed records do not match this selected day or supported format.' }, 400)
    const { data, error } = await context.supabase.rpc('import_health_export_review_batch', {
      p_client_id: context.client.client_id, p_date: selection.date, p_timezone: selection.timezone, p_records: records,
    })
    if (error || !object(data) || !Number.isInteger(data.imported) || !Number.isInteger(data.alreadyPresent) || typeof data.replayed !== 'boolean' ||
      Number(data.imported) < 0 || Number(data.alreadyPresent) < 0 || Number(data.imported) + Number(data.alreadyPresent) !== records.length) {
      return json({ error: 'This batch save was not confirmed. Retry the same preview; duplicates are protected.' }, error?.code === '42501' ? 403 : 503)
    }
    const confirmed = receipt(data.receipt, selection)
    if (!confirmed || confirmed.inputCount !== records.length) return json({ error: 'This batch confirmation could not be verified. Retry the same preview.' }, 503)
    return json({ success: true, date: selection.date, timezone: selection.timezone, imported: data.imported, alreadyPresent: data.alreadyPresent,
      replayed: data.replayed, receipt: confirmed })
  } catch { return json({ error: 'This batch save was not confirmed. Retry the same preview; duplicates are protected.' }, 503) }
}

export async function GET(request: Request) {
  try {
    if (!sameOrigin(request, false)) return json({ error: 'Open imported records on Anastasis.' }, 403)
    const context = await identity(request); if ('response' in context) return context.response
    const query = new URL(request.url).searchParams
    if ([...query.keys()].some(key => !['date', 'timezone', 'cursor'].includes(key) || query.getAll(key).length !== 1)) return json({ error: 'Choose a day and timezone to review.' }, 400)
    const selection = validateExportSelection(query.get('date'), query.get('timezone'))
    const cursor = query.get('cursor') || '0'
    if (!selection || !/^\d{1,7}$/.test(cursor) || Number(cursor) > 1_000_000) return json({ error: 'Choose a valid day, timezone and record page.' }, 400)
    const { data, error } = await context.supabase.rpc('get_health_export_review_day', {
      p_client_id: context.client.client_id, p_date: selection.date, p_timezone: selection.timezone, p_offset: Number(cursor),
    })
    if (error || !object(data) || !Array.isArray(data.records) || data.records.length > 100 || !Array.isArray(data.receipts) || data.receipts.length > 10 || !Number.isInteger(data.total) || Number(data.total) < 0 ||
      !object(data.counts) || !Number.isInteger(data.counts.heart_rate) || !Number.isInteger(data.counts.resting_heart_rate) ||
      Number(data.counts.heart_rate) < 0 || Number(data.counts.resting_heart_rate) < 0 || Number(data.counts.heart_rate) + Number(data.counts.resting_heart_rate) !== data.total) {
      return json({ error: 'Saved imported records could not be loaded. Retry.' }, 503)
    }
    const records = data.records.map((input: unknown) => {
      if (!object(input) || typeof input.importedAt !== 'string' || !Number.isFinite(Date.parse(input.importedAt))) return null
      const { importedAt, ...values } = input
      const record = validateExportRecord(values, selection)
      return record ? { ...record, importedAt } : null
    })
    const range = data.range
    const receipts = data.receipts.map(input => receipt(input, selection))
    if (records.some((record: unknown) => !record) || (data.total === 0 ? range !== null : !object(range) || typeof range.startAt !== 'string' || typeof range.endAt !== 'string' || !Number.isFinite(Date.parse(range.startAt)) || !Number.isFinite(Date.parse(range.endAt)))) {
      return json({ error: 'Saved imported records could not be confirmed. Retry.' }, 503)
    }
    if (receipts.some(input => !input)) return json({ error: 'Saved import confirmations could not be confirmed. Retry.' }, 503)
    const nextOffset = Number(cursor) + records.length
    return json({ date: selection.date, timezone: selection.timezone, records, total: data.total,
      counts: { heart_rate: data.counts.heart_rate, resting_heart_rate: data.counts.resting_heart_rate },
      range: object(range) ? { startAt: range.startAt, endAt: range.endAt } : null, receipts,
      nextCursor: records.length && nextOffset < Number(data.total) ? String(nextOffset) : null, provenance })
  } catch { return json({ error: 'Saved imported records could not be loaded. Retry.' }, 503) }
}
