import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const mocks = {
  react: `export const useRef = () => ({current:null}); export const useEffect = () => {}; export const useState = initial => { const f=globalThis.assessmentLogoutFixture; const index=f.hook++; return [index===0 ? true : initial, value => f.stateChanges.push({index,value})] }`,
  'react-dom': 'export const createPortal = content => content',
  'react/jsx-runtime': 'export const jsx=(type,props,key)=>({type,props,key}); export const jsxs=jsx; export const Fragment="fragment"',
  'next/navigation': 'export const usePathname=()=>"/dashboard/assessment/start2"; export const useRouter=()=>globalThis.assessmentLogoutFixture.router',
  'next/link': 'export default "a"',
  '@/lib/analytics': 'export const trackEvent=()=>{}',
}
let { outputText } = ts.transpileModule(readFileSync('components/navigation/DashboardMoreMenu.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
})
outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => {
  assert.ok(mocks[specifier], `Unexpected dependency ${specifier}`)
  return `from 'data:text/javascript;base64,${Buffer.from(mocks[specifier]).toString('base64')}'`
})
const { default: DashboardMoreMenu } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

function findLogout(node) {
  if (Array.isArray(node)) return node.map(findLogout).find(Boolean)
  if (!node || typeof node !== 'object') return null
  return node.type === 'button' && node.props.className === 'dashboard-more-logout' ? node : findLogout(node.props?.children)
}

function fixture(t) {
  const original = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, fixture: globalThis.assessmentLogoutFixture }
  const requests = [], routes = [], stateChanges = []
  const surface = new EventTarget()
  surface.sessionStorage = {}
  globalThis.window = surface
  globalThis.document = { body: {} }
  globalThis.fetch = async (...args) => { requests.push(args); return { ok: true } }
  globalThis.assessmentLogoutFixture = { hook: 0, stateChanges, router: { replace: path => routes.push(path), refresh() {} } }
  t.after(() => { globalThis.window=original.window; globalThis.document=original.document; globalThis.fetch=original.fetch; globalThis.assessmentLogoutFixture=original.fixture })
  const button = findLogout(DashboardMoreMenu({ program: 'ignite' }))
  assert.ok(button)
  return { requests, routes, stateChanges, button }
}

test('canceling assessment navigation prevents sign-out before any authentication request', async t => {
  const { requests, routes, stateChanges, button } = fixture(t)
  window.addEventListener('anastasis:before-assessment-navigation', event => event.preventDefault())
  await button.props.onClick()
  assert.equal(requests.length, 0)
  assert.deepEqual(routes, [])
  assert.deepEqual(stateChanges, [])
})

test('confirmed navigation permits the existing sign-out flow', async t => {
  const { requests, routes, button } = fixture(t)
  await button.props.onClick()
  assert.equal(requests.length, 1)
  assert.equal(requests[0][0], '/api/auth/logout')
  assert.equal(requests[0][1].method, 'POST')
  assert.deepEqual(routes, ['/login'])
})
