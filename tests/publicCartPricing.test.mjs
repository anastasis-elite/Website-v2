import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function load(path, mocks, environment = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, URLSearchParams,
    ...environment, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) }, { filename: path })
  return module.exports
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const settle = () => new Promise(setImmediate)
const plain = value => JSON.parse(JSON.stringify(value))
const catalog = (program, monthly = 'CAD 731.25') => ({ program,
  subscription: { available: true, amountLabel: monthly, intervalLabel: 'per month', coverageLabel: 'Billed every month for ongoing program access.' },
  annual: { available: false, amountLabel: 'CAD 7,312.50', intervalLabel: 'one-time payment', coverageLabel: 'The access period has not been confirmed.', error: 'Pay-in-full access duration must be configured before checkout.' },
})
function fixture(program = 'ignite') {
  const slots = [], effects = [], requests = [], alerts = []
  let cursor = 0, updates = 0
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { updates++; slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
    useEffect(callback, deps) { const index = cursor++; const old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) { effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: callback() } }) } },
  }
  const location = { search: '?ref=QA-REFERRAL', href: '' }
  const environment = {
    fetch(url, options) { const pending = deferred(); requests.push({ url, options, pending }); return pending.promise },
    window: { location }, alert: message => alerts.push(message),
  }
  const pricing = load('components/commerce/CartPriceDetails.tsx', { react: hooks, '@/app/styles/globalstyles': {} }, environment)
  const Page = load(`app/program/${program}/cart/page.tsx`, {
    '../../../styles/globalstyles': {}, '@/components/TrackEvent': () => null,
    '@/components/commerce/CartPriceDetails': pricing,
  }, environment).default
  const flush = () => { for (const effect of effects.splice(0)) effect() }
  const render = () => { cursor = 0; const tree = Page(); const html = renderToStaticMarkup(tree); flush(); return { tree, html } }
  const renderHook = tier => { cursor = 0; const state = pricing.useCartPricing(tier); flush(); return state }
  const unmount = () => { for (const value of slots) value?.cleanup?.() }
  return { render, renderHook, unmount, requests, location, alerts, updates: () => updates }
}
function nodes(element) { return !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)] }

