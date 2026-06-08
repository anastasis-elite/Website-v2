import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAssessmentWindow } from '@/lib/assessments/getAssessmentWindow'

export const runtime = 'nodejs'

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
        { error: 'You must be logged in to submit an assessment.' },
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
        assessment_type: 'initial',
        data: body,
        source: 'dashboard-assessment',
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
      intake: {
        ...(currentAssessmentData as any).intake,
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
            25
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
          completion_percent: 25,
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

    return NextResponse.json({
      success: true,
      redirect: '/dashboard/assessment/start2',
    })
  } catch (error) {
    console.error('ASSESSMENT API ERROR:', error)

    const message =
      error instanceof Error ? error.message : 'Assessment submission failed'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
