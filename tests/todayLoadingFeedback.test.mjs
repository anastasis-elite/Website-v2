import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const stages = []
const modules = new Map()
function load(path) {
  if (modules.has(path)) return modules.get(path).exports
  const module = { exports: {} }; modules.set(path, module)
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === '@/components/DashboardPerformance') return { __esModule: true, default: ({ stage }) => { stages.push(stage); return null } }
    if (name === '@/components/DashboardShellTiming') return { __esModule: true, default: () => null }
    if (name === './TodayPlanTheme.module.css') return { __esModule: true, default: { streakBadge: 'today-streak-badge' } }
    if (name.startsWith('@/components/')) return load(name.slice(2) + '.tsx')
    return require(name)
  } }, { filename: path })
  return module.exports
}
const Loading = load('components/program-dashboard/DashboardLoadingShell.tsx').default
const Ready = load('components/program-dashboard/DashboardReadyShell.tsx').default
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))

test('Anastasis loading feedback announces pending saved data without progress or completion claims', () => {
  const html = render(Loading)
  assert.match(html, /Anastasis Elite/)
  assert.match(html, /Loading your saved day\./)
  assert.equal((html.match(/role="status"/g) || []).length, 1)
  assert.match(html, /aria-live="polite" aria-atomic="true" aria-busy="true"/)
  assert.match(html, /var\(--anastasis-charcoal\)/)
  assert.match(html, /var\(--anastasis-copper\)/)
  assert.match(html, /var\(--anastasis-ivory\)/)
  assert.doesNotMatch(html, /<a\b|<button\b|role="progressbar"|aria-valuenow|0 days streak|animation:/)
})

test('personalization fallback never resurfaces generic actions or prematurely marks the primary dashboard ready', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) {
    stages.length = 0
    const html = render(Ready, { program })
    assert.match(html, /data-dashboard-stage="shell"/)
    assert.match(html, /Loading your saved day/)
    assert.match(html, /aria-label="Streak loading"/)
    assert.doesNotMatch(html, /<main\b|<a\b|<button\b|Daily actions|Open daily check-in|Log water|Log food|Nutrition guidance|0 days streak/)
    assert.deepEqual(stages, ['shell'])
    assert.doesNotMatch(render(Ready, { program, showStreak: false }), /today-streak|Streak loading/)
  }
})

test('existing dashboard and program route loading boundaries render the same accessible feedback', () => {
  for (const path of ['app/dashboard/loading.tsx', 'app/dashboard/program/[program]/loading.tsx']) {
    assert.equal(load(path).default, Loading)
    assert.match(render(load(path).default), /Anastasis Elite/)
  }
})

test('the actual dashboard error remains visible and its retry is usable instead of a busy overlay', () => {
  const ErrorView = load('app/dashboard/program/[program]/error.tsx').default
  let retries = 0
  const element = React.createElement(ErrorView, { error: new Error('Synthetic load failure'), reset: () => retries++ })
  const html = renderToStaticMarkup(element)
  assert.match(html, /role="alert"/)
  assert.match(html, /Your day couldn’t load/)
  assert.match(html, /This screen could not confirm your latest saved activities/)
  assert.match(html, /Try again/)
  assert.doesNotMatch(html, /aria-busy="true"|Loading your saved day/)
  function findButton(node) {
    if (!node || typeof node !== 'object') return null
    if (node.type === 'button') return node
    for (const child of React.Children.toArray(node.props?.children)) { const button = findButton(child); if (button) return button }
    return null
  }
  const button = findButton(ErrorView(element.props))
  assert.ok(button)
  button.props.onClick()
  assert.equal(retries, 1)
})
