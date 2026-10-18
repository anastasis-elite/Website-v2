import { NextResponse } from 'next/server'
import { getNutrientInsights } from '@/lib/nutrition/getNutrientInsights'
import { safeErrorResponse } from '@/lib/security/http'
import { createClient } from '@/lib/supabase/server'
import { canTrackMicronutrients } from '@/lib/nutrition/memberNutrition'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId') || ''

    if (!clientId) {
      return safeErrorResponse('Missing client.', 400)
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return safeErrorResponse('Unauthorized', 401)
    }

    const { data: client } = await supabase
      .from('clients')
      .select('client_id,program')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!client) {
      return safeErrorResponse('Client not found.', 404)
    }
    if (!canTrackMicronutrients(client.program)) {
      return safeErrorResponse('Micronutrient guidance requires IGNITE or PHOENIX.', 403)
    }

    const insights = await getNutrientInsights({
      supabase,
      userId: user.id,
      clientId,
      limit: 3,
    })

    return NextResponse.json({
      insights: insights.map((insight) => ({
        nutrientKey: insight.nutrientKey,
        nutrientName: insight.nutrientName,
        action: insight.action,
        confidenceCategory: insight.confidenceCategory,
        patternState: insight.patternState,
        message: insight.message,
        why: insight.why,
        foodFirst: insight.foodFirst,
        clinicianEscalation: insight.clinicianEscalation,
        safetyEscalationReason: insight.safetyEscalationReason,
      })),
    })
  } catch (error) {
    return safeErrorResponse('Nutrient insights could not be loaded.', 500, error)
  }
}
