import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

test('rendered page waits for consent, emits once after acceptance, and unmount prevents deferred view capture', () => {
  const require = createRequire(import.meta.url)
  const module = { exports: {} }, captures = [], listeners = new Set(), refs = []
  let accepted = false, cursor = 0, previousDeps, cleanup
  const mocks = {
    react: { useRef(initial) { return refs[cursor++] ||= { current: initial } }, useEffect(fn, deps) {
      if (!previousDeps || deps.some((value, i) => value !== previousDeps[i])) { cleanup?.(); previousDeps = deps; cleanup = fn() }
    } },
    '@/lib/analytics': { trackEvent(event, properties) { captures.push({ event, properties }) } },
    '@/lib/posthog': { canCaptureAnalytics: () => accepted, ANALYTICS_IDENTITY_READY_EVENT: 'analytics-identity-ready' },
  }
  const compiled = ts.transpileModule(readFileSync('components/TrackEvent.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, window: { addEventListener(_name, callback) { listeners.add(callback) }, removeEventListener(_name, callback) { listeners.delete(callback) } }, require: name => mocks[name] || require(name) })
  const render = event => { cursor = 0; module.exports.default({ event, properties: { page: 'landing' } }) }
  render('landing_page_viewed'); assert.equal(captures.length, 0)
  accepted = true; for (const callback of listeners) callback()
  assert.equal(captures.length, 1); assert.equal(captures[0].event, 'landing_page_viewed')
  render('landing_page_viewed'); for (const callback of listeners) callback()
  assert.equal(captures.length, 1)
  accepted = false; render('pricing_viewed'); assert.equal(captures.length, 1)
  cleanup(); accepted = true; for (const callback of listeners) callback()
  assert.equal(captures.length, 1)
})
