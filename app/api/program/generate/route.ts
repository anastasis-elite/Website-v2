import { NextResponse } from 'next/server'
import { generateProgram } from '@/lib/program/generateProgram'
import { evaluateSafetyEscalation } from '@/lib/safety/evaluateSafetyEscalation'
import { createClient } from '@/lib/supabase/server'
import { parseJsonObject, safeErrorResponse } from '@/lib/security/http'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { logRecommendationAudit } from '@/lib/legal/logRecommendationAudit'

export const runtime = 'nodejs'

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
    const effectiveClient = profile ? { ...client, ...profile, auth_user_id: user.id } : client

    if (!strengthAssessment) {
      return NextResponse.json(
        { error: 'Strength assessment is required before generating a program.' },
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

    const { data: savedProgram, error: saveError } = await supabase
      .from('program_outputs')
      .insert({
        client_id: clientId,
        auth_user_id: user.id,
        program: client.program,
        status: 'generated',
        program_json: generatedProgram,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (saveError) {
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

    return NextResponse.json({
      success: true,
      redirect: '/dashboard/program',
      program: {
        program: generatedProgram.program,
        days: generatedProgram.days,
      },
      savedProgram: {
        id: savedProgram.id,
        generated_at: savedProgram.generated_at,
      },
    })
  } catch (error) {
    return safeErrorResponse('Program generation route failed', 500, error)
  }
}
