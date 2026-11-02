import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : ''
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate)) : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]

function harness() {
  const states = [], requests = [], redirects = [];let stateIndex = 0, refreshes = 0
  let transport = async () => Response.json({ success: true, redirect: '/dashboard' })
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync('components/legal/LegalAcceptanceForm.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, fetch: async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });return transport()
  }, require(name) {
    if (name === 'react') return { useState(initial) { const index = stateIndex++;if (!(index in states)) states[index] = initial;return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] } }
    if (name === 'next/link') return { __esModule: true, default: 'a' }
    if (name === 'next/navigation') return { useRouter: () => ({ replace(value) { redirects.push(value) }, refresh() { refreshes++ } }) }
    if (name === '@/app/styles/globalstyles') return {}
    return require(name)
  } })
  const render = () => { stateIndex = 0;return module.exports.default() }
  const checkboxes = () => nodes(render(), node => node.type === 'input' && node.props.type === 'checkbox')
  const accept = () => nodes(render(), node => node.type === 'button')[0]
  const checkRequired = () => { for (let index = 0; index < 3; index++) checkboxes()[index].props.onChange({ target: { checked: true } }) }
  return { render, checkboxes, accept, checkRequired, requests, redirects, get refreshes() { return refreshes }, setTransport(value) { transport = value } }
}

test('the form requires only Terms, Privacy and Health while research stays an explicit optional choice', () => {
  const view = harness(), tree = view.render()
  assert.equal(view.checkboxes().length, 4)
  assert.equal(view.accept().props.disabled, true)
  assert.deepEqual(nodes(tree, node => node.type === 'a').map(node => node.props.href), ['/terms', '/privacy', '/health-disclaimer', '/research-consent'])
  assert.doesNotMatch(text(tree), /\bAI\b|artificial|assisted recommendations/i)
  for (let index = 0; index < 2; index++) view.checkboxes()[index].props.onChange({ target: { checked: true } })
  assert.equal(view.accept().props.disabled, true)
  view.checkboxes()[2].props.onChange({ target: { checked: true } })
  assert.equal(view.accept().props.disabled, false)
  assert.equal(view.checkboxes()[3].props.checked, false)
})

test('new acceptance submits explicit current agreements without retired consent and research opt-in remains voluntary', async () => {
  for (const research of [false, true]) {
    const view = harness();view.checkRequired()
    if (research) view.checkboxes()[3].props.onChange({ target: { checked: true } })
    await view.accept().props.onClick()
    const request = view.requests[0]
    assert.equal(request.url, '/api/legal/accept');assert.equal(request.options.method, 'POST')
    assert.deepEqual(request.body, { terms: true, privacy: true, healthDisclaimer: true, researchConsent: research,
      source: 'dashboard_legal_gate', featureConsents: { anonymized_research_use: research } })
    assert.ok(!('aiDisclaimer' in request.body))
    assert.ok(!('ai_recommendations' in request.body.featureConsents))
    assert.deepEqual(view.redirects, ['/dashboard']);assert.equal(view.refreshes, 1)
  }
})

test('failed or unconfirmed saves retain the agreement choices and allow retry without claiming acceptance', async () => {
  for (const transport of [async () => { throw new Error('Private transport detail') },
    async () => Response.json({ error: 'Your legal acceptance could not be recorded. Try again.' }, { status: 503 }),
    async () => Response.json({ success: false })]) {
    const view = harness();view.checkRequired();view.setTransport(transport)
    await view.accept().props.onClick()
    assert.equal(view.redirects.length, 0);assert.equal(view.refreshes, 0)
    assert.equal(view.accept().props.disabled, false)
    assert.ok(view.checkboxes().slice(0, 3).every(node => node.props.checked))
    assert.match(text(view.render()), /could not be recorded/)
    assert.doesNotMatch(text(view.render()), /Private transport detail/)
    assert.equal(nodes(view.render(), node => node.props.role === 'status').length, 1)
    view.setTransport(async () => Response.json({ success: true, redirect: '/dashboard' }))
    await view.accept().props.onClick()
    assert.deepEqual(view.redirects, ['/dashboard'])
  }
})