for (const program of ['ignite', 'phoenix']) {
  test(`${program}: both cart options display returned amounts, billing and unconfirmed access without changing controls`, async () => {
    const f = fixture(program)
    const initial = f.render()
    assert.equal((initial.html.match(/Checking current price/g) || []).length, 2)
    assert.equal(f.requests.length, 1)
    assert.equal(f.requests[0].url, `/api/pricing?program=${program}`)
    assert.equal(f.requests[0].options.method, 'GET')
    assert.equal(f.requests[0].options.cache, 'no-store')
    f.requests[0].pending.resolve(Response.json(catalog(program)))
    await settle()
    const { tree, html } = f.render()
    assert.match(html, /CAD 731.25 · per month/)
    assert.match(html, /CAD 7,312.50 · one-time payment/)
    assert.match(html, /access period has not been confirmed/)
    assert.match(html, /Pay-in-full access duration must be configured/)
    assert.doesNotMatch(html, /12 months|year upfront/)
    const buttons = nodes(tree).filter(n => n.type === 'button')
    assert.deepEqual(buttons.map(n => n.props.children), ['Choose Monthly', 'Pay in Full'])
    assert.ok(buttons.every(n => n.props.disabled === undefined), 'Display-only repair preserves existing button behavior')
    assert.equal(f.requests.length, 1, 'Both cards share one pricing GET')
    assert.match(html, new RegExp(`/program/${program}/recommend`))
    assert.match(html, /href="\/program"/)
    f.unmount()
  })

  test(`${program}: a partially unavailable option shows its notice without inventing a price or duration`, async () => {
    const f = fixture(program); f.render()
    const body = catalog(program); body.annual = { available: false, error: 'This payment option is not configured.' }
    f.requests[0].pending.resolve(Response.json(body)); await settle()
    const { html } = f.render()
    assert.match(html, /CAD 731.25 · per month/)
    assert.match(html, /Price unavailable/)
    assert.match(html, /This payment option is not configured/)
    assert.doesNotMatch(html, /12 months|year upfront|CAD 7,312/)
    f.unmount()
  })

  test(`${program}: existing checkout payload and navigation remain unchanged for each billing option`, async () => {
    for (const [index, billing] of ['subscription', 'annual'].entries()) {
      const f = fixture(program)
      const { tree } = f.render()
      const button = nodes(tree).filter(n => n.type === 'button')[index]
      const pendingCheckout = button.props.onClick()
      const call = f.requests.at(-1)
      assert.equal(call.url, '/api/checkout'); assert.equal(call.options.method, 'POST')
      assert.deepEqual(plain(call.options.headers), { 'Content-Type': 'application/json' })
      assert.deepEqual(JSON.parse(call.options.body), { program, billing, email: '', ...(program === 'phoenix' ? { referralCode: 'QA-REFERRAL' } : {}) })
      call.pending.resolve(Response.json({ url: 'https://checkout.synthetic.invalid/session' }))
      await pendingCheckout
      assert.equal(f.location.href, 'https://checkout.synthetic.invalid/session')
      assert.deepEqual(f.alerts, [])
      f.unmount()
    }
  })

  test(`${program}: a confirmed pay-in-full period is displayed exactly as returned`, async () => {
    const f = fixture(program); f.render()
    const body = catalog(program)
    body.annual = { available: true, amountLabel: 'JPY 8,000', intervalLabel: 'one-time payment', coverageLabel: 'Includes 6 months of program access.' }
    f.requests[0].pending.resolve(Response.json(body)); await settle()
    const { html } = f.render()
    assert.match(html, /JPY 8,000 · one-time payment/)
    assert.match(html, /Includes 6 months of program access/)
    assert.doesNotMatch(html, /not been confirmed|12 months|year upfront/)
    f.unmount()
  })

  test(`${program}: an unavailable monthly option does not hide the confirmed pay-in-full option`, async () => {
    const f = fixture(program); f.render()
    const body = catalog(program)
    body.subscription = { available: false, error: 'Monthly pricing is temporarily unavailable.' }
    body.annual = { available: true, amountLabel: 'USD 4,000', intervalLabel: 'one-time payment', coverageLabel: 'Includes 4 months of program access.' }
    f.requests[0].pending.resolve(Response.json(body)); await settle()
    const { html } = f.render()
    assert.match(html, /Price unavailable/)
    assert.match(html, /Monthly pricing is temporarily unavailable/)
    assert.match(html, /USD 4,000 · one-time payment/)
    assert.match(html, /Includes 4 months of program access/)
    f.unmount()
  })
}

for (const [label, response] of [
  ['HTTP failure', () => Response.json({ error: 'synthetic backend detail' }, { status: 503 })],
  ['wrong program', () => Response.json(catalog('phoenix'))],
  ['invalid price shape', () => Response.json({ ...catalog('ignite'), annual: { available: true, amountLabel: { invalid: true } } })],
  ['invalid JSON', () => new Response('{')],
  ['network failure', () => new Error('synthetic transport failure')],
]) {
  test(`pricing ${label} shows a safe unavailable state`, async () => {
    const f = fixture(); f.render(); const value = response()
    if (value instanceof Error) f.requests[0].pending.reject(value)
    else f.requests[0].pending.resolve(value)
    await settle()
    const { html } = f.render()
    assert.match(html, /Price unavailable/)
    assert.match(html, /Pricing is temporarily unavailable. Contact support for help./)
    assert.doesNotMatch(html, /CAD|synthetic backend detail|synthetic transport failure/)
    f.unmount()
  })
}

test('switching tier aborts the prior GET and prevents late cross-tier prices', async () => {
  const f = fixture()
  f.renderHook('ignite')
  const first = f.requests[0]
  assert.equal(f.renderHook('phoenix').catalog, null)
  assert.equal(first.options.signal.aborted, true)
  f.requests[1].pending.resolve(Response.json(catalog('phoenix', 'USD 1,200'))); await settle()
  first.pending.resolve(Response.json(catalog('ignite', 'USD 720'))); await settle()
  assert.equal(f.renderHook('phoenix').catalog.subscription.amountLabel, 'USD 1,200')
  f.unmount()
})

test('unmount aborts the pricing read and ignores a late successful result', async () => {
  const f = fixture(); f.render()
  f.unmount(); const before = f.updates()
  assert.equal(f.requests[0].options.signal.aborted, true)
  f.requests[0].pending.resolve(Response.json(catalog('ignite'))); await settle()
  assert.equal(f.updates(), before)
})
