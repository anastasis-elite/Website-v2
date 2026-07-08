import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const publicDashboardRoutes = [
    '/verified',
    '/create-login',
  ]

  const isPublicDashboardRoute = publicDashboardRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (
    request.nextUrl.pathname.startsWith('/dashboard') &&
    !isPublicDashboardRoute &&
    !user
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (request.nextUrl.pathname.startsWith('/dashboard') && user) {
    const { data: client } = await supabase.from('clients').select('program,onboarding_completed,birthdate,address_line_1,city,state,postal_code,verified_purchase,access,active').eq('auth_user_id', user.id).maybeSingle()
    const onboardingRoute = request.nextUrl.pathname.startsWith('/dashboard/onboarding')
    const paymentIssueRoute = request.nextUrl.pathname.startsWith('/dashboard/payment-issue')
    const complete = Boolean(client?.onboarding_completed && client.birthdate && client.address_line_1 && client.city && client.state && client.postal_code)
    if (client && !complete && !onboardingRoute) {
      const url = request.nextUrl.clone(); url.pathname = '/dashboard/onboarding/profile'; url.search = ''
      return NextResponse.redirect(url)
    }
    if (client?.verified_purchase === true && (client.access === false || client.active === false) && !paymentIssueRoute && !onboardingRoute) {
      const url = request.nextUrl.clone(); url.pathname = '/dashboard/payment-issue'; url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
