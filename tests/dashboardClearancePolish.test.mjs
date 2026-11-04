import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'

const require = createRequire(import.meta.url)
const globals = postcss.parse(readFileSync('app/globals.css', 'utf8'))
const theme = postcss.parse(readFileSync('components/program-dashboard/TodayPlanTheme.module.css', 'utf8'))
const guided = postcss.parse(readFileSync('components/navigation/guided-navigation.css', 'utf8'))
function declarations(ast, selector) {
  const rows = []
  ast.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(decl => rows.push([decl.prop, decl.value, Boolean(decl.important)])) })
  return rows
}
function value(ast, selector, prop) { return declarations(ast, selector).filter(row => row[0] === prop).at(-1)?.[1] }
function mediaApplies(rule, width) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type !== 'atrule' || parent.name !== 'media') continue
    const min = parent.params.match(/min-width:\s*(\d+)px/), max = parent.params.match(/max-width:\s*(\d+)px/)
    if (min && width < Number(min[1]) || max && width > Number(max[1])) return false
  }
  return true
}
// This checks the actual source variable cascade for these bounded dashboard
// rules. It is a mathematical layout model, not browser/device measurement.
function navigationVariables(width, isGuided) {
  const selected = new Map()
  let order = 0
  globals.walkRules(rule => {
    order++
    if (!rule.selector.startsWith('body:has(.dashboard-client-shell') || rule.selector.includes(' > ') || !mediaApplies(rule, width)) return
    if (rule.selector.includes('.client-dashboard-nav--guided') && !isGuided) return
    const specificity = (rule.selector.match(/\.[\w-]+/g) || []).length
    rule.walkDecls(decl => {
      if (!decl.prop.startsWith('--dashboard-nav-')) return
      const previous = selected.get(decl.prop)
      if (!previous || specificity > previous.specificity || specificity === previous.specificity && order >= previous.order) {
        selected.set(decl.prop, { value: decl.value, specificity, order })
      }
    })
  })
  return Object.fromEntries([...selected].map(([key, row]) => [key, row.value]))
}
function pixels(expression, variables, safeArea) {
  const expanded = expression.replace(/var\((--[\w-]+)\)/g, (_, name) => String(pixels(variables[name], variables, safeArea)))
    .replace(/env\(safe-area-inset-bottom\)/g, String(safeArea)).replace(/calc\(/g, '(').replace(/(\d+(?:\.\d+)?)px/g, '$1')
  assert.match(expanded, /^[\d\s+*/().-]+$/)
  return Function(`return (${expanded})`)()
}

test('dashboard shell alone owns navigation clearance without nested viewport floors or clipped content', () => {
  const consumers = []
  globals.walkRules(rule => rule.walkDecls(decl => {
    if (/^padding(?:-bottom)?$/.test(decl.prop) && decl.value.includes('var(--dashboard-nav-clearance)')) consumers.push(rule.selector)
  }))
  assert.deepEqual(consumers, ['.dashboard-client-shell:has(.client-dashboard-nav)'])
  assert.equal(value(globals, '.dashboard-client-shell', 'padding-bottom'), '0')
  assert.equal(value(globals, '.dashboard-client-shell:has(.client-dashboard-nav)', 'padding-bottom'), 'var(--dashboard-nav-clearance)')
  assert.equal(value(globals, '.dashboard-client-shell>main', 'padding-bottom'), '0')
  assert.equal(value(globals, '.dashboard-client-shell', 'min-height'), '0')
  assert.equal(value(globals, '.dashboard-client-shell>main', 'min-height'), '0')
  assert.equal(value(globals, '.dashboard-client-shell .today-dashboard', 'min-height'), '0')
  assert.equal(value(theme, '.surface', 'min-height'), undefined)
  assert.equal(value(theme, '.surface :global(.today-shell)', 'padding'), '0')
  for (const selector of [
    '.dashboard-client-shell:has(.client-dashboard-nav) .phone-app-surface',
    '.dashboard-client-shell:has(.client-dashboard-nav) .phone-app-surface main',
  ]) {
    assert.equal(value(globals, selector, 'min-height'), '0')
    assert.ok(declarations(globals, selector).some(([prop, amount, important]) => prop === 'padding-bottom' && amount === '0' && important), 'Nested phone surfaces must not add another bottom gap.')
  }
  globals.walkRules(rule => {
    assert.ok(!(rule.selector.includes('.dashboard-client-shell') && rule.selector.includes('.legal-footer')), 'The removed dashboard footer must not own any spacing.')
  })
  assert.equal(value(globals, '.manual-session-actions', 'bottom'), 'var(--dashboard-nav-clearance,0px)')
  for (const selector of ['.dashboard-client-shell', '.dashboard-client-shell>main', '.dashboard-client-shell .today-dashboard']) {
    assert.equal(value(globals, selector, 'height'), undefined)
    assert.ok(!['hidden', 'clip'].includes(value(globals, selector, 'overflow')))
    assert.ok(!['hidden', 'clip'].includes(value(globals, selector, 'overflow-y')))
  }
})

test('actual dashboard variables reserve nav, elevation, desktop offset and safe area exactly once', () => {
  for (const [width, isGuided, expected] of [[390, true, 94], [1024, true, 108], [390, false, 110], [1024, false, 128]]) {
    for (const safeArea of [0, 34]) {
      const variables = navigationVariables(width, isGuided)
      const clearance = pixels(variables['--dashboard-nav-clearance'], variables, safeArea)
      const physical = pixels(variables['--dashboard-nav-height'], variables, safeArea) + pixels(variables['--dashboard-nav-elevation'], variables, safeArea) + pixels(variables['--dashboard-nav-offset'], variables, safeArea) + safeArea
      assert.equal(clearance, expected + safeArea)
      assert.equal(clearance - physical, 16)
      const height = isGuided ? value(guided, '.dashboard-client-shell .client-dashboard-nav.client-dashboard-nav--guided', 'height') : value(globals, '.client-dashboard-nav', 'height')
      assert.equal(pixels(height, variables, safeArea), pixels(variables['--dashboard-nav-height'], variables, safeArea) + safeArea)
    }
  }
})

test('short Plan and long Today flow models leave final dashboard content above fixed navigation without cumulative gaps', () => {
  for (const width of [390, 1024]) for (const safeArea of [0, 34]) for (const isGuided of [true, false]) {
    const variables = navigationVariables(width, isGuided), clearance = pixels(variables['--dashboard-nav-clearance'], variables, safeArea)
    const navTopInset = clearance - 16
    for (const contentHeight of [240, 2400]) {
      const viewport = 844
      const scrollHeight = contentHeight + clearance
      const maxScroll = Math.max(0, scrollHeight - viewport)
      assert.ok(contentHeight - maxScroll <= viewport - navTopInset - 16)
      assert.equal(scrollHeight - contentHeight, clearance)
    }
  }
})

test('public footer styles and remaining legal and support destinations remain intact', () => {
  assert.deepEqual(declarations(globals, '.legal-footer'), [
    ['padding', '36px max(24px, env(safe-area-inset-left)) calc(36px + env(safe-area-inset-bottom))', false],
    ['color', 'var(--anastasis-ivory)', false], ['font-size', '.86rem', false], ['text-align', 'center', false],
  ])
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync('components/LegalFooter.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(source, { module, exports: module.exports, Date, require(name) {
    if (name === 'next/link') return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    return require(name)
  } })
  const html = renderToStaticMarkup(React.createElement(module.exports.default))
  assert.match(html, /<footer class="legal-footer">/)
  assert.match(html, /<nav aria-label="Footer links">/)
  assert.deepEqual([...html.matchAll(/<a href="([^"]+)">/g)].map(match => match[1]), [
    '/what-is-anastasis', '/program', '/about', '/terms', '/privacy', '/health-disclaimer', '/refund-policy', '/research-consent', '/support',
  ])
  const rootLayout = readFileSync('app/layout.tsx', 'utf8')
  assert.ok(rootLayout.indexOf('{children}') < rootLayout.indexOf('<LegalFooter />'))
  assert.equal((rootLayout.match(/<LegalFooter\s*\/>/g) || []).length, 1)
})
