import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only the Free enrollment return is supported here; never redirect to a
// caller-supplied URL or carry authorization codes into the next page.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const destination = new URL('/community/join', url.origin)
  const code = url.searchParams.get('code')
  if (code && code.length <= 2048 && !url.searchParams.has('error')) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(destination)
    } catch { /* Only a verified session can later enroll through the owned RPC. */ }
  }
  destination.searchParams.set('verification', 'failed')
  return NextResponse.redirect(destination)
}
