import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type PhotoKey = 'front' | 'back' | 'left' | 'right'

const photoKeys: PhotoKey[] = ['front', 'back', 'left', 'right']

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await req.formData()

    const assessmentType =
      String(formData.get('assessmentType') || 'monthly')

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('client_id, auth_user_id')
      .eq('auth_user_id', user.id)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        {
          error: 'Client not found',
          details: clientError?.message,
        },
        { status: 404 }
      )
    }

    const uploadedPaths: Record<string, string | null> = {
      front_photo_url: null,
      back_photo_url: null,
      left_photo_url: null,
      right_photo_url: null,
    }

    const now = new Date()
    const dateFolder = now.toISOString().split('T')[0]

    for (const key of photoKeys) {
      const file = formData.get(key)

      if (!file || !(file instanceof File)) {
        continue
      }

      const fileExt =
        file.name.split('.').pop()?.toLowerCase() || 'jpg'

      const filePath =
        `${client.client_id}/${dateFolder}/${key}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('assessment_photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        })

      if (uploadError) {
        return NextResponse.json(
          {
            error: `Failed to upload ${key} photo`,
            details: uploadError.message,
          },
          { status: 500 }
        )
      }

      uploadedPaths[`${key}_photo_url`] = filePath
    }

    const hasAnyPhoto = Object.values(uploadedPaths).some(Boolean)

    if (!hasAnyPhoto) {
      return NextResponse.json(
        { error: 'No photos uploaded' },
        { status: 400 }
      )
    }

    const { data: record, error: insertError } = await supabase
      .from('assessment_photos')
      .insert({
        client_id: client.client_id,
        auth_user_id: user.id,
        assessment_type: assessmentType,
        front_photo_url: uploadedPaths.front_photo_url,
        back_photo_url: uploadedPaths.back_photo_url,
        left_photo_url: uploadedPaths.left_photo_url,
        right_photo_url: uploadedPaths.right_photo_url,
        analysis_status: 'pending',
        uploaded_at: new Date().toISOString(),
        analysis_type: assessmentType === 'posture' ? 'posture_assessment' : 'progress_tracking',
posture_flags: {
  front_view_uploaded: Boolean(uploadedPaths.front_photo_url),
  back_view_uploaded: Boolean(uploadedPaths.back_photo_url),
  left_view_uploaded: Boolean(uploadedPaths.left_photo_url),
  right_view_uploaded: Boolean(uploadedPaths.right_photo_url),
  ready_for_posture_review:
    Boolean(uploadedPaths.front_photo_url) &&
    Boolean(uploadedPaths.back_photo_url) &&
    Boolean(uploadedPaths.left_photo_url) &&
    Boolean(uploadedPaths.right_photo_url),
},
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        {
          error: 'Failed to save photo record',
          details: insertError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      record,
    })
  } catch (error) {
    console.error('ASSESSMENT PHOTO UPLOAD ERROR:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Assessment photo upload failed',
      },
      { status: 500 }
    )
  }
}
