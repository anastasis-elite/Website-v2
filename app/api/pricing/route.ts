import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getPrice, parseProgram, publicPriceDetails } from '@/lib/commerce/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const program = parseProgram(new URL(request.url).searchParams.get('program'))
  if (!program) return NextResponse.json({ error: 'Choose a supported program.' }, { status: 400 })
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return NextResponse.json({ error: 'Pricing is not configured.' }, { status: 503 })
  const stripe = new Stripe(secret, { maxNetworkRetries: 1, timeout: 10_000 })
  const options = await Promise.allSettled([getPrice(stripe, program, 'subscription'), getPrice(stripe, program, 'annual')])
  const subscription = options[0].status === 'fulfilled' ? publicPriceDetails(options[0].value.details) : { available: false, error: 'The monthly payment option is temporarily unavailable.' }
  const annual = options[1].status === 'fulfilled' ? publicPriceDetails(options[1].value.details) : { available: false, error: 'The pay-in-full payment option is temporarily unavailable.' }
  if (options.every(option => option.status === 'rejected')) return NextResponse.json({ error: 'Pricing is temporarily unavailable. Contact support for help.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ program, subscription, annual }, { headers: { 'Cache-Control': 'private, no-store' } })
}
