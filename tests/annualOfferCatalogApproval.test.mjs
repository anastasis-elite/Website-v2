import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function fixture(extra = {}) {
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_synthetic',
    EMBER_SUB_PRICE: 'price_EmberMonthly', EMBER_YEAR_PRICE: 'price_EmberAnnual',
    IGNITE_SUB_PRICE: 'price_IgniteMonthly', IGNITE_YEAR_PRICE: 'price_IgniteAnnual',
    PHOENIX_SUB_PRICE: 'price_PhoenixMonthly', PHOENIX_YEAR_PRICE: 'price_PhoenixAnnual', ...extra,
  }
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync('lib/commerce/catalog.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'server-only' ? {} : require(name), process: { env }, Intl })
  const catalog = module.exports
  const object = (program = 'ember', billing = 'annual', livemode = false) => ({
    id: catalog.configuredPriceId(program, billing), object: 'price', livemode, active: true,
    product: { id: `prod_${program}Synthetic`, object: 'product', livemode, active: true, metadata: { program } },
    billing_scheme: 'per_unit', currency: 'usd', unit_amount: 123456,
    custom_unit_amount: null, transform_quantity: null, metadata: { program },
    type: billing === 'annual' ? 'one_time' : 'recurring',
    recurring: billing === 'annual' ? null : { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  })
  const retrieve = async (value, program = 'ember', billing = 'annual') => catalog.getPrice({ prices: { retrieve: async (id, options) => {
    assert.equal(id, catalog.configuredPriceId(program, billing)); assert.deepEqual(JSON.parse(JSON.stringify(options)), { expand: ['product'] }); return value
  } } }, program, billing)
  return { env, catalog, object, retrieve }
}

test('approved paid annual offers use validated configured amounts and fixed twelve-month server coverage in test and live modes', async () => {
  for (const livemode of [false, true]) {
    const f = fixture({ STRIPE_SECRET_KEY: livemode ? 'rk_live_synthetic' : 'sk_test_synthetic' })
    for (const program of ['ember', 'ignite', 'phoenix']) {
      const price = f.object(program, 'annual', livemode)
      price.metadata.access_months = '6'; price.product.metadata.access_months = '24'
      const { details } = await f.retrieve(price, program)
      assert.equal(details.available, true); assert.equal(details.mode, 'payment')
      assert.equal(details.accessMonths, 12); assert.equal(details.coverageLabel, 'Includes 12 months of program access.')
      assert.equal(details.amount, 1234.56, 'Amounts come from the configured provider object, not public-price constants')
      assert.equal(f.catalog.annualProgramForPrice(price.id), program)
      assert.equal(f.catalog.subscriptionProgramForPrice(price.id), null)
      delete price.metadata.access_months; delete price.product.metadata.access_months
      assert.equal((await f.retrieve(price, program)).details.accessMonths, 12)
    }
  }
})

test('annual and monthly mappings reject duplicate IDs across every program and payment slot despite declaring a tier', async () => {
  const collisions = ['EMBER_SUB_PRICE', 'IGNITE_YEAR_PRICE', 'IGNITE_SUB_PRICE', 'PHOENIX_YEAR_PRICE', 'PHOENIX_SUB_PRICE', 'TRACKER_YEAR_PRICE', 'TRACKER_SUB_PRICE']
  for (const variable of collisions) {
    const f = fixture(); const annual = f.object()
    f.env[variable] = annual.id
    assert.equal(f.catalog.annualProgramForPrice(annual.id), null, variable)
    assert.equal(f.catalog.subscriptionProgramForPrice(annual.id), null, variable)
    const result = await f.retrieve(annual)
    assert.equal(result.details.available, false, variable)
    assert.equal(result.details.amount, undefined, variable)
  }
  const f = fixture(); const monthly = f.object('ember', 'subscription')
  f.env.PHOENIX_YEAR_PRICE = monthly.id
  assert.equal(f.catalog.subscriptionProgramForPrice(monthly.id), null)
  assert.equal((await f.retrieve(monthly, 'ember', 'subscription')).details.available, false)
})

test('annual activation requires an active fixed one-time price and matching active product/tier/mode', async () => {
  const f = fixture()
  for (const change of [
    { active: false }, { type: 'recurring', recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } },
    { billing_scheme: 'tiered' }, { custom_unit_amount: { enabled: true } }, { transform_quantity: { divide_by: 2 } },
    { unit_amount: null }, { unit_amount: -1 }, { unit_amount: 1.5 },
    { metadata: { program: 'ignite' } }, { product: { id: 'prod_wrong', active: true, metadata: { program: 'phoenix' } } },
    { product: { id: 'prod_inactive', active: false, metadata: { program: 'ember' } } },
    { product: { id: 'prod_deleted', deleted: true } }, { product: null },
    { product: 'prod_notExpanded' }, { livemode: true }, { livemode: 'false' },
  ]) {
    const value = { ...f.object(), ...change }
    assert.equal((await f.retrieve(value)).details.available, false, JSON.stringify(change))
  }
  const metadataLess = f.object(); metadataLess.metadata = {}; metadataLess.product.metadata = {}
  assert.equal((await f.retrieve(metadataLess)).details.available, true, 'A unique server mapping supplies the tier without inventing provider metadata')
})

