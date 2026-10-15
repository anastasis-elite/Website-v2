import { NextResponse } from 'next/server'
export function dashboardApiError(error: unknown, fallback: string) {
 const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : ''
 if(digest.startsWith('NEXT_REDIRECT;')) return NextResponse.json({error:digest.includes('/login;')?'Please sign in to continue.':'Complete required account setup to continue.'},{status:digest.includes('/login;')?401:403})
 return NextResponse.json({error:error instanceof Error?error.message:fallback},{status:500})
}
