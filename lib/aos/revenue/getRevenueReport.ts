import Stripe from 'stripe'

type Program = 'ember' | 'ignite' | 'phoenix' | 'unknown'
type Transaction = {
  id: string
  created: number
  amount: number
  program: Program
  referralCode: string
}
type Signup = { id: string; created: number; program: Program; referralCode: string }
type Cost = { name: string; amountCents: number; cadence: 'monthly' | 'annual'; startsAfterFirstClient?: boolean }

const programs: Program[] = ['ember', 'ignite', 'phoenix', 'unknown']

export async function getRevenueReport() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.')
  const stripe = new Stripe(secretKey)

  const [sessions, invoices, balanceTransactions] = await Promise.all([
    loadSessions(stripe),
    loadInvoices(stripe),
    loadBalanceTransactions(stripe),
  ])

  const signups: Signup[] = sessions
    .filter((session) => session.status === 'complete' && session.payment_status === 'paid')
    .map((session) => ({
      id: session.id,
      created: session.created,
      program: programFrom(session.metadata, session.line_items?.data?.[0]?.price?.id),
      referralCode: session.metadata?.referral_code || '',
    }))

  const subscriptionRevenue: Transaction[] = invoices
    .filter((invoice) => invoice.status === 'paid' && invoice.amount_paid > 0)
    .map((invoice) => {
      const subscription = typeof invoice.subscription === 'object' ? invoice.subscription : null
      return {
        id: invoice.id,
        created: invoice.status_transitions.paid_at || invoice.created,
        amount: invoice.amount_paid,
        program: programFrom(subscription?.metadata || invoice.metadata, invoice.lines.data[0]?.price?.id),
        referralCode: subscription?.metadata?.referral_code || invoice.metadata?.referral_code || '',
      }
    })

  const annualRevenue: Transaction[] = sessions
    .filter((session) => session.mode === 'payment' && session.status === 'complete' && session.payment_status === 'paid')
    .map((session) => ({
      id: session.id,
      created: session.created,
      amount: session.amount_total || 0,
      program: programFrom(session.metadata, session.line_items?.data?.[0]?.price?.id),
      referralCode: session.metadata?.referral_code || '',
    }))

  const transactions = [...subscriptionRevenue, ...annualRevenue]
  const now = new Date()
  const ranges = buildRanges(now)
  const costs = parseCosts()
  const firstSignupAt = signups.length ? Math.min(...signups.map((signup) => signup.created)) : null
  const referralCode = process.env.NUTRITIONIST_REFERRAL_CODE || 'nutritionist'

  const periods = Object.fromEntries(
    Object.entries(ranges).map(([key, range]) => {
      const current = summarize({ transactions, signups, balanceTransactions, costs, firstSignupAt, referralCode, ...range.current })
      const previous = summarize({ transactions, signups, balanceTransactions, costs, firstSignupAt, referralCode, ...range.previous })
      return [key, { current, previous, change: compare(current, previous) }]
    })
  )

  return {
    generatedAt: now.toISOString(),
    currency: 'usd',
    referral: {
      code: referralCode,
      path: '/nutritionist',
      standardRate: 0.05,
      referredRate: 0.125,
    },
    allTime: summarize({ transactions, signups, balanceTransactions, costs: [], firstSignupAt, referralCode, start: 0, end: Math.floor(now.getTime() / 1000) + 1 }),
    periods,
    configuredCosts: costs,
    warnings: [
      ...(costs.length ? [] : ['No operating-cost ledger is configured. Profit excludes non-Stripe operating expenses.']),
      'Historical referral commission defaults to 5% when Stripe metadata has no referral_code.',
      'Program revenue is based on paid invoices and paid one-time Checkout Sessions; Stripe net includes refunds and processing fees.',
    ],
  }
}

async function loadSessions(stripe: Stripe) {
  const rows: Stripe.Checkout.Session[] = []
  for await (const row of stripe.checkout.sessions.list({ limit: 100, expand: ['data.line_items'] })) rows.push(row)
  return rows
}

async function loadInvoices(stripe: Stripe) {
  const rows: Stripe.Invoice[] = []
  for await (const row of stripe.invoices.list({ limit: 100, expand: ['data.subscription'] })) rows.push(row)
  return rows
}

async function loadBalanceTransactions(stripe: Stripe) {
  const rows: Stripe.BalanceTransaction[] = []
  for await (const row of stripe.balanceTransactions.list({ limit: 100 })) {
    if (['charge', 'refund', 'dispute'].includes(row.reporting_category)) rows.push(row)
  }
  return rows
}

