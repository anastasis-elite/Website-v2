import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postureLandmarkDefinitions, type AssessmentView, type PostureLandmark } from '@/lib/posture/landmarks'
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

function manualSubmission(body: any, view: AssessmentView) {
  const definitions = postureLandmarkDefinitions(view)
  if (!Array.isArray(body.landmarks) || body.landmarks.length !== definitions.length ||
    !Array.isArray(body.rawLandmarks) || body.rawLandmarks.length ||
    !Number.isSafeInteger(body.imageWidth) || body.imageWidth <= 0 ||
    !Number.isSafeInteger(body.imageHeight) || body.imageHeight <= 0) return null
  const byName = new Map(body.landmarks.map((landmark: any) => [landmark?.name, landmark]))
  if (byName.size !== definitions.length) return null
  const landmarks: PostureLandmark[] = []
  for (const definition of definitions) {
    const value = byName.get(definition.name) as any
    if (!value || value.view !== view || value.side !== definition.side || value.visible !== definition.visible ||
      value.automatic !== null || value.lowConfidence !== undefined && value.lowConfidence !== false) return null
    const point = value.confirmed
    if (point !== null && (!definition.visible || !point || typeof point.x !== 'number' || typeof point.y !== 'number' ||
      !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1 ||
      point.confidence !== undefined && point.confidence !== null)) return null
    if (value.manuallyAdjusted !== Boolean(point)) return null
    landmarks.push({ ...definition, automatic: null, confirmed: point ? { x: point.x, y: point.y } : null,
      manuallyAdjusted: Boolean(point), lowConfidence: false })
  }
  const visibleCount = landmarks.filter(landmark => landmark.visible).length
  const confirmedCount = landmarks.filter(landmark => landmark.visible && landmark.confirmed).length
  return confirmedCount ? { landmarks, visibleCount, confirmedCount, complete: confirmedCount === visibleCount } : null
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
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
    let landmarks = Array.isArray(body.landmarks) ? body.landmarks as PostureLandmark[] : []

    if (!assessmentPhotoId || !['front', 'back', 'left', 'right'].includes(view)) {
      return NextResponse.json({ error: 'Missing assessment photo or view.' }, { status: 400 })
    }

    if (!landmarks.length) {
      return NextResponse.json({ error: 'No landmarks were provided.' }, { status: 400 })
    }

    const selectedView = view as AssessmentView
    const manual = body.detectionStatus === 'manual' ? manualSubmission(body, selectedView) : null
    if (body.detectionStatus === 'manual' && !manual) {
      return NextResponse.json({ error: 'Place at least one visible landmark and review this view before saving. Unplaced points stay unknown.' }, { status: 400 })
    }
    if (manual) landmarks = manual.landmarks

    const { data: photo, error: photoError } = await supabase
      .from('assessment_photos')
      .select('id,client_id,auth_user_id,front_photo_url,back_photo_url,left_photo_url,right_photo_url,landmark_metadata,posture_landmarks_confirmed_at')
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

    const photoPathColumn = `${selectedView}_photo_url` as const
    if (manual && (typeof photo[photoPathColumn] !== 'string' || body.path !== photo[photoPathColumn])) {
      return NextResponse.json({ error: 'The selected photo view could not be confirmed. Reload the photo before saving.' }, { status: 409 })
    }

    let previousByName = new Map<string, any>()
    if (manual) {
      const { data: previous, error: previousError } = await supabase.from('posture_photo_landmarks')
        .select('landmark_name,automatic_x,automatic_y,detection_confidence,detection_status,detection_metadata')
        .eq('assessment_photo_id', assessmentPhotoId).eq('assessment_view', view)
        .eq('client_id', photo.client_id).eq('auth_user_id', user.id)
      if (previousError) return NextResponse.json({ error: 'Previous landmark records could not be confirmed. Please retry.' }, { status: 500 })
      previousByName = new Map((previous || []).map((row: any) => [row.landmark_name, row]))
    }

    const now = new Date().toISOString()
    const rows = landmarks.map((landmark) => {
      const previous = previousByName.get(landmark.name)
      const previousMetadata = object(previous?.detection_metadata)
      const previousDetection = previous && !String(previous.detection_status || '').startsWith('manual_')
        ? { status: previous.detection_status || null, metadata: previousMetadata }
        : previousMetadata.previous_detection
      return {
        assessment_photo_id: assessmentPhotoId,
        client_id: photo.client_id,
        auth_user_id: user.id,
        assessment_view: view,
        landmark_name: landmark.name,
        anatomical_side: landmark.side,
        automatic_x: manual ? previous?.automatic_x ?? null : normalized(landmark.automatic)?.x ?? null,
        automatic_y: manual ? previous?.automatic_y ?? null : normalized(landmark.automatic)?.y ?? null,
        confirmed_x: normalized(landmark.confirmed)?.x ?? null,
        confirmed_y: normalized(landmark.confirmed)?.y ?? null,
        detection_confidence: manual ? previous?.detection_confidence ?? null : normalized(landmark.automatic)?.confidence ?? null,
        manually_adjusted: Boolean(landmark.manuallyAdjusted),
        visible: Boolean(landmark.visible),
        low_confidence: Boolean(landmark.lowConfidence),
        image_width: Number(body.imageWidth) || null,
        image_height: Number(body.imageHeight) || null,
        detection_status: manual ? manual.complete ? 'manual_confirmed' : 'manual_partial' : String(body.detectionStatus || 'unknown'),
        detection_metadata: manual ? {
          placement_method: 'manual', imagePath: body.path || null, rawLandmarks: [],
          confirmed_count: manual.confirmedCount, visible_count: manual.visibleCount, complete: manual.complete,
          ...(previousDetection ? { previous_detection: previousDetection } : {}),
        } : {
          message: body.detectionMessage || null,
          imagePath: body.path || null,
          rawLandmarks: Array.isArray(body.rawLandmarks) ? body.rawLandmarks : [],
        },
        finalized_at: now,
        updated_at: now,
      }
    })

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

    const metadata = object(photo.landmark_metadata)
    const manualViews = manual ? { ...object(metadata.manual_views), [view]: {
      complete: manual.complete, confirmed_count: manual.confirmedCount, visible_count: manual.visibleCount, reviewed_at: now,
    } } : null
    const uploadedViews = (['front', 'back', 'left', 'right'] as const).filter(key => photo[`${key}_photo_url`])
    const allViewsComplete = manual ? uploadedViews.length > 0 && uploadedViews.every(key => manualViews?.[key]?.complete === true) : true
    const { error: photoUpdateError } = await supabase
      .from('assessment_photos')
      .update({
        landmark_status: manual && !allViewsComplete ? 'partial' : 'confirmed',
        ...(!manual || allViewsComplete ? { posture_landmarks_confirmed_at: now } : {}),
        landmark_metadata: manual ? {
          ...metadata, placement_method: 'manual', last_reviewed_view: view,
          ...(manual.complete ? { last_confirmed_view: view } : {}),
          detection_status: manual.complete ? 'manual_confirmed' : 'manual_partial',
          image_width: body.imageWidth, image_height: body.imageHeight, manual_views: manualViews,
        } : {
          last_confirmed_view: view,
          detection_status: body.detectionStatus || null,
          image_width: Number(body.imageWidth) || null,
          image_height: Number(body.imageHeight) || null,
        },
      })
      .eq('id', assessmentPhotoId)
      .eq('auth_user_id', user.id)

    if (photoUpdateError) return NextResponse.json({ error: 'Landmarks were recorded but the photo review could not be confirmed. Please retry.' }, { status: 500 })

    return NextResponse.json({ success: true, saved: rows.length, ...(manual ? {
      complete: manual.complete, allViewsComplete, confirmedCount: manual.confirmedCount, visibleCount: manual.visibleCount,
    } : {}) })
  } catch (error) {
    console.error('LANDMARK SAVE ERROR:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Landmark save failed.' },
      { status: 500 },
    )
  }
}
