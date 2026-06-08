import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateProgram } from '@/lib/program/generateProgram'
import { getAssessmentWindow } from '@/lib/assessments/getAssessmentWindow'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to submit this assessment.' },
        { status: 401 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client profile not found.' },
        { status: 404 }
      )
    }

    const submittedAt = new Date().toISOString()

    const { error: assessmentInsertError } = await supabase
      .from('assessments')
      .insert({
        client_id: client.client_id,
        auth_user_id: user.id,
        program: client.program || '',
        assessment_type: 'strength',
        data: body,
        source: 'strength-assessment',
        submitted_at: submittedAt,
      })

    if (assessmentInsertError) {
      return NextResponse.json(
        { error: assessmentInsertError.message },
        { status: 500 }
      )
    }

    const window = getAssessmentWindow(client)

    const { data: existingWindow, error: existingWindowError } = await supabase
      .from('assessment_windows')
      .select('*')
      .eq('client_id', client.client_id)
      .eq('window_type', window.windowType)
      .eq('estimated_start_date', window.estimatedStartDate)
      .maybeSingle()

    if (existingWindowError) {
      return NextResponse.json(
        { error: existingWindowError.message },
        { status: 500 }
      )
    }

    const currentAssessmentData =
      existingWindow?.assessment_data &&
      typeof existingWindow.assessment_data === 'object'
        ? existingWindow.assessment_data
        : {}

    const mergedAssessmentData = {
      ...currentAssessmentData,
      strength: {
        ...(currentAssessmentData as any).strength,
        ...body,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      },
    }

    if (existingWindow) {
      const { error: windowUpdateError } = await supabase
        .from('assessment_windows')
        .update({
          status: window.isOpen ? 'open' : window.status,
          estimated_start_date: window.estimatedStartDate,
          estimated_end_date: window.estimatedEndDate,
          assessment_data: mergedAssessmentData,
          completion_percent: Math.max(
            Number(existingWindow.completion_percent || 0),
            50
          ),
          updated_at: submittedAt,
        })
        .eq('id', existingWindow.id)

      if (windowUpdateError) {
        return NextResponse.json(
          { error: windowUpdateError.message },
          { status: 500 }
        )
      }
    } else {
      const { error: windowInsertError } = await supabase
        .from('assessment_windows')
        .insert({
          client_id: client.client_id,
          auth_user_id: user.id,
          window_type: window.windowType,
          estimated_start_date: window.estimatedStartDate,
          estimated_end_date: window.estimatedEndDate,
          status: window.isOpen ? 'open' : window.status,
          assessment_data: mergedAssessmentData,
          completion_percent: 50,
          created_at: submittedAt,
          updated_at: submittedAt,
        })

      if (windowInsertError) {
        return NextResponse.json(
          { error: windowInsertError.message },
          { status: 500 }
        )
      }
    }

    const { data: initialAssessment } = await supabase
      .from('assessments')
      .select('*')
      .eq('client_id', client.client_id)
      .eq('assessment_type', 'initial')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: strengthAssessment } = await supabase
      .from('assessments')
      .select('*')
      .eq('client_id', client.client_id)
      .eq('assessment_type', 'strength')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const generatedProgram = generateProgram({
      client,
      initialAssessment: initialAssessment?.data || null,
      strengthAssessment: strengthAssessment?.data || body,
    })

    const { error: programOutputError } = await supabase
      .from('program_outputs')
      .insert({
        client_id: client.client_id,
        auth_user_id: user.id,
        program: client.program,
        status: 'generated',
        program_json: generatedProgram,
        generated_at: submittedAt,
      })

    if (programOutputError) {
      return NextResponse.json(
        { error: programOutputError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      redirect: '/dashboard/program',
      program: generatedProgram,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Assessment strength route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
