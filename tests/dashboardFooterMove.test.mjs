import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
const defaultExport = component => ({ __esModule: true, default: component })
const nodes = (tree, match) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, match))
  : !tree || typeof tree !== 'object' ? [] : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]
const linksIn = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(([, href, label]) => [label, href])
const expectedLinks = [
  ['What is Anastasis?', '/what-is-anastasis'], ['Programs', '/program'], ['About Anastasis', '/about'],
  ['Terms', '/terms'], ['Privacy', '/privacy'], ['Health Disclaimer', '/health-disclaimer'],
  ['Billing / Refunds', '/refund-policy'], ['Research Consent', '/research-consent'], ['Customer support', '/support'],
]
function load(path, mocks = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(code, { module, exports: module.exports, URL, Date, require(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === 'next/link') return defaultExport(Link)
    if (name.endsWith('.css')) return {}
    return require(name)
  } }, { filename: path })
  return module.exports
}
const LegalFooter = load('components/LegalFooter.tsx').default
const AccountInformationLinks = load('components/account/AccountInformationLinks.tsx').default

test('footer boundary hides every dashboard route including loading/error paths and restores public pages', () => {
  let pathname = '/'
  const PublicSiteFooter = load('components/PublicSiteFooter.tsx', { 'next/navigation': { usePathname: () => pathname } }).default
  const footer = React.createElement(LegalFooter)
  const routeFiles = readdirSync('app/dashboard', { recursive: true })
    .filter(path => /(?:^|\/)(?:page|layout|loading|error|not-found)\.tsx$/.test(path))
  assert.ok(routeFiles.includes('page.tsx'))
  assert.ok(routeFiles.includes('loading.tsx'))
  assert.ok(routeFiles.some(path => path.endsWith('/error.tsx')))
  for (const file of routeFiles) {
    const route = `/dashboard/${file}`.replace(/\/(?:page|layout|loading|error|not-found)\.tsx$/, '')
    for (const tier of ['ember', 'ignite', 'phoenix']) {
      pathname = route.replace('[program]', tier).replace(/\[[^\]]+\]/g, 'synthetic-item')
      assert.equal(PublicSiteFooter({ children: footer }), null, `${file}: ${pathname}`)
      assert.equal(renderToStaticMarkup(React.createElement(PublicSiteFooter, null, footer)), '', pathname)
    }
  }
  for (const route of ['/dashboard/', '/dashboard/future-route/deep-child']) {
    pathname = route
    assert.equal(PublicSiteFooter({ children: footer }), null, route)
  }
  // Reuse the same component while navigating out of the dashboard, as client navigation does.
  const publicFooter = renderToStaticMarkup(footer)
  for (const route of ['/', '/what-is-anastasis', '/program', '/about', '/terms', '/privacy', '/health-disclaimer',
    '/refund-policy', '/research-consent', '/support', '/legal/acceptance', '/dashboardish', '/dashboard-preview/account']) {
    pathname = route
    assert.equal(PublicSiteFooter({ children: footer }), footer, route)
    assert.equal(renderToStaticMarkup(React.createElement(PublicSiteFooter, null, footer)), publicFooter, route)
  }
})

test('Account information exposes the unchanged nine public links in a labeled section, navigation and list', () => {
  const tree = AccountInformationLinks()
  assert.equal(tree.type, 'section')
  const headings = nodes(tree, node => node.type === 'h2')
  assert.equal(headings.length, 1)
  assert.equal(tree.props['aria-labelledby'], headings[0].props.id)
  assert.equal(headings[0].props.children, 'About, policies & support')
  const nav = nodes(tree, node => node.type === 'nav')
  assert.equal(nav.length, 1)
  assert.equal(nav[0].props['aria-label'], 'About, policies and support links')
  const lists = nodes(nav[0], node => node.type === 'ul')
  assert.equal(lists.length, 1)
  assert.equal(nodes(lists[0], node => node.type === 'li').length, 9)
  for (const link of nodes(lists[0], node => node.type === Link)) {
    assert.equal(link.props.tabIndex, undefined, 'Links remain in the normal keyboard tab sequence.')
    assert.equal(link.props['aria-hidden'], undefined)
  }
  const html = renderToStaticMarkup(React.createElement(AccountInformationLinks))
  const publicHtml = renderToStaticMarkup(React.createElement(LegalFooter))
  assert.deepEqual(linksIn(html), expectedLinks)
  assert.deepEqual(linksIn(html), linksIn(publicHtml))
  assert.doesNotMatch(html, /<footer|Health &amp; Performance Concierge Platform for Women/)
})

