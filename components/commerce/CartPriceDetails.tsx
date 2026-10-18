'use client'

import { useEffect, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type Price = {
  available: boolean
  amountLabel?: string
  intervalLabel?: string
  coverageLabel?: string
  error?: string
}
type Program = 'ignite' | 'phoenix'
type Catalog = { program: Program; subscription: Price; annual: Price }
type PricingState = { program: Program; catalog: Catalog | null; error: string }

function isPrice(value: unknown): value is Price {
  if (!value || typeof value !== 'object') return false
  const price = value as Record<string, unknown>
  return typeof price.available === 'boolean' &&
    ['amountLabel', 'intervalLabel', 'coverageLabel', 'error'].every(
      key => price[key] === undefined || typeof price[key] === 'string',
    )
}

export function useCartPricing(program: Program): PricingState {
  const [state, setState] = useState<PricingState>({ program, catalog: null, error: '' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ program, catalog: null, error: '' })
    void fetch(`/api/pricing?program=${program}`, {
      method: 'GET', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const data = await response.json()
      if (!response.ok || data?.program !== program ||
        !isPrice(data.subscription) || !isPrice(data.annual)) {
        throw new Error('Pricing is temporarily unavailable. Contact support for help.')
      }
      if (active) setState({ program, catalog: data, error: '' })
    }).catch(() => {
      if (active && !controller.signal.aborted) {
        setState({ program, catalog: null, error: 'Pricing is temporarily unavailable. Contact support for help.' })
      }
    })
    return () => { active = false; controller.abort() }
  }, [program])

  return state.program === program ? state : { program, catalog: null, error: '' }
}

export function CartPriceDetails({ pricing, billing }: {
  pricing: PricingState
  billing: 'subscription' | 'annual'
}) {
  const price = pricing.catalog?.[billing]
  return (
    <div aria-live="polite">
      <p style={{ ...styles.bodyStyle, fontSize: '1.4rem' }}>
        {price?.amountLabel || (pricing.catalog || pricing.error ? 'Price unavailable' : 'Checking current price…')}
        {price?.intervalLabel ? ` · ${price.intervalLabel}` : ''}
      </p>
      {price?.coverageLabel ? <p style={styles.bodyStyle}>{price.coverageLabel}</p> : null}
      {pricing.error ? <p role="status" style={styles.bodyStyle}>{pricing.error}</p> : null}
      {price && !price.available ? (
        <p role="status" style={styles.bodyStyle}>
          {price.error || 'This payment option is currently unavailable. Contact support for help.'}
        </p>
      ) : null}
    </div>
  )
}
