import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PostureLandmark } from '@/lib/posture/landmarks'
import { clamp01 } from '@/lib/posture/geometry'
import { getTierCapabilities } from '@/lib/entitlements'

export const runtime = 'nodejs'

function normalized(point: any) {
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return null
  return {
    x: clamp01(point.x),
    y: clamp01(point.y),
    confidence: typeof point.confidence === 'number' ? point.confidence : null,
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const assessmentPhotoId = String(body.assessmentPhotoId || '')
    const view = String(body.view || '')
    const landmarks = Array.isArray(body.landmarks) ? body.landmarks as PostureLandmark[] : []

    if (!assessmentPhotoId || !['front', 'back', 'left', 'right'].includes(view)) {
      return NextResponse.json({ error: 'Missing assessment photo or view.' }, { status: 400 })
    }

    if (!landmarks.length) {
      return NextResponse.json({ error: 'No landmarks were provided.' }, { status: 400 })
    }

    const { data: photo, error: photoError } = await supabase
      .from('assessment_photos')
      .select('id, client_id, auth_user_id')
      .eq('id', assessmentPhotoId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: 'Assessment photo not found.', details: photoError?.message },
        { status: 404 },
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('client_id, program')
      .eq('client_id', photo.client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    if (!getTierCapabilities(client.program).postureAssessment) {
      return NextResponse.json({ error: 'Posture assessment is not available for this tier.' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const rows = landmarks.map((landmark) => ({
      assessment_photo_id: assessmentPhotoId,
      client_id: photo.client_id,
      auth_user_id: user.id,
      assessment_view: view,
      landmark_name: landmark.name,
      anatomical_side: landmark.side,
      automatic_x: normalized(landmark.automatic)?.x ?? null,
      automatic_y: normalized(landmark.automatic)?.y ?? null,
      confirmed_x: normalized(landmark.confirmed)?.x ?? null,
      confirmed_y: normalized(landmark.confirmed)?.y ?? null,
      detection_confidence: normalized(landmark.automatic)?.confidence ?? null,
      manually_adjusted: Boolean(landmark.manuallyAdjusted),
      visible: Boolean(landmark.visible),
      low_confidence: Boolean(landmark.lowConfidence),
      image_width: Number(body.imageWidth) || null,
      image_height: Number(body.imageHeight) || null,
      detection_status: String(body.detectionStatus || 'unknown'),
      detection_metadata: {
        message: body.detectionMessage || null,
        imagePath: body.path || null,
        rawLandmarks: Array.isArray(body.rawLandmarks) ? body.rawLandmarks : [],
      },
      finalized_at: now,
      updated_at: now,
    }))

    const { error: upsertError } = await supabase
      .from('posture_photo_landmarks')
      .upsert(rows, {
        onConflict: 'assessment_photo_id,assessment_view,landmark_name',
      })

    if (upsertError) {
      return NextResponse.json(
        { error: 'Could not save landmarks.', details: upsertError.message },
        { status: 500 },
      )
    }

    await supabase
      .from('assessment_photos')
      .update({
        landmark_status: 'confirmed',
        posture_landmarks_confirmed_at: now,
        landmark_metadata: {
          last_confirmed_view: view,
          detection_status: body.detectionStatus || null,
          image_width: Number(body.imageWidth) || null,
          image_height: Number(body.imageHeight) || null,
        },
      })
      .eq('id', assessmentPhotoId)
      .eq('auth_user_id', user.id)

    return NextResponse.json({ success: true, saved: rows.length })
  } catch (error) {
    console.error('LANDMARK SAVE ERROR:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Landmark save failed.' },
      { status: 500 },
    )
  }
}
