import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveWeekdayMusclePreferences } from '@/lib/program/saveWeekdayMusclePreferences'
import { isPreferenceDate, parseWeekdayMuscleChoice, validPreferenceOperationId } from '@/lib/program/weekdayMusclePreferences'

export const dynamic = 'force-dynamic'
const maxBytes = 12 * 1024
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
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
    return JSON.parse(text + decoder.decode())
  } finally { reader.releaseLock() }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin') return json({ error: 'Open workout preferences on Anastasis before saving.', code: 'FORBIDDEN' }, 403)
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Send the weekday preference form.', code: 'INVALID_PREFERENCES' }, 415)
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return json({ error: 'Sign in to save your workout preferences.', code: 'SIGN_IN' }, 401)
    let body: unknown
    try { body = await boundedJson(request) } catch (error) { return json({ error: 'The preference form could not be read.', code: 'INVALID_PREFERENCES' }, error instanceof Error && error.message === 'too_large' ? 413 : 400) }
    if (!object(body) || Object.keys(body).some(key => !['expectedClientId', 'expectedUserId', 'expectedDate', 'expectedRevision', 'operationId', 'choice'].includes(key))) return json({ error: 'Review the preference form before saving.', code: 'INVALID_PREFERENCES' }, 400)
    const choice = parseWeekdayMuscleChoice(body.choice)
    if (!choice || typeof body.expectedClientId !== 'string' || !body.expectedClientId || body.expectedClientId.length > 200 || typeof body.expectedUserId !== 'string' || !body.expectedUserId || body.expectedUserId.length > 200 || !isPreferenceDate(body.expectedDate) || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0 || Number(body.expectedRevision) >= Number.MAX_SAFE_INTEGER || !validPreferenceOperationId(body.operationId)) return json({ error: 'Review the weekday choices and try again.', code: 'INVALID_PREFERENCES' }, 400)
    const result = await saveWeekdayMusclePreferences({ supabase, user, input: {
      expectedClientId: body.expectedClientId, expectedUserId: body.expectedUserId, expectedDate: body.expectedDate,
      expectedRevision: Number(body.expectedRevision), operationId: body.operationId, choice,
    } })
    if (!result.ok) return json({ error: result.error, code: result.code, ...(result.issues ? { issues: result.issues } : {}) }, result.status)
    return json({ success: true, view: result.view, focusPlans: result.focusPlans, replayed: result.replayed })
  } catch { return json({ error: 'The save was not confirmed. Retry the same choice.', code: 'UNAVAILABLE' }, 503) }
}
