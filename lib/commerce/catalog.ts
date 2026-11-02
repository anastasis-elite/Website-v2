import 'server-only'
import type Stripe from 'stripe'

export type Program = 'tracker' | 'ember' | 'ignite' | 'phoenix'
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
  return program === 'tracker' || program === 'ember' || program === 'ignite' || program === 'phoenix' ? program : null
}
export function parseBilling(value: unknown): Billing | null {
  return value === 'subscription' || value === 'annual' ? value : null
}

const priceVariables: Record<Program, Record<Billing, string>> = {
  tracker: { subscription: 'TRACKER_SUB_PRICE', annual: 'TRACKER_YEAR_PRICE' },
  ember: { subscription: 'EMBER_SUB_PRICE', annual: 'EMBER_YEAR_PRICE' },
  ignite: { subscription: 'IGNITE_SUB_PRICE', annual: 'IGNITE_YEAR_PRICE' },
  phoenix: { subscription: 'PHOENIX_SUB_PRICE', annual: 'PHOENIX_YEAR_PRICE' },
}
export function configuredPriceId(program: Program, billing: Billing): string | undefined {
  return process.env[priceVariables[program][billing]]?.trim()
}

function uniquePriceSlot(priceId: unknown): { program: Program; billing: Billing } | null {
  if (typeof priceId !== 'string' || !/^price_[a-zA-Z0-9]+$/.test(priceId)) return null
  const matches = (Object.keys(priceVariables) as Program[]).flatMap(program =>
    (['subscription', 'annual'] as Billing[]).filter(billing => configuredPriceId(program, billing) === priceId).map(billing => ({ program, billing })))
  return matches.length === 1 ? matches[0] : null
}

/** A price must have exactly one server binding, including across billing modes. */
export function subscriptionProgramForPrice(priceId: unknown): Program | null {
  const slot = uniquePriceSlot(priceId)
  return slot?.billing === 'subscription' ? slot.program : null
}

/** Mapping only: historical receipt verification remains the caller's responsibility. */
export function annualProgramForPrice(priceId: unknown): Exclude<Program, 'tracker'> | null {
  const slot = uniquePriceSlot(priceId)
  return slot?.billing === 'annual' && slot.program !== 'tracker' ? slot.program : null
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

// This retrieves configured Stripe objects. No amounts, intervals, or access
// periods are derived from product names, marketing text, or former checkout observations.
export async function getPrice(stripe: Pick<Stripe, 'prices'>, program: Program, billing: Billing): Promise<{ price: Stripe.Price; details: PriceDetails }> {
  if (program === 'tracker' && billing === 'annual') throw new PricingError('Tracker pay-in-full access is not approved.')
  const priceId = configuredPriceId(program, billing)
  if (!priceId || !/^price_[a-zA-Z0-9]+$/.test(priceId)) throw new PricingError('This payment option is not configured.')
  let price: Stripe.Price
  try { price = await stripe.prices.retrieve(priceId, { expand: ['product'] }) }
  catch { throw new PricingError() }
  const product = price.product && typeof price.product === 'object' && !('deleted' in price.product) ? price.product : null
  if (price.id !== priceId || !product) return { price, details: { available: false, error: 'The configured product could not be confirmed.' } }
  const declaredPrograms = [price.metadata?.program, price.metadata?.program_tier, product.metadata?.program, product.metadata?.program_tier].filter(value => value !== undefined && value !== '')
  const mismatched = declaredPrograms.some(value => parseProgram(value) !== program)
  const mappedProgram = billing === 'subscription' ? subscriptionProgramForPrice(priceId) : annualProgramForPrice(priceId)
  if (mismatched || mappedProgram !== program) return { price, details: { available: false, error: 'The configured price does not identify this program and payment option unambiguously.' } }
  if ((price.livemode !== undefined && typeof price.livemode !== 'boolean') ||
    (product.livemode !== undefined && typeof product.livemode !== 'boolean') ||
    (typeof price.livemode === 'boolean' && typeof product.livemode === 'boolean' && price.livemode !== product.livemode)) {
    return { price, details: { available: false, error: 'The configured price and product payment environments do not match.' } }
  }
  const details = amountDetails(price)
  if (details.amount === undefined) return { price, details }
  if (!price.active || !product.active) return { price, details: { ...details, error: 'This configured payment option is inactive.' } }
  if (price.billing_scheme !== 'per_unit' || price.custom_unit_amount || price.transform_quantity || (price.recurring && price.recurring.usage_type !== 'licensed')) return { price, details: { ...details, error: 'A fixed price for one program purchase must be configured.' } }
  if (billing === 'subscription') {
    if (price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) return { price, details: { ...details, error: 'The monthly option requires a monthly recurring price.' } }
    return { price, details: { ...details, available: true, coverageLabel: 'Billed every month for ongoing program access.', accessMonths: 1 } }
  }
  if (price.type !== 'one_time' || price.recurring !== null) return { price, details: { ...details, error: 'Pay in full requires a one-time price; this configured price recurs.' } }
  // The approved full-year duration is server policy, never provider/client
  // metadata. Prices and amounts still come only from validated server mappings.
  return { price, details: { ...details, available: true, accessMonths: 12, coverageLabel: 'Includes 12 months of program access.' } }
}

export function publicPriceDetails(details: PriceDetails): Omit<PriceDetails, 'mode' | 'accessMonths'> {
  const { available, amount, currency, amountLabel, intervalLabel, coverageLabel, error } = details
  return { available, ...(amount === undefined ? {} : { amount, currency, amountLabel, intervalLabel }), ...(coverageLabel ? { coverageLabel } : {}), ...(error ? { error } : {}) }
}
