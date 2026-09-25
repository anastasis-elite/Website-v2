import { NextResponse } from 'next/server'
import { getSupplementRecommendation } from '@/lib/nutrition/getSupplementRecommendation'
import { safeErrorResponse } from '@/lib/security/http'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId') || ''
    const includeDebug = searchParams.get('debug') === '1'

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
      .select('*')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!client) {
      return safeErrorResponse('Client not found.', 404)
    }

    const result = await getSupplementRecommendation({
      supabase,
      user,
      client,
      includeAdminDebug: includeDebug,
    })

    return NextResponse.json(result)
  } catch (error) {
    return safeErrorResponse('Supplement recommendation could not be loaded.', 500, error)
  }
}
