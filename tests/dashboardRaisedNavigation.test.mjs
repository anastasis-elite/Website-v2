import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync('components/navigation/ClientDashboardNav.tsx', 'utf8')
const guidedCss = readFileSync('components/navigation/guided-navigation.css', 'utf8')
const globals = readFileSync('app/globals.css', 'utf8')
const module = { exports: {} }
let pathname = '/dashboard/program/ignite', search = ''
const { outputText } = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} })
runInNewContext(outputText, { module, exports: module.exports, require(name) {
  if (name === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }
  if (name === 'next/navigation') return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search) }
  if (name === '@/lib/analytics') return { trackEvent() {} }
  if (name.endsWith('.css')) return {}
  return require(name)
} })
const Navigation = module.exports.default
const render = (path, query = '', program = 'ignite') => {
  pathname = path;search = query
  return renderToStaticMarkup(React.createElement(Navigation, { program }))
}
const rules = [...guidedCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body }))

test('raised navigation keeps all five semantic destinations, labels and active states across member routes', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) {
    for (const [path, query, active] of [
      [`/dashboard/program/${program}`, '', 'today'], [`/dashboard/program/${program}`, 'view=plan', 'plan'],
      [`/dashboard/program/${program}/plan`, '', 'plan'], ['/dashboard/community', '', 'community'],
      ['/dashboard/assessment/start2', '', 'progress'], ['/dashboard/support', '', 'account'],
    ]) {
      const html = render(path, query, program)
      const links = [...html.matchAll(/<a ([^>]+)>([\s\S]*?)<\/a>/g)]
      assert.equal(links.length, 5)
      assert.deepEqual(links.map(([, , inner]) => inner.match(/<small>([^<]+)<\/small>/)[1]), ['Today', 'Plan', 'Community', 'Progress', 'Account'])
      assert.deepEqual(links.map(([, attrs]) => attrs.match(/href="([^"]+)"/)[1]), [
        `/dashboard/program/${program}`, `/dashboard/program/${program}?view=plan`, '/dashboard/community', '/dashboard/progress', '/dashboard/account',
      ])
      assert.equal(links.filter(([, attrs]) => attrs.includes('aria-current="page"')).length, 1)
      assert.match(links.find(([, attrs]) => attrs.includes('aria-current="page"'))[1], new RegExp(`data-nav-item="${active}"`))
      assert.equal((html.match(/<svg aria-hidden="true"/g) || []).length, 5)
      assert.doesNotMatch(html, /tabindex="-1"|<button|role="button"|<img|<canvas/)
    }
  }
  for (const path of ['/dashboard/signup', '/dashboard/onboarding/plan', '/dashboard/payment-issue']) assert.equal(render(path), '')
})

test('selected copper artwork uses one continuous glow without pale backing pads or an underline', () => {
  const base = rules.find(rule => rule.selector.endsWith('.client-dashboard-nav__icon svg') && !rule.selector.includes('aria-current'))
  const active = rules.find(rule => rule.selector.includes('[aria-current="page"]') && rule.selector.endsWith('.client-dashboard-nav__icon svg'))
  assert.ok(base && active)
  assert.match(base.selector, /^\.dashboard-client-shell \.client-dashboard-nav--guided /)
  assert.match(base.body, /color:\s*#cda27a/)
  assert.match(active.body, /color:\s*var\(--guided-nav-selected-copper\)/)
  assert.equal((base.body.match(/drop-shadow\(/g) || []).length, 2)
  assert.match(active.body, /filter:\s*none/)
  for (const rule of [base, active]) {
    assert.doesNotMatch(rule.body, /background|border|box-shadow|transform|animation|transition|url\(/)
  }
  const label = rules.find(rule => rule.selector.includes('[aria-current="page"]') && rule.selector.endsWith(' small'))
  assert.match(label.body, /color:\s*var\(--guided-nav-selected-copper\)/)
  assert.match(label.body, /overflow:\s*visible/)
  assert.match(label.body, /text-shadow:\s*none/)
  const gradient = rules.find(rule => rule.selector.endsWith('[aria-current="page"]::before'))
  assert.match(gradient.body, /radial-gradient\(circle closest-side/)
  assert.match(gradient.body, /aspect-ratio:\s*1/)
  assert.match(gradient.body, /width:\s*68px/)
  assert.match(gradient.body, /z-index:\s*-1/)
  assert.match(gradient.body, /pointer-events:\s*none/)
  const selectedTarget = rules.find(rule => rule.selector.endsWith('.client-dashboard-nav__item.active'))
  assert.match(selectedTarget.body, /background:\s*transparent/)
  assert.doesNotMatch(guidedCss, /@keyframes|animation:|small::after|small::before|\.client-dashboard-nav__icon::before|text-decoration:\s*underline/)
})

test('raised icons retain navigation touch clearance and the existing visible keyboard focus', () => {
  assert.match(guidedCss, /\.client-dashboard-nav__item,[\s\S]*?min-height:\s*54px/)
  assert.match(globals, /\.client-dashboard-nav__item:focus-visible\{outline:2px solid var\(--anastasis-copper\);outline-offset:3px\}/)
  assert.match(globals, /\.client-dashboard-nav__icon svg\{[^}]*stroke:currentColor;[^}]*stroke-linecap:round;[^}]*stroke-linejoin:round/)
  assert.match(source, /import '\.\/guided-navigation\.css'/)
})
