// Local presentation check with synthetic account data; no app server or credentials.
// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-dashboard-footer-browser.cjs
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

let pathname = '/dashboard/account'
const empty = () => null
const Link = ({ children, ...props }) => React.createElement('a', props, children)
function load(path, mocks = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, process: { env: {} }, require(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === 'next/link') return Link
    if (name === 'next/navigation') return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(), redirect() { throw Error('Unexpected redirect') } }
    if (name.endsWith('.css')) return {}
    return require(name)
  } }, { filename: path })
  return module.exports.default
}

const Information = load('components/account/AccountInformationLinks.tsx')
const Phone = load('components/phone-app/PhoneAppFrame.tsx', { '@/components/ActionArrow': empty })
const Account = load('components/account/AccountDashboard.tsx', {
  './AccountInformationLinks': Information, '@/components/phone-app/PhoneAppFrame': Phone,
  '@/components/AccountProfileForm': empty, './LogoutButton': empty, './BillingControls': empty,
  './hooks': { useAccountData: value => value, useClientProfile: value => value.profile },
  '@/components/navigation/DashboardMoreMenu': empty,
  '@/lib/entitlements': { normalizeProgramTier: value => value },
  '@/components/DailyDisplayPreferences': empty, './AppleHealthExportImport': empty,
})
const Navigation = load('components/navigation/ClientDashboardNav.tsx', { '@/lib/analytics': { trackEvent() {} } })
const PublicFooter = load('components/PublicSiteFooter.tsx')
const Footer = load('components/LegalFooter.tsx')

async function shell(tier, children) {
  const Layout = load('app/dashboard/layout.tsx', {
    '@/lib/dashboard/getDashboardContext': { async getDashboardContext() { return { client: { client_id: 'SYNTHETIC', program: tier }, user: { id: 'SYNTHETIC' }, supabase: {} } } },
    '@/lib/legal/hasCurrentLegalAcceptance': {}, '@/components/DailyPlanRefresh': empty,
    '@/components/navigation/ClientDashboardNav': Navigation,
    '@/lib/dashboard/isClientOnboardingComplete': { isClientOnboardingComplete: () => true },
    '@/lib/commerce/access': { hasMemberAccess: () => true },
    '@/components/tutorial/TutorialProvider': { TutorialProvider: ({ children }) => children },
    '@/components/tutorial/TutorialDevPanel': empty, '@/components/tutorial/TutorialRenderer': empty,
    '@/components/program-dashboard/DashboardLoadingShell': empty,
    '@/lib/timezone': { getClientTimeZone: () => 'UTC' },
    '@/lib/membership/policy': { parseMembershipTier: value => value },
    '@/components/membership/MembershipExperienceCard': empty,
  })
  const pending = Layout({ children }).props.children
  return await pending.type(pending.props)
}

const css = readFileSync('app/styles/anastasis-palette.css', 'utf8') + '\n'
  + readFileSync('app/globals.css', 'utf8').replace(/^@import[^;]+;/gm, '') + '\n'
  + readFileSync('components/phone-app/phone-app.css', 'utf8') + '\n'
  + readFileSync('components/navigation/guided-navigation.css', 'utf8')
