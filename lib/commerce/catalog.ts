import 'server-only'
import type Stripe from 'stripe'

export type Program = 'ember' | 'ignite' | 'phoenix'
export type Billing = 'subscription' | 'annual'
export type PriceDetails = {
  available: boolean
  amount?: number
  currency?: string
  amountLabel?: string
  intervalLabel?: string
  coverageLabel?: string
  accessMonths?: number
  mode?: 'subscription' | 'payment'
  error?: string
}

export function parseProgram(value: unknown): Program | null {
  const program = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return program === 'ember' || program === 'ignite' || program === 'phoenix' ? program : null
}
export function parseBilling(value: unknown): Billing | null {
  return value === 'subscription' || value === 'annual' ? value : null
}

const priceVariables: Record<Program, Record<Billing, string>> = {
  ember: { subscription: 'EMBER_SUB_PRICE', annual: 'EMBER_YEAR_PRICE' },
  ignite: { subscription: 'IGNITE_SUB_PRICE', annual: 'IGNITE_YEAR_PRICE' },
  phoenix: { subscription: 'PHOENIX_SUB_PRICE', annual: 'PHOENIX_YEAR_PRICE' },
}
export function configuredPriceId(program: Program, billing: Billing): string | undefined {
  return process.env[priceVariables[program][billing]]?.trim()
}
const zeroDecimalCurrencies = new Set(['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','vnd','vuv','xaf','xof','xpf'])
const threeDecimalCurrencies = new Set(['bhd','jod','kwd','omr','tnd'])
export class PricingError extends Error {
  readonly status = 503
  constructor(message = 'This payment option is temporarily unavailable.') { super(message); this.name = 'PricingError' }
}

function amountDetails(price: Stripe.Price): PriceDetails {
  if (!Number.isSafeInteger(price.unit_amount) || price.unit_amount === null || price.unit_amount < 0 || !/^[a-z]{3}$/.test(price.currency)) return { available: false, error: 'A fixed price must be configured before checkout.' }
  const divisor = zeroDecimalCurrencies.has(price.currency) ? 1 : threeDecimalCurrencies.has(price.currency) ? 1000 : 100
  const amount = price.unit_amount / divisor
  const currency = price.currency.toUpperCase()
  let amountLabel: string
  try { amountLabel = new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: amount % 1 === 0 ? 0 : undefined }).format(amount) }
  catch { return { available: false, error: 'The price currency could not be confirmed.' } }
  const count = price.recurring?.interval_count || 1
  const interval = price.recurring?.interval
  const intervalLabel = interval ? count === 1 ? `per ${interval}` : `every ${count} ${interval}s` : 'one-time payment'
  return { available: false, amount, currency, amountLabel, intervalLabel, mode: price.type === 'recurring' ? 'subscription' : 'payment' }
}

function accessMonths(price: Stripe.Price, product: Stripe.Product) {
  const value = price.metadata?.access_months ?? product.metadata?.access_months
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const months = Number(value)
  return Number.isSafeInteger(months) && months > 0 && months <= 120 ? months : null
}

// This retrieves configured Stripe objects. No amounts, intervals, or access
// periods are derived from product names, marketing text, or former checkout observations.
export async function getPrice(stripe: Pick<Stripe, 'prices'>, program: Program, billing: Billing): Promise<{ price: Stripe.Price; details: PriceDetails }> {
  const priceId = configuredPriceId(program, billing)
  if (!priceId || !/^price_[a-zA-Z0-9]+$/.test(priceId)) throw new PricingError('This payment option is not configured.')
  let price: Stripe.Price
  try { price = await stripe.prices.retrieve(priceId, { expand: ['product'] }) }
  catch { throw new PricingError() }
  const product = typeof price.product === 'object' && !('deleted' in price.product) ? price.product : null
  if (price.id !== priceId || !product) return { price, details: { available: false, error: 'The configured product could not be confirmed.' } }
  const declaredPrograms = [price.metadata?.program, price.metadata?.program_tier, product.metadata?.program, product.metadata?.program_tier].filter(value => value !== undefined && value !== '')
  const mismatched = declaredPrograms.some(value => parseProgram(value) !== program)
  const mappedPrograms = Object.entries(priceVariables).filter(([,vars]) => Object.values(vars).some(variable => process.env[variable]?.trim() === priceId)).map(([mapped]) => mapped)
  if (mismatched || (!declaredPrograms.length && (mappedPrograms.length !== 1 || mappedPrograms[0] !== program))) return { price, details: { available: false, error: 'The configured price does not identify this program.' } }
  const details = amountDetails(price)
  if (details.amount === undefined) return { price, details }
  if (!price.active || !product.active) return { price, details: { ...details, error: 'This configured payment option is inactive.' } }
  if (price.billing_scheme !== 'per_unit' || price.custom_unit_amount || price.transform_quantity || (price.recurring && price.recurring.usage_type !== 'licensed')) return { price, details: { ...details, error: 'A fixed price for one program purchase must be configured.' } }
  if (billing === 'subscription') {
    if (price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) return { price, details: { ...details, error: 'The monthly option requires a monthly recurring price.' } }
    return { price, details: { ...details, available: true, coverageLabel: 'Billed every month for ongoing program access.', accessMonths: 1 } }
  }
  if (price.type !== 'one_time' || price.recurring !== null) return { price, details: { ...details, error: 'Pay in full requires a one-time price; this configured price recurs.' } }
  const months = accessMonths(price, product)
  if (months === null) return { price, details: { ...details, coverageLabel: 'The access period has not been confirmed.', error: 'Pay-in-full access duration must be configured before checkout.' } }
  return { price, details: { ...details, available: true, accessMonths: months, coverageLabel: `Includes ${months} month${months === 1 ? '' : 's'} of program access.` } }
}

export function publicPriceDetails(details: PriceDetails): Omit<PriceDetails, 'mode' | 'accessMonths'> {
  const { available, amount, currency, amountLabel, intervalLabel, coverageLabel, error } = details
  return { available, ...(amount === undefined ? {} : { amount, currency, amountLabel, intervalLabel }), ...(coverageLabel ? { coverageLabel } : {}), ...(error ? { error } : {}) }
}
