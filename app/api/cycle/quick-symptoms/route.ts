import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'

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
      symptoms,
      prominent_symptom,
      symptom_intensity,
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

    const cycleStatus = getCycleStatus(client)
    const today = new Date().toISOString().split('T')[0]

    const cleanSymptoms =
      symptoms && typeof symptoms === 'object' && !Array.isArray(symptoms)
        ? symptoms
        : {}

    const allowedIntensities = ['mild', 'moderate', 'heavy']

    const cleanSymptomEntries = Object.entries(cleanSymptoms).filter(
      ([, value]) => allowedIntensities.includes(String(value))
    )

    const finalSymptoms = Object.fromEntries(cleanSymptomEntries)

    const finalProminentSymptom =
      typeof prominent_symptom === 'string' && prominent_symptom.trim()
        ? prominent_symptom.trim()
        : Object.keys(finalSymptoms)[0] || null

    const finalSymptomIntensity =
      typeof symptom_intensity === 'string' &&
      allowedIntensities.includes(symptom_intensity)
        ? symptom_intensity
        : finalProminentSymptom && finalSymptoms[finalProminentSymptom]
        ? String(finalSymptoms[finalProminentSymptom])
        : null

    const { data: existingLog } = await supabase
      .from('cycle_logs')
      .select('*')
      .eq('client_id', client_id)
      .eq('log_date', today)
      .maybeSingle()

    const existingSymptoms =
      existingLog?.symptoms &&
      typeof existingLog.symptoms === 'object' &&
      !Array.isArray(existingLog.symptoms)
        ? existingLog.symptoms
        : {}

    const mergedSymptoms = {
      ...existingSymptoms,
      ...finalSymptoms,
    }

    const { error: upsertError } = await supabase
      .from('cycle_logs')
      .upsert(
        {
          client_id,
          auth_user_id: user.id,
          log_date: today,

          cycle_day: cycleStatus.cycleDay,
          cycle_phase: cycleStatus.phase,

          symptoms: mergedSymptoms,
          prominent_symptom: finalProminentSymptom,
          symptom_intensity: finalSymptomIntensity,

          updated_at: new Date().toISOString(),
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

    return NextResponse.json({
      success: true,
      cycle_day: cycleStatus.cycleDay,
      cycle_phase: cycleStatus.phase,
      symptoms: mergedSymptoms,
      prominent_symptom: finalProminentSymptom,
      symptom_intensity: finalSymptomIntensity,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Cycle symptoms could not be saved',
      },
      { status: 500 }
    )
  }
}
