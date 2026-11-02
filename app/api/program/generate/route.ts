import { NextResponse } from 'next/server'
import { generateProgram } from '@/lib/program/generateProgram'
import { evaluateSafetyEscalation } from '@/lib/safety/evaluateSafetyEscalation'
import { createClient } from '@/lib/supabase/server'
import { parseJsonObject, safeErrorResponse } from '@/lib/security/http'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { logRecommendationAudit } from '@/lib/legal/logRecommendationAudit'
import { getSavedPlanState } from '@/lib/program/getSavedPlanState'
import { membershipCan } from '@/lib/membership/policy'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'

function savedResponse(saved: any, replayed = false) {
  return NextResponse.json({ success: true, replayed, redirect: '/dashboard/program',
    program: { program: saved.program_json.program, days: saved.program_json.days },
    savedProgram: { id: saved.id, generated_at: saved.generated_at },
  })
}

export async function POST(req: Request) {
  try {
    const body = parseJsonObject(await req.json().catch(() => null))
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return safeErrorResponse('Unauthorized', 401)

    const clientId = body.client_id || body.clientId

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing client_id.' },
        { status: 400 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found.' },
        { status: 404 }
      )
    }
    if (!membershipCan(client, 'generatedCoaching')) return safeErrorResponse('Generated plans are not included in this membership.', 403)

    const repairId = body.repair_output_id
    let repairedOutputId: string | undefined
    if (repairId !== undefined) {
      if (typeof repairId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(repairId)) return safeErrorResponse('Choose a valid saved plan to repair.', 400)
      // The authenticated client gate above and existing output RLS retain
      // ownership for legacy rows whose auth_user_id was never populated.
      const ownedOutputs = () => supabase.from('program_outputs').select('*').eq('client_id', client.client_id).eq('program', client.program).or(`auth_user_id.eq.${user.id},auth_user_id.is.null`)
      const { data: prior, error: priorError } = await ownedOutputs().eq('id', repairId).maybeSingle()
      if (priorError) return safeErrorResponse('Your saved plan could not be loaded. Please retry.', 503)
      if (!prior) return safeErrorResponse('Saved plan not found.', 404)
      if (getSavedPlanState(prior).status !== 'incomplete') return safeErrorResponse('This saved plan does not need an unavailable-day repair.', 409)
      const { data: latest, error: latestError } = await ownedOutputs().order('generated_at', { ascending: false }).limit(1).maybeSingle()
      if (latestError || !latest) return safeErrorResponse('Your latest saved plan could not be loaded. Please retry.', 503)
      if (latest.id !== repairId) {
        if (getSavedPlanState(latest).status === 'ready') return savedResponse(latest, true)
        return safeErrorResponse('Your saved plan changed. Reload before repairing the latest plan.', 409)
      }
      // Existing output primary-key uniqueness makes concurrent/retried repair
      // saves converge without altering assessments, prior plans or workout logs.
      const hex = createHash('sha256').update(`plan-repair:v1:${user.id}:${client.client_id}:${repairId}`).digest('hex')
      repairedOutputId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
    }

    const { data: initialAssessment, error: initialError } = await supabase
      .from('assessments')
      .select('*')
      .eq('client_id', clientId)
      .eq('assessment_type', 'initial')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: strengthAssessment, error: strengthError } = await supabase
      .from('assessments')
      .select('*')
      .eq('client_id', clientId)
      .eq('assessment_type', 'strength')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: profile, error: profileError } = await supabase.from('client_current_profiles').select('*').eq('client_id', client.client_id).eq('user_id', user.id).maybeSingle()
    if (initialError || strengthError || profileError) return safeErrorResponse('Your saved assessments could not be loaded. Please try again.', 503)
    const effectiveClient = profile ? { ...client, ...profile, program: client.program, auth_user_id: user.id } : client

    if (!initialAssessment || !strengthAssessment) {
      return NextResponse.json(
        { error: 'Saved initial and strength assessments are required before generating a program.' },
        { status: 400 }
      )
    }

    const safetyFlags = evaluateSafetyEscalation({
      client: effectiveClient,
      initialAssessment: initialAssessment?.data || initialAssessment,
      strengthAssessment: strengthAssessment?.data || strengthAssessment,
    })

    if (safetyFlags.length) {
      if (client.auth_user_id) {
        await logRecommendationAudit({
          supabase,
          userId: user.id,
          clientId: client.client_id,
          recommendationType: 'program_generation_safety_escalation',
          inputReference: `client:${clientId}`,
          engineVersion: 'safety_v1.0',
          recommendationOutput: { blocked: true },
          confidenceLevel: 'keyword_safety_rule',
          safetyFlags,
        })
      }
      return NextResponse.json({
        error: 'Program generation paused for a safety signal.',
        safetyFlags,
        action: 'Seek appropriate medical or emergency care before continuing.',
      }, { status: 409 })
    }

    const generatedProgram = generateProgram({
      client: effectiveClient,
      initialAssessment: initialAssessment?.data || initialAssessment,
      strengthAssessment: strengthAssessment?.data || strengthAssessment,
    })
    if (getSavedPlanState({ program: client.program, program_json: generatedProgram }).status !== 'ready') {
      return NextResponse.json({ error: 'Your saved equipment does not yet support every training day. Review your equipment in Account, then retry. Your previous plan and history remain saved.', code: 'incomplete_plan', action: '/dashboard/account' }, { status: 409 })
    }

    const { data: savedProgram, error: saveError } = await supabase
      .from('program_outputs')
      .insert({
        ...(repairedOutputId ? { id: repairedOutputId } : {}),
        client_id: clientId,
        auth_user_id: user.id,
        program: client.program,
        status: 'generated',
        program_json: generatedProgram,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (saveError?.code === '23505' && repairedOutputId) {
      const { data: winner, error: winnerError } = await supabase.from('program_outputs').select('*').eq('id', repairedOutputId).eq('client_id', client.client_id).eq('auth_user_id', user.id).eq('program', client.program).maybeSingle()
      if (!winnerError && winner && getSavedPlanState(winner).status === 'ready') return savedResponse(winner, true)
    }
    if (saveError || !savedProgram) {
      return NextResponse.json(
        { error: 'Program generated but failed to save.' },
        { status: 500 }
      )
    }
    invalidateDailyPlan()

    if (client.auth_user_id) {
      await logRecommendationAudit({
        supabase,
        userId: user.id,
        clientId: client.client_id,
        recommendationType: 'program_generation',
        inputReference: `assessments:${initialAssessment?.id || 'none'},${strengthAssessment.id}`,
        inputSnapshot: { client_id: clientId, program: client.program },
        engineVersion: 'program_generator_v1.0',
        recommendationOutput: generatedProgram,
        confidenceLevel: 'rules_based',
        safetyFlags: [],
      })
    }

    return savedResponse(savedProgram)
  } catch (error) {
    return safeErrorResponse('Program generation route failed', 500, error)
  }
}
