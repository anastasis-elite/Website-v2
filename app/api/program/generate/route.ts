import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateProgram } from '@/lib/program/generateProgram'
import { evaluateSafetyEscalation } from '@/lib/safety/evaluateSafetyEscalation'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        {
          error: 'Client not found.',
          details: clientError?.message,
        },
        { status: 404 }
      )
    }

    const { data: initialAssessment } = await supabase
      .from('assessments')
      .select('*')
      .eq('client_id', clientId)
      .eq('assessment_type', 'initial')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: strengthAssessment } = await supabase
      .from('assessments')
      .select('*')
      .eq('client_id', clientId)
      .eq('assessment_type', 'strength')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!strengthAssessment) {
      return NextResponse.json(
        { error: 'Strength assessment is required before generating a program.' },
        { status: 400 }
      )
    }

    const safetyFlags = evaluateSafetyEscalation({
      client,
      initialAssessment: initialAssessment?.data || initialAssessment,
      strengthAssessment: strengthAssessment?.data || strengthAssessment,
    })

    if (safetyFlags.length) {
      if (client.auth_user_id) {
        await supabase.from('recommendation_audit_logs').insert({
          user_id: client.auth_user_id,
          recommendation_type: 'program_generation_safety_escalation',
          input_reference: `client:${clientId}`,
          engine_version: 'safety_v1.0',
          recommendation_output: { blocked: true },
          confidence_level: 'keyword_safety_rule',
          safety_flags: safetyFlags,
        })
      }
      return NextResponse.json({
        error: 'Program generation paused for a safety signal.',
        safetyFlags,
        action: 'Seek appropriate medical or emergency care before continuing.',
      }, { status: 409 })
    }

    const generatedProgram = generateProgram({
      client,
      initialAssessment: initialAssessment?.data || initialAssessment,
      strengthAssessment: strengthAssessment?.data || strengthAssessment,
    })

    const { data: savedProgram, error: saveError } = await supabase
      .from('program_outputs')
      .insert({
        client_id: clientId,
        program: client.program,
        output: generatedProgram,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (saveError) {
      return NextResponse.json(
        {
          error: 'Program generated but failed to save.',
          details: saveError.message,
        },
        { status: 500 }
      )
    }

    if (client.auth_user_id) {
      await supabase.from('recommendation_audit_logs').insert({
        user_id: client.auth_user_id,
        recommendation_type: 'program_generation',
        input_reference: `assessments:${initialAssessment?.id || 'none'},${strengthAssessment.id}`,
        input_snapshot: { client_id: clientId, program: client.program },
        engine_version: 'program_generator_v1.0',
        recommendation_output: generatedProgram,
        confidence_level: 'rules_based',
        safety_flags: [],
      })
    }

    return NextResponse.json({
      success: true,
      redirect: '/dashboard/program',
      program: generatedProgram,
      savedProgram,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Program generation route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
