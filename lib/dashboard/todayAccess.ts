import 'server-only'

import { redirect } from 'next/navigation'
import { after, NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import { hasCurrentLegalAcceptance } from '@/lib/legal/hasCurrentLegalAcceptance'
import { evaluateSafetyEscalation, type SafetyFlag } from '@/lib/safety/evaluateSafetyEscalation'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'
import { logRecommendationAudit } from '@/lib/legal/logRecommendationAudit'
import { getDashboardStartupTiming } from '@/lib/performance/dashboardStartupRequest'

export class TodayAccessError extends Error {
  constructor(message: string, public status: number, public redirect?: string, public flags?: SafetyFlag[]) {
    super(message)
    this.name = 'TodayAccessError'
  }
}

/** Every startup API verifies current access itself. The dashboard layout's
 * checks do not protect an independently requested API URL. */
export type TodayAccessExpectation = { program?: string; clientId?: string; ownerUserId?: string; date?: string; timezone?: string }

export async function getTodayAccessContext(expected: TodayAccessExpectation = {}) {
  const timings = getDashboardStartupTiming()
  const context = await getDashboardContext()
  const { supabase, user, client } = context
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id) {
    throw new TodayAccessError('Your account could not be verified. Please sign in again.', 401, '/login')
  }
  const program = client.program || 'ignite'
  if (!['ember', 'ignite', 'phoenix'].includes(program)) redirect('/dashboard')
  if (expected.ownerUserId && expected.ownerUserId !== user.id || expected.clientId && expected.clientId !== client.client_id) {
    throw new TodayAccessError('Your signed-in account changed. Open Today again.', 401, '/dashboard')
  }
  if (expected.program && expected.program !== program) redirect(`/dashboard/program/${program}`)
  if (process.env.LEGAL_GATE_ENABLED === 'true' && !(await hasCurrentLegalAcceptance(supabase, user.id))) {
    redirect('/legal/acceptance')
  }
  // Safety is a prerequisite, so a failed read must not be treated as no flags.
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  let safety
  try {
    safety = await timings.measure('safety', () => supabase.from('client_symptom_logs')
      .select('severity, notes, created_at, symptom_types(name, category)')
      .eq('client_id', client.client_id).eq('auth_user_id', user.id)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(25))
  } catch {
    throw new TodayAccessError('Your safety status could not be verified. Try again.', 503)
  }
  if (safety.error) throw new TodayAccessError('Your safety status could not be verified. Try again.', 503)
  const flags = evaluateSafetyEscalation(safety.data || [])
  if (flags.length) {
    after(() => logRecommendationAudit({
      supabase, userId: user.id, clientId: client.client_id, recommendationType: 'dashboard_safety_escalation',
      inputReference: `client_symptom_logs:${client.client_id}`, engineVersion: 'safety_v1.0',
      recommendationOutput: { blocked: true }, safetyFlags: flags,
    }))
    throw new TodayAccessError('Review your current safety guidance before continuing.', 409, `/dashboard/program/${program}`, flags)
  }
  if (expected.date && expected.date !== getClientLocalDate(client) || expected.timezone && expected.timezone !== getClientTimeZone(client)) {
    throw new TodayAccessError('Your local day or timezone changed. Open Today again.', 409, `/dashboard/program/${program}`)
  }
  return { ...context, program: program as ProgramTier }
}

export function todayAccessExpectation(request: Request): TodayAccessExpectation {
  const params = new URL(request.url).searchParams
  return Object.fromEntries(['program', 'clientId', 'ownerUserId', 'date', 'timezone']
    .map(key => [key, params.get(key) || undefined]))
}

export function todayAccessError(error: unknown, fallback: string) {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (error instanceof TodayAccessError) {
    return NextResponse.json({ error: error.message, ...(error.redirect ? { redirect: error.redirect } : {}),
      ...(error.flags ? { safetyFlags: error.flags } : {}) }, { status: error.status, headers })
  }
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : ''
  if (digest.startsWith('NEXT_REDIRECT;')) {
    const destination = digest.split(';').slice(2, -2).join(';')
    return NextResponse.json({ error: destination === '/login' ? 'Please sign in to continue.' : 'Complete required account setup to continue.',
      redirect: destination }, { status: destination === '/login' ? 401 : 403, headers })
  }
  return NextResponse.json({ error: fallback }, { status: 503, headers })
}
