import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  BODY_ASSESSMENT_FORMULA_VERSION,
  calculateRegionalCompositionEstimate,
  type RegionalMeasurementInput,
} from '@/lib/body-assessment/calculations'

const BODY_ASSESSMENT_PROTOCOL_VERSION = 'body_assessment_protocol_v1'

const regionalCircumferenceKeys: Record<string, { region: string; side: 'left' | 'right' | 'midline'; site: string }> = {
  left_upper_arm: { region: 'upper_arm', side: 'left', site: 'midpoint_circumference' },
  right_upper_arm: { region: 'upper_arm', side: 'right', site: 'midpoint_circumference' },
  left_forearm: { region: 'forearm', side: 'left', site: 'midpoint_circumference' },
  right_forearm: { region: 'forearm', side: 'right', site: 'midpoint_circumference' },
  waist: { region: 'torso_abdomen', side: 'midline', site: 'natural_waist_circumference' },
  lower_waist: { region: 'torso_abdomen', side: 'midline', site: 'lower_abdomen_circumference' },
  hips_glutes: { region: 'pelvis_hips', side: 'midline', site: 'hip_circumference' },
  left_thigh: { region: 'thigh', side: 'left', site: 'midpoint_circumference' },
  right_thigh: { region: 'thigh', side: 'right', site: 'midpoint_circumference' },
  left_calf: { region: 'lower_leg_calf', side: 'left', site: 'midpoint_circumference' },
  right_calf: { region: 'lower_leg_calf', side: 'right', site: 'midpoint_circumference' },
  bust_chest: { region: 'upper_torso', side: 'midline', site: 'bust_chest_circumference' },
  underbust: { region: 'upper_torso', side: 'midline', site: 'underbust_circumference' },
  ribcage: { region: 'upper_torso', side: 'midline', site: 'ribcage_circumference' },
}

const structuralLengthKeys: Record<string, { region: string; side: 'left' | 'right' | 'midline'; site: string }> = {
  height: { region: 'whole_body', side: 'midline', site: 'height' },
  torso_length: { region: 'torso_abdomen', side: 'midline', site: 'collarbone_upper_torso_to_hip_pelvic_landmark' },
  inseam: { region: 'lower_body', side: 'midline', site: 'inseam' },
  left_shoulder_to_elbow: { region: 'upper_arm', side: 'left', site: 'shoulder_acromion_to_elbow' },
  right_shoulder_to_elbow: { region: 'upper_arm', side: 'right', site: 'shoulder_acromion_to_elbow' },
  left_elbow_to_wrist: { region: 'forearm', side: 'left', site: 'elbow_to_wrist' },
  right_elbow_to_wrist: { region: 'forearm', side: 'right', site: 'elbow_to_wrist' },
  left_hip_to_knee: { region: 'thigh', side: 'left', site: 'hip_to_knee' },
  right_hip_to_knee: { region: 'thigh', side: 'right', site: 'hip_to_knee' },
  left_knee_to_ankle: { region: 'lower_leg_calf', side: 'left', site: 'knee_to_ankle' },
  right_knee_to_ankle: { region: 'lower_leg_calf', side: 'right', site: 'knee_to_ankle' },
}

function inchesToCm(value: number) {
  return value * 2.54
}

function cleanNumericMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [key, Number(raw)] as const)
      .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]) && entry[1] > 0),
  ) as Record<string, number>
}

