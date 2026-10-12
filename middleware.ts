import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { hasMemberAccess } from '@/lib/commerce/access'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  const withSessionCookies = (result: NextResponse) => {
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie))
    return result
  }
  const api = request.nextUrl.pathname.startsWith('/api/')
  if (!user) {
    if (api) return withSessionCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    const url = request.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('redirect', request.nextUrl.pathname)
    return withSessionCookies(NextResponse.redirect(url))
  }
  const { data: client, error } = await supabase.from('clients').select('program,onboarding_completed,birthdate,address_line_1,city,state,postal_code,verified_purchase,access,active,subscription_ends_at').eq('auth_user_id', user.id).maybeSingle()
  if (error) return withSessionCookies(NextResponse.json({ error: 'Member access could not be verified.' }, { status: 503 }))
  // Billing and support remain reachable for suspended/canceled members.
  const accountRoute = request.nextUrl.pathname.startsWith('/dashboard/account')
  const paymentIssueRoute = request.nextUrl.pathname.startsWith('/dashboard/payment-issue')
  if (!hasMemberAccess(client) && !accountRoute && !paymentIssueRoute) {
    if (api) return withSessionCookies(NextResponse.json({ error: 'Active membership is required. Open your account for billing help.' }, { status: 403 }))
    const url = request.nextUrl.clone(); url.pathname = '/dashboard/payment-issue'; url.search = ''
    return withSessionCookies(NextResponse.redirect(url))
  }
  const onboardingRoute = request.nextUrl.pathname.startsWith('/dashboard/onboarding')
  const complete = Boolean(client?.onboarding_completed && client.birthdate && client.address_line_1 && client.city && client.state && client.postal_code)
  if (!api && client && !complete && !onboardingRoute && !accountRoute && !paymentIssueRoute) {
    const url = request.nextUrl.clone(); url.pathname = '/dashboard/onboarding/profile'; url.search = ''
    return withSessionCookies(NextResponse.redirect(url))
  }
  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/api/nutrition/:path*', '/api/nutrition-log', '/api/today-meals',
    '/api/workout-log', '/api/program/:path*', '/api/recovery-log', '/api/recovery/:path*',
    '/api/assessment', '/api/assessment-strength', '/api/assessment/:path*',
    '/api/schedule/:path*', '/api/onboarding/:path*', '/api/cycle/:path*',
  ],
}
