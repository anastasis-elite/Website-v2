// Preview deployments can inherit production variables. Test payment writes
// require an isolated database even when the Stripe key is a test key.
export function paymentEnvironmentError(secret = process.env.STRIPE_SECRET_KEY) {
  if (!secret) return 'Payments are not configured.'
  const live = secret.startsWith('sk_live_') || secret.startsWith('rk_live_')
  const production = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : process.env.PAYMENT_ENVIRONMENT === 'production'
  if (live && !production) return 'Live payments are disabled in this environment. Configure Stripe test mode and an isolated database.'
  if (!live && process.env.PAYMENT_TEST_DATABASE_ISOLATED !== 'true') return 'Test payments require an explicitly isolated test database.'
  return null
}
