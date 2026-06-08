import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAssessmentWindow } from '@/lib/assessments/getAssessmentWindow'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const {
      section,
      data,
      completionPercent,
    } = body

    if (!section || typeof section !== 'string') {
      return NextResponse.json(
        { error: 'Missing assessment section' },
        { status: 400 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: clientError?.message || 'Client not found' },
        { status: 404 }
      )
    }

    const window = getAssessmentWindow(client)

    const { data: existingWindow } = await supabase
      .from('assessment_windows')
      .select('*')
      .eq('client_id', client.client_id)
      .eq('window_type', window.windowType)
      .eq('estimated_start_date', window.estimatedStartDate)
      .maybeSingle()

    const currentAssessmentData =
      existingWindow?.assessment_data &&
      typeof existingWindow.assessment_data === 'object'
        ? existingWindow.assessment_data
        : {}

    const mergedAssessmentData = {
      ...currentAssessmentData,
      [section]: {
        ...(currentAssessmentData as any)[section],
        ...data,
        updated_at: new Date().toISOString(),
      },
    }

    const nextCompletionPercent =
      typeof completionPercent === 'number'
        ? completionPercent
        : existingWindow?.completion_percent || 0

    if (existingWindow) {
      const { data: updated, error: updateError } = await supabase
        .from('assessment_windows')
        .update({
          status: window.isOpen ? 'open' : window.status,
          estimated_start_date: window.estimatedStartDate,
          estimated_end_date: window.estimatedEndDate,
          assessment_data: mergedAssessmentData,
          completion_percent: nextCompletionPercent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWindow.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        assessmentWindow: updated,
      })
    }

    const { data: created, error: insertError } = await supabase
      .from('assessment_windows')
      .insert({
        client_id: client.client_id,
        auth_user_id: user.id,
        window_type: window.windowType,
        estimated_start_date: window.estimatedStartDate,
        estimated_end_date: window.estimatedEndDate,
        status: window.isOpen ? 'open' : window.status,
        assessment_data: mergedAssessmentData,
        completion_percent: nextCompletionPercent,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      assessmentWindow: created,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Assessment window save failed',
      },
      { status: 500 }
    )
  }
}
