import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_MAP = {
  ember: {
    subscription: process.env.STRIPE_PRICE_ID_EMBER_SUB,
    annual: process.env.STRIPE_PRICE_ID_EMBER_YEAR,
  },
  ignite: {
    subscription: process.env.STRIPE_PRICE_ID_IGNITE_SUB,
    annual: process.env.STRIPE_PRICE_ID_IGNITE_YEAR,
  },
  phoenix: {
    subscription: process.env.STRIPE_PRICE_ID_PHOENIX_SUB,
    annual: process.env.STRIPE_PRICE_ID_PHOENIX_YEAR,
  },
} as const

export async function POST(req: Request) {
  try {
    const { program, billing, email } = await req.json()

    if (!program || !billing) {
      return NextResponse.json(
        { error: 'Missing program or billing type' },
        { status: 400 }
      )
    }

    const programKey = program as keyof typeof PRICE_MAP
    const billingKey = billing as 'subscription' | 'annual'

    const priceId = PRICE_MAP[programKey]?.[billingKey]

    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid program or billing type' },
        { status: 400 }
      )
    }

    const origin =
      req.headers.get('origin') || 'https://www.anastasiselite.com'

    const mode = billing === 'subscription' ? 'subscription' : 'payment'

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
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
    return NextResponse.json(
      { error: 'Unable to create checkout session' },
      { status: 500 }
    )
  }
}
