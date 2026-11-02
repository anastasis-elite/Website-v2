import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const text = x => typeof x === 'string' ? x : Array.isArray(x) ? x.map(text).join(' ') : x && typeof x === 'object' ? text(x.props?.children) : ''
function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(x => nodes(x, predicate)); return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)] }
function mount(verified = false) {
  const states = [], refs = [], calls = [], signups = [], destinations = []
  let cursor = 0, refCursor = 0, effectStarted = false
  let send = async () => ({ ok: true, json: async () => ({ success: true, redirect: 'https://untrusted.example.test' }) })
  const user = { id: 'synthetic-owner', email_confirmed_at: verified ? '2026-01-01' : null, user_metadata: { full_name: verified ? 'Existing Member' : '', program: 'phoenix' } }
  const client = { auth: { getUser: async () => ({ data: { user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signUp: async value => { signups.push(value); return { data: { user, session: null }, error: null } } } }
  const mocks = {
    react: { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useRef(initial) { return refs[refCursor++] ||= { current: initial } }, useEffect(fn) { if (!effectStarted) { effectStarted = true; fn() } } },
    'next/link': { __esModule: true, default: 'a' }, 'next/navigation': { useRouter: () => ({ push: value => destinations.push(value), refresh() {} }) },
    '@/lib/supabase/client': { createClient: () => client }, '@/app/styles/globalstyles': {},
  }
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync('components/membership/FreeCommunityJoin.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  runInNewContext(js, { module, exports: module.exports, Error, window: { location: { origin: 'https://app.example.test' } }, require: name => mocks[name] || require(name), fetch(_url, options) { calls.push(JSON.parse(options.body)); return send() } })
  function render() { cursor = refCursor = 0; return module.exports.default({}) }
  return { render, calls, signups, destinations, setSend(fn) { send = fn }, async ready() { render(); await new Promise(resolve => setImmediate(resolve)); render() }, field(label, value) { const input = nodes(nodes(render(), n => n.type === 'label' && text(n).startsWith(label))[0], n => n.type === 'input')[0]; input.props.onChange({ target: { value } }) }, submit() { return nodes(render(), n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} }) } }
}

test('public Free signup requires verification before enrollment and does not send paid entitlements', async () => {
  const view = mount(); await view.ready()
  view.field('Your name', 'New Member'); view.field('Email', 'synthetic@example.test'); view.field('Password', 'synthetic-password-only')
  await view.submit()
  assert.equal(view.calls.length, 0)
  assert.equal(view.signups.length, 1)
  assert.equal(JSON.stringify(view.signups[0].options.data), JSON.stringify({ full_name: 'New Member' }))
  assert.equal(view.signups[0].options.emailRedirectTo, 'https://app.example.test/auth/callback?next=%2Fcommunity%2Fjoin')
  assert.match(text(view.render()), /Check your email to verify/)
  assert.equal(nodes(view.render(), n => n.type === 'input' && n.props.type === 'password')[0].props.value, '')
})

test('verified owner enrollment is single-flight, submits only a profile name, and uses a fixed safe return', async () => {
  const view = mount(true); await view.ready()
  let finish
  view.setSend(() => new Promise(resolve => { finish = resolve }))
  const pending = view.submit(); await view.submit(); assert.equal(view.calls.length, 1)
  assert.deepEqual(view.calls[0], { fullName: 'Existing Member' })
  finish({ ok: true, json: async () => ({ success: true, redirect: '//untrusted.example.test' }) }); await pending
  assert.deepEqual(view.destinations, ['/dashboard/community'])
  assert.match(text(view.render()), /existing paid membership stays unchanged/)
})

test('verification callback never follows caller URLs or forwards authorization codes on success or failure', async () => {
  let fail = false, exchanges = 0
  globalThis.freeEntryExchange = async () => { exchanges++; return { error: fail ? { message: 'private diagnostic' } : null } }
  const route = await importTs('app/auth/callback/route.ts', { 'next/server': 'export const NextResponse={redirect:url=>Response.redirect(url,307)}', '@/lib/supabase/server': 'export const createClient=async()=>({auth:{exchangeCodeForSession:globalThis.freeEntryExchange}})' })
  let result = await route.GET(new Request('https://app.example.test/auth/callback?code=synthetic-code&next=https://untrusted.example.test'))
  assert.equal(result.headers.get('Location'), 'https://app.example.test/community/join')
  fail = true
  result = await route.GET(new Request('https://app.example.test/auth/callback?code=synthetic-code&next=//untrusted.example.test'))
  assert.equal(result.headers.get('Location'), 'https://app.example.test/community/join?verification=failed')
  assert.doesNotMatch(result.headers.get('Location'), /synthetic-code|private diagnostic|untrusted/)
  assert.equal(exchanges, 2)
})
