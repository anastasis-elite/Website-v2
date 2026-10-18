const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium } = require('/Applications/Codex.app/Contents/Resources/cua_node/lib/node_modules/playwright')
const origin = 'http://127.0.0.1:3161'
const h1 = 'You carry enough. Your health shouldn’t be one more thing you have to figure out.'
const out = __dirname
const report = { priorCandidate: '4b049d530a45e296dbbd8afeadd3b5d97ffc97a0', scope: 'Actual corrected production build; synthetic price/API failures and blocked external requests; no member/Auth/payment/provider acceptance', started: new Date().toISOString(), viewports: [], requests: [], pageErrors: [], consoleErrors: [], failures: [] }
fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true })
function fileLabel(route) { return route === '/' ? 'home' : route.slice(1).replaceAll('/', '_') }
async function capture(page, label) {
  await page.evaluate(() => document.fonts.ready)
  const r = await page.evaluate(() => {
    const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'
    const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height } }
    return { url: location.href, viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth, h1: [...document.querySelectorAll('h1')].map(n => ({ text: n.textContent.trim(), box: box(n) })), actions: [...document.querySelectorAll('main a, main button')].filter(visible).map(n => ({ text: n.textContent.trim(), href: n.getAttribute('href'), disabled: !!n.disabled, box: box(n), clipped: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 })), bodyText: document.body.innerText }
  })
  r.viewportScreenshot = path.join('screenshots', label + '-viewport.png')
  r.fullScreenshot = path.join('screenshots', label + '-full.png')
  await page.screenshot({ path: path.join(out, r.viewportScreenshot), animations: 'disabled' })
  await page.screenshot({ path: path.join(out, r.fullScreenshot), fullPage: true, animations: 'disabled' })
  return r
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/lynkayfaiavelin/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell', env: { PATH: process.env.PATH, TMPDIR: '/tmp' }, args: ['--disable-background-networking', '--disable-component-update', '--disable-domain-reliability', '--no-first-run'] })
  try {
    for (const [device, viewport, oldY, baseY] of [['mobile', { width: 390, height: 844 }, 1537.5, 1484.3125], ['desktop', { width: 1440, height: 1000 }, 1229.984375, 1143.984375]]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' })
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url())
        const row = { device, method: req.method(), url: url.href }
        if (url.origin !== origin) { row.disposition = 'external-blocked'; report.requests.push(row); return route.abort('blockedbyclient') }
        if (url.pathname.startsWith('/api/')) { row.disposition = 'synthetic-api503-fulfilled'; report.requests.push(row); return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic visual check: live API disabled.' }) }) }
        if (!['GET', 'HEAD'].includes(req.method())) { row.disposition = 'mutation-blocked'; report.requests.push(row); return route.abort('blockedbyclient') }
        row.disposition = 'loopback-read-allowed'; report.requests.push(row); return route.continue()
      })
      const page = await context.newPage()
      page.on('pageerror', e => report.pageErrors.push({ device, url: page.url(), error: e.message }))
      page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ device, url: page.url(), text: message.text() }) })
      const record = { device, viewport, pages: [], assertions: [] }; report.viewports.push(record)
      try {
        for (const route of ['/', '/program', '/program/ignite', '/guide', '/program/phoenix/support', '/support', '/audit', '/program/phoenix/support/apply', '/apply']) {
          const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.locator('h1').first().waitFor()
          if (await page.getByRole('button', { name: 'Decline', exact: true }).count()) await page.getByRole('button', { name: 'Decline', exact: true }).click()
          await page.waitForTimeout(350)
          const receipt = await capture(page, device + '-' + fileLabel(route)); receipt.status = response.status(); record.pages.push(receipt)
          assert.equal(receipt.status, ['/program/phoenix/support/apply', '/apply'].includes(route) ? 404 : 200)
          assert.ok(receipt.scrollWidth <= viewport.width + 1, 'document horizontal overflow: ' + route)
          assert.ok(!receipt.actions.some(a => a.clipped), 'clipped action label: ' + route)
          if (route === '/') {
            assert.equal(receipt.h1[0].text, h1)
            const cta = receipt.actions.find(a => a.href === '/audit')
            assert.ok(cta, 'audit primary action exists')
            record.homeCta = { text: cta.text, href: cta.href, y: cta.box.y, priorCandidateY: oldY, baselineY: baseY, improvementFromPriorPx: oldY - cta.box.y, deltaFromBaselinePx: cta.box.y - baseY, aboveFold: cta.box.y + cta.box.height <= viewport.height }
            assert.ok(cta.box.y <= baseY + 1, 'copy should recover the introduced CTA distance')
            await page.locator('main a[href="/audit"]').first().scrollIntoViewIfNeeded()
            await page.screenshot({ path: path.join(out, 'screenshots', device + '-home-cta.png'), animations: 'disabled' })
          }
          if (route === '/program/ignite') { assert.equal(receipt.h1[0].text, 'Guidance with more context.'); assert.ok(!receipt.h1[0].text.includes('Corrective')) }
          if (route === '/program') { assert.ok(receipt.bodyText.includes('The goal is refined resilience.')); assert.ok(!receipt.bodyText.includes('The goal is expanded capacity.')) }
          if (route === '/guide') { assert.ok(receipt.bodyText.includes('not available yet')); assert.ok(receipt.actions.some(a => a.text === 'Join The Waitlist' && a.href === 'https://checkout.anastasiselite.com/b/fZu3cu7rdgQvc5T8D74ko02')) }
          if (route === '/program/phoenix/support') assert.ok(receipt.actions.some(a => a.text === 'Continue' && a.href === '/program/phoenix/support/apply'))
          console.log('CAPTURE', device, route, receipt.status)
        }
      } catch (e) { report.failures.push({ device, error: e.stack }) }
      finally { await context.close() }
    }
  } finally { await browser.close(); report.finished = new Date().toISOString(); fs.writeFileSync(path.join(out, 'visual-report.json'), JSON.stringify(report, null, 2) + '\n') }
  assert.equal(report.failures.length, 0, JSON.stringify(report.failures))
  assert.equal(report.pageErrors.length, 0, JSON.stringify(report.pageErrors))
})().catch(e => { report.fatal = e.stack; fs.writeFileSync(path.join(out, 'visual-report.json'), JSON.stringify(report, null, 2) + '\n'); console.error(e); process.exitCode = 1 })
