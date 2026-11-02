import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveMembership, membershipCan, parseMembershipTier } from '@/lib/membership/policy'
import { experienceMilestone, experienceResponse, isExperienceId } from '@/lib/membership/experience'

export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

async function identity() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { response: json({ error: 'Sign in to view your membership check-ins.' }, 401) } as const
  const { data: client, error: clientError } = await supabase.from('clients').select('client_id,program,access,active,verified_purchase,subscription_ends_at,membership_expires_at').eq('auth_user_id', user.id).maybeSingle()
  if (clientError) return { response: json({ error: 'Membership check-ins could not be loaded. Please retry.' }, 503) } as const
  if (!client || !membershipCan(client, 'accountData')) return { response: json({ error: 'Your membership profile could not be verified.' }, 403) } as const
  return { supabase, client } as const
}

export async function GET() {
  try {
    const context = await identity(); if ('response' in context) return context.response
    const { supabase, client } = context
    const { data, error } = await supabase.rpc('get_membership_milestones')
    if (error || !data || typeof data.eligible !== 'boolean' || !Array.isArray(data.milestones) || data.milestones.length > 4) return json({ error: 'Membership check-ins could not be loaded. Please retry.' }, 503)
    const milestones = data.milestones.map(experienceMilestone)
    if (milestones.some((row: ReturnType<typeof experienceMilestone>) => !row) || new Set(milestones.map((row: any) => row.id)).size !== milestones.length || new Set(milestones.map((row: any) => row.months)).size !== milestones.length) return json({ error: 'Membership check-ins could not be confirmed. Please retry.' }, 503)
    const eligible = data.eligible && hasActiveMembership(client) && parseMembershipTier(client.program) !== 'free'
    return json({ clientId: client.client_id, eligible, milestones: milestones.map((row: any) => ({ ...row, can_respond: eligible && row.can_respond })) })
  } catch { return json({ error: 'Membership check-ins could not be loaded. Please retry.' }, 503) }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Open your membership check-in on Anastasis to save it.' }, 403)
    const context = await identity(); if ('response' in context) return context.response
    const { supabase, client } = context
    if (!hasActiveMembership(client) || parseMembershipTier(client.program) === 'free') return json({ error: 'This membership check-in is not available for a new response.' }, 403)
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['milestoneId','requestId','response'].includes(key)) || !isExperienceId(body.milestoneId) || !isExperienceId(body.requestId)) return json({ error: 'Review your check-in before saving.' }, 400)
    const response = experienceResponse(body.response)
    if (!response) return json({ error: 'Choose an experience rating and continuation answer. Optional comments can be up to 2,000 characters.' }, 400)
    const { data, error } = await supabase.rpc('submit_membership_milestone_feedback', { p_milestone_id: body.milestoneId, p_request_id: body.requestId, p_response: response })
    if (error) return json({ error: 'Your feedback save was not confirmed. Retry with the same entries.' }, error.code === '42501' ? 403 : error.code === '23505' ? 409 : 503)
    const milestone = experienceMilestone(data)
    if (!milestone || milestone.id !== body.milestoneId || milestone.status !== 'completed' || !milestone.feedback || JSON.stringify(milestone.feedback.response) !== JSON.stringify(response)) return json({ error: 'Your feedback save was not confirmed. Retry with the same entries.' }, 503)
    return json({ success: true, clientId: client.client_id, milestone })
  } catch { return json({ error: 'Your feedback save was not confirmed. Retry with the same entries.' }, 503) }
}
