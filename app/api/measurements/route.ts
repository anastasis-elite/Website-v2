import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const {
      client_id,
      advanced_enabled,
      measurements,
      notes,
    } = body

    if (!client_id) {
      return NextResponse.json(
        { error: 'Missing client_id' },
        { status: 400 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError) {
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 }
      )
    }

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found for this user' },
        { status: 404 }
      )
    }

    const now = new Date()
    const submittedAt = now.toISOString()
    const today = submittedAt.split('T')[0]

    const cleanMeasurements =
      measurements &&
      typeof measurements === 'object' &&
      !Array.isArray(measurements)
        ? measurements
        : {}

    const cleanNotes =
      typeof notes === 'string' && notes.trim()
        ? notes.trim()
        : null

    const { error: upsertError } = await supabase
      .from('measurement_logs')
      .upsert(
        {
          client_id,
          auth_user_id: user.id,
          log_date: today,
          advanced_enabled: !!advanced_enabled,
          measurements: cleanMeasurements,
          notes: cleanNotes,
          updated_at: submittedAt,
        },
        {
          onConflict: 'client_id,log_date',
        }
      )

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
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
      measurements: {
        ...(currentAssessmentData as any).measurements,
        log_date: today,
        advanced_enabled: !!advanced_enabled,
        measurements: cleanMeasurements,
        notes: cleanNotes,
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
            60
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
          completion_percent: 60,
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
      log_date: today,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Measurements could not be saved',
      },
      { status: 500 }
    )
  }
}
