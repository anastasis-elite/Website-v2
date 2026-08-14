import { createClient } from '@supabase/supabase-js'

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

export async function createMobileRequestContext(request: Request) {
  const token = getBearerToken(request)

  if (!token) {
    return { error: 'Unauthorized' as const, status: 401 as const }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    return {
      error: 'Supabase server credentials are not configured.' as const,
      status: 500 as const,
    }
  }

  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { error: 'Unauthorized' as const, status: 401 as const }
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (clientError) {
    return { error: clientError.message, status: 500 as const }
  }

  if (!client) {
    return { error: 'Client not found.' as const, status: 404 as const }
  }

  return { supabase, user, client, token }
}