function programFrom(metadata: Stripe.Metadata | null, priceId?: string | null): Program {
  const metadataProgram = String(metadata?.program || '').toLowerCase()
  if (metadataProgram === 'ember' || metadataProgram === 'ignite' || metadataProgram === 'phoenix') return metadataProgram
  const priceMap: Record<string, Program> = {}
  for (const [program, ids] of Object.entries({
    ember: [process.env.EMBER_SUB_PRICE, process.env.EMBER_YEAR_PRICE],
    ignite: [process.env.IGNITE_SUB_PRICE, process.env.IGNITE_YEAR_PRICE],
    phoenix: [process.env.PHOENIX_SUB_PRICE, process.env.PHOENIX_YEAR_PRICE],
  })) for (const id of ids) if (id) priceMap[id] = program as Program
  return (priceId && priceMap[priceId]) || 'unknown'
}

function summarize({ transactions, signups, balanceTransactions, costs, firstSignupAt, referralCode, start, end }: any) {
  const periodTransactions = (transactions as Transaction[]).filter((row) => row.created >= start && row.created < end)
  const periodSignups = (signups as Signup[]).filter((row) => row.created >= start && row.created < end)
  const periodBalance = (balanceTransactions as Stripe.BalanceTransaction[]).filter((row) => row.created >= start && row.created < end)
  const revenue = sum(periodTransactions.map((row) => row.amount))
  const stripeFees = sum(periodBalance.map((row) => row.fee))
  const stripeNet = sum(periodBalance.map((row) => row.net))
  const commission = sum(periodTransactions.filter((row) => row.program === 'phoenix').map((row) => Math.round(row.amount * (row.referralCode === referralCode ? 0.125 : 0.05))))
  const operatingCosts = costForPeriod(costs, start, end, firstSignupAt)
  return {
    start: new Date(start * 1000).toISOString(), end: new Date(end * 1000).toISOString(),
    revenue, stripeFees, stripeNet, nutritionistCommission: commission, operatingCosts,
    profit: stripeNet - commission - operatingCosts,
    clients: countPrograms(periodSignups), revenueByProgram: moneyPrograms(periodTransactions),
  }
}

function countPrograms(rows: Signup[]) { return { total: rows.length, ...Object.fromEntries(programs.map((program) => [program, rows.filter((row) => row.program === program).length])) } }
function moneyPrograms(rows: Transaction[]) { return Object.fromEntries(programs.map((program) => [program, sum(rows.filter((row) => row.program === program).map((row) => row.amount))])) }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }
function percent(current: number, previous: number) { return previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100 }
function compare(current: any, previous: any) { return { revenuePercent: percent(current.revenue, previous.revenue), profitPercent: percent(current.profit, previous.profit), clientsPercent: percent(current.clients.total, previous.clients.total), clientsByProgram: Object.fromEntries(programs.map((program) => [program, percent(current.clients[program], previous.clients[program])])) } }

function parseCosts(): Cost[] {
  try {
    const parsed = JSON.parse(process.env.AOS_BUSINESS_COSTS_JSON || '[]')
    return Array.isArray(parsed) ? parsed.filter((cost) => cost?.name && Number.isFinite(Number(cost.amountCents)) && ['monthly', 'annual'].includes(cost.cadence)).map((cost) => ({ ...cost, amountCents: Number(cost.amountCents) })) : []
  } catch { return [] }
}

function costForPeriod(costs: Cost[], start: number, end: number, firstSignupAt: number | null) {
  const days = Math.max(0, (end - start) / 86400)
  return Math.round(sum(costs.filter((cost) => !cost.startsAfterFirstClient || (firstSignupAt && firstSignupAt < end)).map((cost) => cost.amountCents * days / (cost.cadence === 'annual' ? 365.25 : 30.4375))))
}

function buildRanges(now: Date) {
  const startToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000
  const day = now.getUTCDay() || 7
  const startWeek = startToday - (day - 1) * 86400
  const startMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000
  const previousMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1) / 1000
  const startYear = Date.UTC(now.getUTCFullYear(), 0, 1) / 1000
  const previousYear = Date.UTC(now.getUTCFullYear() - 1, 0, 1) / 1000
  const end = Math.floor(now.getTime() / 1000) + 1
  return {
    daily: { current: { start: startToday, end }, previous: { start: startToday - 86400, end: startToday } },
    weekly: { current: { start: startWeek, end }, previous: { start: startWeek - 604800, end: startWeek } },
    monthly: { current: { start: startMonth, end }, previous: { start: previousMonth, end: startMonth } },
    yearly: { current: { start: startYear, end }, previous: { start: previousYear, end: startYear } },
  }
}
