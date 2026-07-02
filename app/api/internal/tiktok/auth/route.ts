import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'
import { TIKTOK_SCOPES, tikTokRedirectUri } from '@/lib/aos/social/tiktok/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!(await getAOSAdminUser())) {
    return NextResponse.redirect(new URL('/aos-login', request.url))
  }
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  if (!clientKey) {
    return NextResponse.redirect(new URL('/admin/social/connect-tiktok?error=missing_configuration', request.url))
  }

  const state = randomBytes(32).toString('base64url')
  const authorize = new URL('https://www.tiktok.com/v2/auth/authorize/')
  authorize.searchParams.set('client_key', clientKey)
  authorize.searchParams.set('scope', TIKTOK_SCOPES.join(','))
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('redirect_uri', tikTokRedirectUri(request.nextUrl.origin))
  authorize.searchParams.set('state', state)

  const response = NextResponse.redirect(authorize)
  response.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/internal/tiktok/callback',
    maxAge: 10 * 60,
  })
  return response
}
