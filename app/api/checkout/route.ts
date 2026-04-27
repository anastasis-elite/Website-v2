import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const PRICE_MAP = {
  ember: {
    subscription: process.env.EMBER_SUB_PRICE,
    annual: process.env.EMBER_YEAR_PRICE,
  },
  ignite: {
    subscription: process.env.IGNITE_SUB_PRICE,
    annual: process.env.IGNITE_YEAR_PRICE,
  },
  phoenix: {
    subscription: process.env.PHOENIX_SUB_PRICE,
    annual: process.env.PHOENIX_YEAR_PRICE,
  },
} as const

export async function POST(req: Request) {
  try {
    const { program, billing, email } = await req.json()

    const priceId =
      PRICE_MAP[program as keyof typeof PRICE_MAP]?.[
        billing as 'subscription' | 'annual'
      ]

    if (!priceId) {
      return NextResponse.json(
        { error: 'Missing price ID' },
        { status: 400 }
      )
    }

    const origin = req.headers.get('origin') || 'https://www.anastasiselite.com'

    const session = await stripe.checkout.sessions.create({
      mode: billing === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/program/${program}/cart`,
      metadata: {
        program,
        billing,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Unable to create checkout session'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