test('Tracker annual remains unapproved and absent Tracker monthly configuration never retrieves a provider object', async () => {
  const f = fixture({ TRACKER_YEAR_PRICE: 'price_TrackerUnapproved' }); let calls = 0
  const stripe = { prices: { retrieve() { calls++; assert.fail('Unavailable Tracker configuration must fail before retrieval') } } }
  assert.equal(f.catalog.annualProgramForPrice('price_TrackerUnapproved'), null)
  await assert.rejects(f.catalog.getPrice(stripe, 'tracker', 'annual'), /not approved/)
  await assert.rejects(f.catalog.getPrice(stripe, 'tracker', 'subscription'), /not configured/)
  assert.equal(calls, 0)
})

test('monthly subscriptions still require one licensed month and preserve their configured amount', async () => {
  const f = fixture()
  const monthly = f.object('ember', 'subscription')
  const result = await f.retrieve(monthly, 'ember', 'subscription')
  assert.equal(result.details.available, true); assert.equal(result.details.mode, 'subscription'); assert.equal(result.details.accessMonths, 1)
  assert.equal(result.details.amount, 1234.56)
  for (const change of [{ type: 'one_time', recurring: null }, { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } },
    { recurring: { interval: 'month', interval_count: 2, usage_type: 'licensed' } }, { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } }]) {
    assert.equal((await f.retrieve({ ...monthly, ...change }, 'ember', 'subscription')).details.available, false)
  }
})

test('unknown mappings, mismatched retrieved IDs and provider failures stay unavailable without leaking provider details', async () => {
  const f = fixture()
  for (const id of [undefined, null, '', 'prod_notPrice', 'price_unknown']) assert.equal(f.catalog.annualProgramForPrice(id), null)
  assert.equal((await f.retrieve({ ...f.object(), id: 'price_different' })).details.available, false)
  await assert.rejects(f.catalog.getPrice({ prices: { retrieve: async () => { throw new Error('synthetic private provider payload') } } }, 'ember', 'annual'), error => error.status === 503 && !error.message.includes('private'))
  const { details } = await f.retrieve(f.object())
  const projection = f.catalog.publicPriceDetails(details)
  assert.equal(projection.available, true); assert.equal(projection.coverageLabel, 'Includes 12 months of program access.')
  assert.equal(projection.mode, undefined); assert.equal(projection.accessMonths, undefined)
  assert.doesNotMatch(JSON.stringify(projection), /price_|prod_|metadata|synthetic|secret|access_months/)
})
