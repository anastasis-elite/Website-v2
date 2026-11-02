import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync('components/ConnectedCalendars.tsx', 'utf8')
const require = createRequire(import.meta.url)
const text = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join('') : value && typeof value === 'object' ? text(value.props?.children) : ''
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}

test('calendar options remove Apple credential entry, preserve Google OAuth and existing account management, and link to calendar', async () => {
  const state = new Map(), refs = new Map(), seen = new Set(), effects = [], calls = [], destinations = []
  let context = 'root', cursor = 0
  const nextKey = () => `${context}:${cursor++}`
  const module = { exports: {} }
  const connections = ['google', 'icloud'].map(provider => ({ id: provider, provider, account_label: `${provider} account`, status: 'connected', calendars: [], last_synced_at: null }))
  const settings = { google_configured: true, icloud_configured: true, connections, preferences: { timezone: 'America/Chicago', default_calendar_id: null, preferred_start: '07:00', preferred_end: '21:00', buffer_minutes: 10 } }
  const mocks = {
    react: {
      useState(initial) { const key = nextKey(); if (!state.has(key)) state.set(key, typeof initial === 'function' ? initial() : initial)
        return [state.get(key), value => state.set(key, typeof value === 'function' ? value(state.get(key)) : value)] },
      useRef(initial) { const key = nextKey(); if (!refs.has(key)) refs.set(key, { current: initial }); return refs.get(key) },
      useCallback: fn => fn,
      useEffect(fn) { const key = nextKey(); if (!seen.has(key)) { seen.add(key); effects.push(fn) } },
    },
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/lib/calendar/client': { announceCalendarChange() {}, async calendarRequest(url, options) { calls.push({ url, options }); return url.endsWith('/google/connect') ? { url: 'https://accounts.google.test/authorize' } : settings } },
  }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, URLSearchParams, window: { location: { search: '', assign(url) { destinations.push(url) } } },
    require: name => name.endsWith('.css') ? {} : mocks[name] || require(name),
  })
  const render = (component = module.exports.default, props = {}, key = 'root') => { context = key; cursor = 0; return component(props) }
  render(); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve))
  const tree = render()
  assert.equal(nodes(tree, node => node.type === 'a' && text(node) === 'Open calendar')[0].props.href, '/dashboard/calendar')
  assert.match(text(tree), /Device-calendar connection requires a native app/)
  assert.match(text(tree), /native device-calendar connection is not available yet/)
  assert.equal(nodes(tree, node => node.type === 'input' && ['email', 'password'].includes(node.props.type)).length, 0)
  assert.equal(nodes(tree, node => node.type === 'button' && /Connect iCloud|Connect device/.test(text(node))).length, 0)
  assert.doesNotMatch(source, /app_password|account\.apple\.com|showICloud|type="password"|\/api\/calendars\/icloud/)
  const accounts = nodes(tree, node => typeof node.type === 'function' && node.type.name === 'ConnectionCard')
  assert.equal(accounts.length, 2)
  for (const account of accounts) {
    const card = render(account.type, account.props, account.props.connection.id)
    const labels = nodes(card, node => node.type === 'button').map(text)
    assert.ok(labels.includes('Refresh')); assert.ok(labels.includes('Disconnect')); assert.ok(labels.includes('Save calendar selection'))
    assert.equal(labels.includes('Reconnect'), account.props.connection.provider === 'google')
  }
  nodes(tree, node => node.type === 'button' && text(node) === 'Connect Google Calendar')[0].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.at(-1).url, '/api/calendars/google/connect')
  assert.equal(calls.at(-1).options.method, 'POST')
  assert.deepEqual(destinations, ['https://accounts.google.test/authorize'])
})