function groupedRegionalInputs(measurements: Record<string, number>): RegionalMeasurementInput[] {
  const byRegion = new Map<string, RegionalMeasurementInput>()

  for (const [key, config] of Object.entries(regionalCircumferenceKeys)) {
    const value = measurements[key]
    if (!value) continue

    const id = `${config.region}:${config.side}`
    const current = byRegion.get(id) || {
      region: config.region,
      side: config.side,
    }

    current.midpointCircumferenceCm = inchesToCm(value)
    byRegion.set(id, current)
  }

  for (const [key, config] of Object.entries(structuralLengthKeys)) {
    const value = measurements[key]
    if (!value) continue

    const id = `${config.region}:${config.side}`
    const current = byRegion.get(id) || {
      region: config.region,
      side: config.side,
    }

    current.lengthCm = inchesToCm(value)
    byRegion.set(id, current)
  }

  return Array.from(byRegion.values())
}

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
      .select('client_id, auth_user_id')
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

    const today = new Date().toISOString().split('T')[0]

    const cleanMeasurements = cleanNumericMap(measurements)

    const { error: upsertError } = await supabase
      .from('measurement_logs')
      .upsert(
        {
          client_id,
          auth_user_id: user.id,
          log_date: today,
          advanced_enabled: !!advanced_enabled,
          measurements: cleanMeasurements,
          notes:
            typeof notes === 'string' && notes.trim()
              ? notes.trim()
              : null,
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

    const structuralMeasurementPresent = Object.keys(cleanMeasurements).some((key) => key in structuralLengthKeys)
    const monthlyMeasurementPresent = Object.keys(cleanMeasurements).some((key) => key in regionalCircumferenceKeys)
    const assessmentType = structuralMeasurementPresent && monthlyMeasurementPresent
      ? 'full'
      : structuralMeasurementPresent
        ? 'structural'
        : 'monthly'

    const { data: session, error: sessionError } = await supabase
      .from('body_assessment_sessions')
      .insert({
        client_id,
        user_id: user.id,
        assessment_type: assessmentType,
        status: 'completed',
        protocol_version: BODY_ASSESSMENT_PROTOCOL_VERSION,
        formula_version: BODY_ASSESSMENT_FORMULA_VERSION,
        measurement_date: today,
        scale_weight_lbs: cleanMeasurements.weight || null,
        notes:
          typeof notes === 'string' && notes.trim()
            ? notes.trim()
            : null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (sessionError) {
      return NextResponse.json(
        { error: sessionError.message },
        { status: 500 },
      )
    }

    const rawRows = Object.entries(cleanMeasurements).flatMap(([key, value]) => {
      const regional = regionalCircumferenceKeys[key]
      const structural = structuralLengthKeys[key]

      if (regional) {
        return [{
          session_id: session.id,
          client_id,
          user_id: user.id,
          measurement_group: 'regional_circumference',
          region: regional.region,
          side: regional.side,
          site: regional.site,
          value,
          unit: 'in',
          measurement_quality: 'not_recorded',
        }]
      }

      if (structural) {
        return [{
          session_id: session.id,
          client_id,
          user_id: user.id,
          measurement_group: 'structural_length',
          region: structural.region,
          side: structural.side,
          site: structural.site,
          value,
          unit: 'in',
          measurement_quality: 'not_recorded',
        }]
      }

      return []
    })

    if (rawRows.length) {
      const { error: rawError } = await supabase
        .from('body_assessment_measurements')
        .insert(rawRows)

      if (rawError) {
        return NextResponse.json(
          { error: rawError.message },
          { status: 500 },
        )
      }
    }

    const regionalResults = groupedRegionalInputs(cleanMeasurements)
      .map(calculateRegionalCompositionEstimate)
      .map((result) => ({
        session_id: session.id,
        client_id,
        user_id: user.id,
        region: result.region,
        side: result.side,
        formula_version: result.formulaVersion,
        estimate_status: result.status,
        estimated_volume_liters: result.estimatedVolumeLiters,
        estimated_subcutaneous_fat_mass_kg: result.estimatedSubcutaneousFatMassKg,
        estimated_remaining_non_fat_mass_kg: result.estimatedRemainingNonFatMassKg,
        scale_weight_reconciliation: {
          scale_weight_lbs: cleanMeasurements.weight || null,
          note: result.reconciliationNote,
        },
        quality_flags: result.qualityFlags,
      }))

    if (regionalResults.length) {
      const { error: resultError } = await supabase
        .from('body_assessment_regional_results')
        .insert(regionalResults)

      if (resultError) {
        return NextResponse.json(
          { error: resultError.message },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      success: true,
      log_date: today,
      body_assessment_session_id: session.id,
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
