import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateProgram } from '@/lib/program/generateProgram'
import { evaluateSafetyEscalation } from '@/lib/safety/evaluateSafetyEscalation'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { getStrengthAssessmentPeriod } from '@/lib/assessment/getStrengthAssessmentStatus'
import { getClientTimeZone, localDateKey } from '@/lib/timezone'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'
import { savedLegacyStrength, savedStrengthSession, strengthValues, validateStrengthCompletion } from '@/lib/assessments/strengthAssessment'

export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const validPeriod = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)
const fail = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => json({ error, code, ...extra }, status)

async function context() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { response: fail(401, 'unauthorized', 'Sign in again to save or load your assessment.') } as const
  const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).single()
  if (clientError || !client) return { response: fail(404, 'profile_missing', 'Your member profile could not be loaded. Please try again.') } as const
  return { supabase, user, client, currentPeriod: getStrengthAssessmentPeriod(client) } as const
}

export async function GET(req: Request) {
  try {
    const ctx = await context(); if ('response' in ctx) return ctx.response
    const { supabase, user, client, currentPeriod } = ctx
    const query = new URL(req.url).searchParams, requested = query.get('period'), assessmentId = query.get('assessmentId')
    if (requested && !validPeriod(requested)) return fail(400, 'validation', 'Choose a valid assessment month.')
    const period = requested || currentPeriod
    const [year, month] = period.split('-').map(Number)
    const nextPeriod = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`
    const zone = getClientTimeZone(client), start = zonedDateTimeToUtc(period, '00:00', zone).toISOString(), end = zonedDateTimeToUtc(nextPeriod, '00:00', zone).toISOString()
    const base = () => supabase.from('assessments').select('id,data,submitted_at,assessment_period').eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('assessment_type', 'strength')
    const selectedQuery = assessmentId ? base().eq('id', assessmentId).maybeSingle() : base().or(`assessment_period.eq.${period},and(assessment_period.is.null,submitted_at.gte.${start},submitted_at.lt.${end})`).order('submitted_at', { ascending: true }).limit(1).maybeSingle()
    const [historyResult, selectedResult, sessionResult, previousResult] = await Promise.all([
      supabase.from('assessments').select('id,submitted_at,assessment_period').eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('assessment_type', 'strength').order('submitted_at', { ascending: false }).limit(100),
      selectedQuery,
      supabase.from('strength_assessment_sessions').select('*').eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('period', period).maybeSingle(),
      supabase.from('strength_assessment_sessions').select('*').eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('status', 'draft').lt('period', currentPeriod).order('period', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (historyResult.error || selectedResult.error || sessionResult.error || previousResult.error) return fail(503, 'load_failed', 'We couldn’t load your previous assessment. Retry.')
    const rowPeriod = (row: any) => validPeriod(row.assessment_period) ? row.assessment_period : localDateKey(new Date(row.submitted_at), zone).slice(0, 7) + '-01'
    const history = (historyResult.data || []).filter((row: any) => row.submitted_at).map((row: any) => ({ ...row, period: rowPeriod(row) }))
    const selected = selectedResult.data ? { ...selectedResult.data, period: rowPeriod(selectedResult.data) } : null
    if (assessmentId && !selected) return fail(404, 'not_found', 'That assessment could not be found.')
    const session = sessionResult.data
    const previous = previousResult.data && !history.some((record: any) => record.period === previousResult.data.period) ? previousResult.data : null
    return json({ period: selected?.period || period, currentPeriod, clientId: client.client_id, assessment: selected ? savedLegacyStrength(selected, selected.period) : session ? savedStrengthSession(session) : null,
      previousDraft: previous ? savedStrengthSession(previous) : null,
      history: history.map((row: any) => ({ assessmentId: row.id, assessmentDate: row.submitted_at, period: row.period, status: 'completed' })),
    })
  } catch { return fail(503, 'load_failed', 'We couldn’t load your previous assessment. Retry.') }
}

async function save(req: Request, complete: boolean) {
  try {
    const ctx = await context(); if ('response' in ctx) return ctx.response
    const { supabase, user, client, currentPeriod } = ctx
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'validation', 'Check your assessment values and try again.')
    const envelope = 'values' in body
    if ((envelope && body.expectedClientId !== client.client_id) || (!envelope && body.client_id && body.client_id !== client.client_id)) return fail(409, 'account_changed', 'Your signed-in account changed. Reopen the assessment before saving.')
    const period = envelope ? body.period : currentPeriod, revision = envelope ? body.revision : 0
    const values = strengthValues(envelope ? body.values : body)
    if (!validPeriod(period) || !Number.isSafeInteger(revision) || revision < 0 || !values) return fail(400, 'validation', 'Check your assessment values and try again.')
    if (complete) { const error = validateStrengthCompletion(values); if (error) return fail(400, 'validation', error) }

    let programJson = null, planStatus = 'existing', safetyFlags: ReturnType<typeof evaluateSafetyEscalation> = []
    if (complete) {
      const [initial, profile] = await Promise.all([
        supabase.from('assessments').select('*').eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('assessment_type', 'initial').order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('client_current_profiles').select('*').eq('client_id', client.client_id).eq('user_id', user.id).maybeSingle(),
      ])
      if (initial.error || profile.error) return fail(503, 'load_failed', 'Your saved member assessment could not be loaded. Please try again.')
      if (!initial.data) return fail(409, 'initial_required', 'Complete the initial member assessment before the strength baseline.', { redirect: '/dashboard/assessment/start' })
      const effectiveClient = profile.data ? { ...client, ...profile.data, auth_user_id: user.id } : client
      safetyFlags = evaluateSafetyEscalation({ client: effectiveClient, initialAssessment: initial.data.data, strengthAssessment: values })
      if (safetyFlags.length) planStatus = 'safety_paused'
      else { programJson = generateProgram({ client: effectiveClient, initialAssessment: initial.data.data, strengthAssessment: values }); planStatus = 'generated' }
    }
    const { data, error } = await supabase.rpc('save_strength_assessment', { p_client_id: client.client_id, p_period: period, p_expected_revision: revision, p_values: values, p_complete: complete, p_program_json: programJson })
    if (error || !data) return fail(503, 'save_failed', complete ? 'Your assessment hasn’t been confirmed as complete yet. Retry submission.' : 'Your changes haven’t been saved yet. Retry saving.')
    if (!data.success) {
      const status = data.status || 409, code = data.code === 'already_completed' ? 'conflict' : data.code || 'conflict'
      return fail(status, code, code === 'period_changed' ? 'A new month has started. Reload to start this month’s assessment.' : code === 'validation' ? 'Check your measurements before completing the assessment.' : 'Your saved assessment changed in another session. Review it before saving again.', { currentPeriod: data.currentPeriod || currentPeriod, ...(data.assessment ? { assessment: savedStrengthSession(data.assessment) } : {}) })
    }
    const assessment = savedStrengthSession(data.assessment)
    if (complete) invalidateDailyPlan()
    return json({ success: true, period, currentPeriod, clientId: client.client_id, assessment, ...(complete ? { redirect: '/dashboard/program', planStatus: data.alreadyCompleted || data.preservedNewerResults ? 'existing' : planStatus, ...(safetyFlags.length ? { safetyFlags } : {}) } : {}) })
  } catch { return fail(503, 'save_failed', complete ? 'Your assessment hasn’t been confirmed as complete yet. Retry submission.' : 'Your changes haven’t been saved yet. Retry saving.') }
}

export const PUT = (req: Request) => save(req, false)
export const POST = (req: Request) => save(req, true)
