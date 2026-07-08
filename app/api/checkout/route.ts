import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

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
    const stripeSecretKey=process.env.STRIPE_SECRET_KEY
    if(!stripeSecretKey)return NextResponse.json({error:'Checkout is not configured.'},{status:503})
    const stripe=new Stripe(stripeSecretKey)
    const {
  program,
  billing,
  email,
  client_id,
  application_id,
  fullName,
  birthdate,
  referralCode,
} = await req.json()
    const safeReferralCode = typeof referralCode === 'string' ? referralCode.trim().slice(0, 80) : ''

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

    const origin = (process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin||'https://www.anastasiselite.com').replace(/\/$/,'')
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    const session = await stripe.checkout.sessions.create({
      mode: billing === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: normalizedEmail || undefined,
      client_reference_id: client_id || undefined,
      success_url: `${origin}/verified?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/program/${program}/cart${safeReferralCode ? `?ref=${encodeURIComponent(safeReferralCode)}` : ''}`,

      metadata: {
  client_id: client_id || '',
  application_id: application_id || '',
  program,
  billing,
  email: normalizedEmail,
  fullName: fullName || '',
        birthdate: birthdate || '',
        referral_code: safeReferralCode,
        referral_source: safeReferralCode ? 'referral_link' : '',
},

      payment_intent_data:
        billing === 'annual'
          ? { metadata: { program, billing, referral_code: safeReferralCode, referral_source: safeReferralCode ? 'referral_link' : '' } }
          : undefined,

      subscription_data:
  billing === 'subscription'
    ? {
        metadata: {
          client_id: client_id || '',
          application_id: application_id || '',
          program,
          billing,
          email: normalizedEmail,
          fullName: fullName || '',
          referral_code: safeReferralCode,
          referral_source: safeReferralCode ? 'referral_link' : '',
        },
      }
    : undefined,
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
