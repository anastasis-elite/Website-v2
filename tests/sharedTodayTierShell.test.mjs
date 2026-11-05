import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const theme = { surface: 'today-surface-token', streakBadge: 'today-streak-token' }
const modules = new Map()
function Workspace({ tier, logic, schedule, recipes }) {
  return React.createElement('section', { className: 'tier-dashboard-workspace daily-home', 'data-tier': tier,
    'data-quiet': schedule.preferences.carouselStyle === 'step', 'data-client': logic.client.id,
    'data-recipes': recipes?.length || 0 },
  React.createElement('a', { href: '/dashboard/schedule' }, 'Open schedule'),
  React.createElement('button', { type: 'button' }, 'Today’s progress'))
}
function load(path) {
  path = resolve(path)
  if (modules.has(path)) return modules.get(path).exports
  const module = { exports: {} }; modules.set(path, module)
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(source, { module, exports: module.exports, Date, Intl, require(name) {
    if (name.endsWith('.webp')) return { src: `/_next/static/media/${name.split('/').at(-1)}` }
    if (name.endsWith('.module.css')) return { __esModule: true, default: theme }
    if (name === '@/components/program-dashboard/TierAwareDashboardWorkspace') return { __esModule: true, default: Workspace }
    const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
    if (!target) return require(name)
    let file = target
    if (!extname(file)) {
      try { readFileSync(file + '.ts'); file += '.ts' } catch { file += '.tsx' }
    }
    return load(file)
  } }, { filename: path })
  return module.exports
}

const Shared = load('components/program-dashboard/SharedTodayDashboard.tsx').default
const Header = load('components/program-dashboard/TodayDashboardHeader.tsx').default
const wrappers = Object.fromEntries(['ember', 'ignite', 'phoenix'].map(tier => [tier,
  load(`components/program-dashboard/${tier[0].toUpperCase() + tier.slice(1)}Dashboard.tsx`).default]))
const fixture = (tier, carouselStyle = 'section', count = 3) => ({
  logic: { program: tier, client: { id: 'SYNTHETIC-SHELL', name: 'Synthetic member' }, flameState: { streak: count }, streakAvailable: true },
  schedule: { date: '2026-11-03', now: '2026-11-03T14:00:00Z', timezone: 'America/Chicago', preferences: { carouselStyle } },
})

// Frozen pre-consolidation d9408f7 shell contract. Actual unchanged Header and
// badge render in both paths; the independently changing workspace is a stub.
function originalShell(tier, { logic, schedule, recipes = [] }) {
  return React.createElement('div', { className: `today-dashboard ${theme.surface}`, 'data-tier': tier },
    React.createElement('div', { className: 'today-shell' },
      React.createElement(Header, { logic, schedule }),
      React.createElement(Workspace, { tier, logic, schedule, ...(tier === 'phoenix' ? { recipes } : {}) })))
}

test('all three shared tier shells retain exact pre-consolidation header, tokens and rendered layout', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) for (const style of ['section', 'step']) for (const streak of [0, 3]) {
    const props = { ...fixture(tier, style, streak), trackLabel: 'Existing track label', recipes: [{ id: 'synthetic-recipe' }] }
    const html = renderToStaticMarkup(React.createElement(wrappers[tier], props))
    assert.equal(html, renderToStaticMarkup(originalShell(tier, props)))
    assert.match(html, /class="today-dashboard today-surface-token"/)
    assert.match(html, /class="today-satin"/)
    assert.match(html, new RegExp(`aria-label="${streak} days streak"`))
    assert.match(html, /aria-label="This week"/)
    assert.equal((html.match(/class="today-shell"/g) || []).length, 1)
  }
})

test('fixed tier selection and original input identities are forwarded without changing recipe defaults or public wrapper props', () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const props = { ...fixture(tier), trackLabel: 'Existing track label', recipes: [{ id: 'keep-this-reference' }] }
    const element = wrappers[tier](props)
    assert.equal(element.type, Shared)
    assert.equal(element.props.tier, tier)
    assert.equal(element.props.logic, props.logic)
    assert.equal(element.props.schedule, props.schedule)
    const shell = Shared(element.props)
    const children = React.Children.toArray(shell.props.children.props.children)
    assert.equal(children[0].type, Header)
    assert.equal(children[1].type, Workspace)
    assert.equal(children[1].props.logic, props.logic)
    assert.equal(children[1].props.schedule, props.schedule)
    assert.equal(children[1].props.tier, tier)
    if (tier === 'phoenix') assert.equal(children[1].props.recipes, props.recipes)
    else assert.equal(Object.hasOwn(children[1].props, 'recipes'), false)
  }
  const phoenix = wrappers.phoenix({ ...fixture('phoenix'), trackLabel: 'Still accepted' })
  assert.equal(Array.isArray(phoenix.props.recipes), true)
  assert.equal(phoenix.props.recipes.length, 0)
})

test('the shared shell adds no focusable or click-intercepting container and leaves native controls reachable', () => {
  const props = fixture('ignite')
  const root = Shared({ tier: 'ignite', ...props })
  for (const node of [root, root.props.children]) {
    assert.equal(node.type, 'div')
    assert.equal(node.props.tabIndex, undefined)
    assert.equal(node.props.role, undefined)
    assert.equal(node.props.onClick, undefined)
    assert.equal(node.props.onKeyDown, undefined)
  }
  const html = renderToStaticMarkup(React.createElement(wrappers.ignite, props))
  assert.match(html, /<a href="\/dashboard\/schedule">Open schedule<\/a>/)
  assert.match(html, /<button type="button">Today’s progress<\/button>/)
  assert.doesNotMatch(html, /tabindex=|role="button"/)
})