const expectedHrefs = ['/what-is-anastasis', '/program', '/about', '/terms', '/privacy', '/health-disclaimer', '/refund-policy', '/research-consent', '/support']

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  let geometryCases = 0, keyboardCases = 0
  try {
    for (const width of [390, 1024]) for (const safeArea of [0, 34]) {
      await page.setViewportSize({ width, height: 844 })
      // Controlled inset substitution tests the CSS geometry, not a physical device.
      const styles = css.replace(/env\(safe-area-inset-bottom\)/g, `${safeArea}px`)
      for (const tier of ['free', 'tracker', 'ember', 'ignite', 'phoenix', null]) {
        pathname = '/dashboard/account'
        const initialData = { profile: { clientId: 'SYNTHETIC', name: 'Test Member', email: 'test@example.invalid', program: tier, avatarUrl: null, subscriptionStatus: null }, billing: { connected: false, billingType: null } }
        const account = React.createElement(Account, { initialData, client: {}, user: { email: null } })
        const html = renderToStaticMarkup(React.createElement(React.Fragment, null, await shell(tier, account), React.createElement(PublicFooter, null, React.createElement(Footer))))
        await page.setContent(`<style>${styles}</style>${html}`)
        assert.equal(await page.locator('footer').count(), 0)
        assert.equal(await page.getByRole('navigation', { name: 'Member navigation', exact: true }).count(), 1)
        const links = page.getByRole('navigation', { name: 'About, policies and support links', exact: true }).getByRole('link')
        assert.deepEqual(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), expectedHrefs)
        await links.first().focus()
        for (let i = 0; i < 9; i++) {
          if (i) await page.keyboard.press('Tab')
          const active = await page.evaluate(() => ({ href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle, height: document.activeElement.getBoundingClientRect().height }))
          assert.equal(active.href, expectedHrefs[i])
          assert.equal(active.outline, 'solid')
          assert.ok(active.height >= 44)
        }
        keyboardCases++
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const geometry = await page.evaluate(() => {
          const shell = document.querySelector('.dashboard-client-shell'), surface = document.querySelector('.phone-app-surface'), main = surface.querySelector('main')
          const nav = document.querySelector('.client-dashboard-nav'), section = document.querySelector('.account-information')
          return { clearance: parseFloat(getComputedStyle(shell).paddingBottom), surfacePadding: getComputedStyle(surface).paddingBottom,
            mainPadding: getComputedStyle(main).paddingBottom, floor: getComputedStyle(surface).minHeight,
            finalLink: section.querySelector('li:last-child a').getBoundingClientRect().bottom,
            navTop: nav.getBoundingClientRect().top, sectionBottom: section.getBoundingClientRect().bottom,
            shellBottom: shell.getBoundingClientRect().bottom, overflow: document.documentElement.scrollWidth > innerWidth }
        })
        const expectedClearance = (['ember', 'ignite', 'phoenix'].includes(tier) ? (width <= 720 ? 94 : 108) : (width <= 720 ? 110 : 128)) + safeArea
        assert.equal(geometry.clearance, expectedClearance)
        assert.equal(geometry.surfacePadding, '0px'); assert.equal(geometry.mainPadding, '0px'); assert.equal(geometry.floor, '0px')
        assert.ok(geometry.finalLink <= geometry.navTop - 16, JSON.stringify({ width, safeArea, tier, geometry }))
        assert.ok(Math.abs(geometry.shellBottom - geometry.sectionBottom - geometry.clearance) <= 1, 'Only shell clearance follows the last Account panel')
        assert.equal(geometry.overflow, false)
        geometryCases++
      }
      for (const contentHeight of [240, 2400]) {
        pathname = '/dashboard/program/ignite'
        const content = React.createElement('main', { className: 'today-dashboard' }, React.createElement('div', { style: { height: contentHeight } }), React.createElement('button', { id: 'last-action' }, 'Final action'))
        await page.setContent(`<style>${styles}</style>${renderToStaticMarkup(await shell('ignite', content))}`)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const [lastBottom, navTop] = await page.evaluate(() => [document.querySelector('#last-action').getBoundingClientRect().bottom, document.querySelector('.client-dashboard-nav').getBoundingClientRect().top])
        assert.ok(lastBottom <= navTop - 16)
        geometryCases++
      }
      pathname = '/dashboard/onboarding'
      await page.setContent(`<style>${styles}</style>${renderToStaticMarkup(await shell('ignite', React.createElement('main', null, 'Onboarding')))}`)
      assert.equal(await page.locator('.client-dashboard-nav').count(), 0)
      assert.equal(await page.locator('.dashboard-client-shell').evaluate(node => getComputedStyle(node).paddingBottom), '0px')
      geometryCases++
    }
    console.log(JSON.stringify({ result: 'PASS', geometryCases, keyboardCases, browser: await browser.version(), widths: [390, 1024], simulatedBottomInsets: [0, 34], limitation: 'Synthetic server-rendered layout with unrelated account services mocked; no authenticated end-to-end or physical installed-PWA verification.' }, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
