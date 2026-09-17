import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('client_id, program')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  }

  if (!getTierCapabilities(client.program).nutritionPhotoMacroEstimation) {
    return NextResponse.json({ error: 'Photo macro estimation is only available for PHOENIX.' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const photo = formData?.get('photo')

  if (!(photo instanceof File) || photo.size <= 0) {
    return NextResponse.json({ error: 'Attach a meal photo to estimate nutrition.' }, { status: 400 })
  }

  return NextResponse.json(
    {
      configured: false,
      error: 'Photo analysis is not configured yet. Connect and test a vision nutrition estimation service before enabling photo-derived estimates.',
      disclaimer:
        'Photo-based nutrition estimates are approximations. Portion size, ingredients, preparation methods, sauces, oils, brands, and other factors can significantly change calorie and macronutrient values. For the most accurate nutrition tracking, measure or weigh your food and verify nutrition information when available.',
    },
    { status: 501 },
  )
}
