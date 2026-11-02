import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { hasMemberAccess } from '@/lib/commerce/access'
import { capabilityForPath, isProtectedApiPath, membershipCan, parseMembershipTier } from '@/lib/membership/policy'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const api = path.startsWith('/api/')
  // Public/auth/provider APIs retain their own boundaries and are not member middleware routes.
  if (api && !isProtectedApiPath(path)) return NextResponse.next({ request })
  // The scheduled endpoint authenticates its own server secret.
  if (path === '/api/calendars/cron') return NextResponse.next({ request })
  const capability = capabilityForPath(path, request.method, request.nextUrl.searchParams)
  if (api && !capability) return NextResponse.json({ error: 'This member operation is not configured.' }, { status: 403 })
  // Known bearer routes authenticate the token and capability in their direct server context.
  if ((path.startsWith('/api/mobile/') || /^\/api\/calendars(?:\/|$)/.test(path)) && /^Bearer\s+\S+$/i.test(request.headers.get('authorization') || '')) return NextResponse.next({ request })
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
  if (!user) {
    if (api) return withSessionCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    const url = request.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('redirect', request.nextUrl.pathname)
    return withSessionCookies(NextResponse.redirect(url))
  }
  const { data: client, error } = await supabase.from('clients').select('program,onboarding_completed,birthdate,address_line_1,city,state,postal_code,verified_purchase,access,active,subscription_ends_at,membership_expires_at,onboarding_data,timezone').eq('auth_user_id', user.id).maybeSingle()
  if (error) return withSessionCookies(NextResponse.json({ error: 'Member access could not be verified.' }, { status: 503 }))
  // Billing and support remain reachable for suspended/canceled members.
  const accountRoute = request.nextUrl.pathname.startsWith('/dashboard/account')
  const paymentIssueRoute = request.nextUrl.pathname.startsWith('/dashboard/payment-issue')
  const tier = parseMembershipTier(client?.program)
  if (path === '/api/membership/enroll') return response
  const historicalRead = api && ['GET', 'HEAD'].includes(request.method) && capability === 'accountData'
  const supportApi = api && capability === 'accountData'
  const assessmentHistoryView = !api && path === '/dashboard/assessment/start2' && capability === 'accountData' && membershipCan(client, 'accountData')
  const experienceHistoryView = !api && path === '/dashboard/experience' && request.method === 'GET' && membershipCan(client, 'accountData')
  if (tier === 'free' && !user.email_confirmed_at && !accountRoute && !paymentIssueRoute) return withSessionCookies(NextResponse.json({ error: 'Verify your email to use Community.' }, { status: 403 }))
  if (api && !membershipCan(client, capability!) && !historicalRead) return withSessionCookies(NextResponse.json({ error: 'This operation is not available for your membership.' }, { status: 403 }))
  if (!hasMemberAccess(client) && !accountRoute && !paymentIssueRoute && !historicalRead && !supportApi && !assessmentHistoryView && !experienceHistoryView) {
    if (api) return withSessionCookies(NextResponse.json({ error: 'Active membership is required. Open your account for billing help.' }, { status: 403 }))
    const url = request.nextUrl.clone(); url.pathname = '/dashboard/payment-issue'; url.search = ''
    return withSessionCookies(NextResponse.redirect(url))
  }
  if (!api && hasMemberAccess(client) && (tier === 'free' || tier === 'tracker') && capability && !membershipCan(client, capability)) {
    const url = request.nextUrl.clone(); url.pathname = tier === 'free' ? '/dashboard/community' : '/dashboard/tracker'; url.search = ''
    return withSessionCookies(NextResponse.redirect(url))
  }
  const onboardingRoute = request.nextUrl.pathname.startsWith('/dashboard/onboarding')
  const complete = Boolean(client?.onboarding_completed && client.birthdate && client.address_line_1 && client.city && client.state && client.postal_code)
  if (!api && client && ['ember','ignite','phoenix'].includes(tier || '') && !complete && !onboardingRoute && !accountRoute && !paymentIssueRoute && !assessmentHistoryView && !experienceHistoryView) {
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
    '/api/check-access', '/api/membership/:path*', '/api/tracker/:path*',
    '/api/workout-set-log', '/api/workout-feedback', '/api/workout/prescription', '/api/assessment-photos/:path*',
    '/api/calendars/:path*', '/api/daily-check-in',
    '/api/phoenix/:path*', '/api/mobile/:path*', '/api/account/:path*', '/api/billing/:path*',
    '/api/assessment-window/:path*',
  ],
}