test('shared Account renders information links for every tier while keeping existing account controls', () => {
  const marker = name => defaultExport(() => React.createElement('div', { 'data-testid': name }))
  const AccountDashboard = load('components/account/AccountDashboard.tsx', {
    './AccountInformationLinks': defaultExport(AccountInformationLinks),
    '@/components/AccountProfileForm': marker('profile-form'),
    './LogoutButton': defaultExport(() => React.createElement('button', null, 'Log out')),
    './BillingControls': marker('billing-controls'),
    './hooks': { useAccountData: data => data, useClientProfile: data => data.profile },
    '@/components/navigation/DashboardMoreMenu': marker('more-menu'),
    '@/lib/entitlements': { normalizeProgramTier: program => program },
    '@/components/phone-app/PhoneAppFrame': defaultExport(({ children }) => React.createElement('div', null, children)),
    '@/components/DailyDisplayPreferences': marker('display-preferences'),
    './AppleHealthExportImport': marker('health-export-import'),
  }).default
  for (const program of ['free', 'tracker', 'ember', 'ignite', 'phoenix', 'unknown']) {
    const initialData = {
      profile: { clientId: 'synthetic-account', name: 'Synthetic Member', email: 'synthetic@example.invalid',
        program, avatarUrl: null, subscriptionStatus: null },
      billing: { connected: false, billingType: null },
    }
    const props = { initialData, client: {}, user: { email: null } }
    const tree = AccountDashboard(props)
    assert.equal(nodes(tree, node => node.type === AccountInformationLinks).length, 1, program)
    const html = renderToStaticMarkup(React.createElement(AccountDashboard, props))
    const information = html.match(/<section\b[^>]*aria-labelledby="account-information-title"[^>]*>([\s\S]*?)<\/section>/)
    assert.ok(information, program)
    assert.deepEqual(linksIn(information[1]), expectedLinks, program)
    assert.equal((html.match(/id="account-information-title"/g) || []).length, 1, program)
    for (const name of ['display-preferences', 'profile-form', 'billing-controls', 'health-export-import']) {
      assert.ok(html.includes(`data-testid="${name}"`), `${program}: ${name}`)
    }
    for (const id of ['personal-info', 'security', 'notifications', 'billing']) assert.ok(html.includes(`id="${id}"`), `${program}: ${id}`)
    assert.match(html, /<button>Log out<\/button>/)
    assert.doesNotMatch(html, /<footer|Health &amp; Performance Concierge Platform for Women/)
  }
})

test('root wraps only the global footer and keeps consent, PWA registration and analytics outside its boundary', () => {
  let pathname = '/dashboard/account'
  const PublicSiteFooter = load('components/PublicSiteFooter.tsx', { 'next/navigation': { usePathname: () => pathname } }).default
  const marker = name => () => React.createElement('div', { 'data-testid': name })
  const CookieBanner = marker('cookie-banner'), PwaRegistration = marker('pwa-registration'), DeferredAnalytics = marker('analytics')
  const RootLayout = load('app/layout.tsx', {
    '../components/CookieBanner': defaultExport(CookieBanner),
    '@/components/AuthButton': defaultExport(marker('auth-button')),
    '@/components/DeferredAnalytics': defaultExport(DeferredAnalytics),
    '@/components/PwaRegistration': defaultExport(PwaRegistration),
    '@/components/LegalFooter': defaultExport(LegalFooter),
    '@/components/PublicSiteFooter': defaultExport(PublicSiteFooter),
    '@/components/assessments/StrengthHistoryGuardRoot': defaultExport(marker('history-guard')),
    '@/lib/seo': { SITE_URL: 'https://example.test', absoluteUrl: path => `https://example.test${path}` },
  }).default
  const content = React.createElement('main', { 'data-testid': 'page-content' }, 'Current page')
  const root = RootLayout({ children: content })
  const body = nodes(root, node => node.type === 'body')[0]
  const children = React.Children.toArray(body.props.children)
  const boundaries = children.filter(node => node.type === PublicSiteFooter)
  assert.equal(boundaries.length, 1)
  assert.equal(boundaries[0].props.children.type, LegalFooter)
  assert.equal(React.Children.count(boundaries[0].props.children), 1)
  assert.ok(children.some(node => node.type === content.type && node.props['data-testid'] === 'page-content'))
  for (const component of [CookieBanner, PwaRegistration, DeferredAnalytics]) {
    assert.equal(children.filter(node => node.type === component).length, 1)
  }
  const dashboardHtml = renderToStaticMarkup(root)
  assert.doesNotMatch(dashboardHtml, /<footer|Health &amp; Performance Concierge Platform for Women/)
  for (const name of ['page-content', 'cookie-banner', 'pwa-registration', 'analytics']) assert.ok(dashboardHtml.includes(`data-testid="${name}"`))
  pathname = '/'
  const publicHtml = renderToStaticMarkup(root)
  assert.equal((publicHtml.match(/<footer\b/g) || []).length, 1)
  assert.match(publicHtml, /Anastasis — Health &amp; Performance Concierge Platform for Women/)
})
