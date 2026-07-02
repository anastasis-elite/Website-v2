import { NextRequest, NextResponse } from 'next/server'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'
import { exchangeTikTokCode, saveTikTokAccount, tikTokRedirectUri } from '@/lib/aos/social/tiktok/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function destination(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/social/connect-tiktok', request.url)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url
}

export async function GET(request: NextRequest) {
  if (!(await getAOSAdminUser())) {
    return NextResponse.redirect(new URL('/aos-login', request.url))
  }
  const oauthError = request.nextUrl.searchParams.get('error')
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const expectedState = request.cookies.get('tiktok_oauth_state')?.value

  if (oauthError) return NextResponse.redirect(destination(request, { error: oauthError }))
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(destination(request, { error: 'invalid_oauth_state' }))
  }

  try {
    const token = await exchangeTikTokCode(code, tikTokRedirectUri(request.nextUrl.origin))
    await saveTikTokAccount(token)
    const response = NextResponse.redirect(destination(request, { connected: 'true' }))
    response.cookies.set('tiktok_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/internal/tiktok/callback',
      maxAge: 0,
    })
    return response
  } catch (error) {
    console.error('TikTok OAuth callback failed:', error)
    return NextResponse.redirect(destination(request, { error: 'token_exchange_failed' }))
  }
}
