// Opt-in localhost QA. All reads and writes use the disposable dashboard fixture.
// This does not verify a connected account or make any production request.
const assert = require('node:assert/strict')
const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.DASHBOARD_QA_URL || 'http://127.0.0.1:3100'
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) throw new Error('Only an isolated localhost fixture is allowed.')
const output = resolve(process.env.DASHBOARD_QA_OUTPUT || 'docs/screenshots/guided-today')
mkdirSync(output, { recursive: true })
const checks = []
const pass = name => { checks.push(name); console.log(`PASS ${name}`) }

;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) })
  try {
    for (const [device, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 1000 }]]) {
      for (const tier of ['ember', 'ignite', 'phoenix']) {
        const context = await browser.newContext({ viewport, timezoneId: 'America/Chicago', reducedMotion: 'reduce' })
        // Fail closed: unexpected live-provider traffic never leaves this browser.
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
        const page = await context.newPage()
        page.setDefaultTimeout(15000)
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        const go = async (view = 'home') => {
          await page.goto(`${origin}/local-dashboard-qa?view=${view}&tier=${tier}`)
          await page.locator('[data-qa-date]').waitFor()
          const decline = page.getByRole('button', { name: 'Decline', exact: true })
          if (await decline.isVisible()) await decline.click()
        }
        const reload = async () => { await page.reload(); await page.locator('[data-qa-date]').waitFor() }
        const row = id => page.getByTestId('today-activities').locator(`li[data-activity-id="${id}"]`)
        const next = page.getByTestId('guided-next-step')
        const completed = async () => Number(await page.getByRole('progressbar').getAttribute('aria-valuenow'))
        const state = async () => page.evaluate(() => {
          const date = document.querySelector('[data-qa-date]').getAttribute('data-qa-date')
          const tier = new URL(location.href).searchParams.get('tier')
          return JSON.parse(localStorage.getItem(`local-qa-dashboard-v2:${tier}:${date}`) || '{}')
        })
        const injectFailure = async flag => {
          await page.evaluate(flag => {
            const date = document.querySelector('[data-qa-date]').getAttribute('data-qa-date')
            const tier = new URL(location.href).searchParams.get('tier')
            const key = `local-qa-dashboard-v2:${tier}:${date}`
            const value = JSON.parse(localStorage.getItem(key) || '{}')
            value[flag] = true; localStorage.setItem(key, JSON.stringify(value))
          }, flag)
          await reload()
        }
        const screenshot = async name => {
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${device} ${tier} ${name} horizontal overflow`)
          await page.screenshot({ path: resolve(output, `${device}-${tier}-${name}.png`), fullPage: true })
        }

        await go()
        assert.equal(await next.count(), 1)
        assert.equal(await next.getAttribute('data-activity-id'), 'check-in')
        assert.equal(await completed(), 0)
        assert.ok(Number(await page.getByRole('progressbar').getAttribute('aria-valuemax')) > 0)
        const nav = page.getByRole('navigation', { name: 'Member navigation' })
        assert.deepEqual(await nav.locator('small').allTextContents(), ['Today', 'Schedule', 'Progress', 'You'])
        const navTargets = await nav.locator('[data-nav-item]').evaluateAll(links => links.map(link => {
          const box = link.getBoundingClientRect(); return { width: box.width, height: box.height, href: link.getAttribute('href') }
        }))
        assert.equal(navTargets.length, 4)
        assert.ok(navTargets.every(target => target.width >= 44 && target.height >= 44), 'navigation touch targets must be at least 44px: ' + JSON.stringify(navTargets))
        assert.ok(navTargets.some(target => target.href === '/dashboard/progress'))
        await nav.getByRole('button', { name: 'You', exact: true }).click()
        const you = page.getByRole('dialog', { name: /You/ })
        await you.waitFor()
        assert.equal(await you.getByRole('link', { name: 'Account & preferences', exact: true }).getAttribute('href'), '/dashboard/account')
        for (const label of ['Daily check-in', 'Workout', 'Nutrition & hydration', 'Recovery', 'Connected calendars']) assert.equal(await you.getByRole('link', { name: label, exact: true }).count(), 1)
        await page.keyboard.press('Escape')
        assert.equal(await nav.getByRole('button', { name: 'You', exact: true }).evaluate(button => document.activeElement === button), true)
        await screenshot('today-fresh')
        pass(`${device} ${tier}: one next action, real empty progress, four accessible destinations`)

        await injectFailure('failNextActivity')
        await next.getByRole('button', { name: 'Later today', exact: true }).click()
        await page.getByText('The activity could not be saved. Try again.', { exact: true }).waitFor()
        assert.equal(await row('check-in').getAttribute('data-status'), 'available')
        assert.equal((await state()).dailyGuide.activities['check-in'], undefined)
        await next.getByRole('button', { name: 'Later today', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('[data-testid="today-activities"] [data-activity-id="check-in"]')?.getAttribute('data-status') === 'deferred')
        assert.equal(await completed(), 0)
        assert.notEqual(await next.getAttribute('data-activity-id'), 'check-in')
        await reload()
        assert.equal(await row('check-in').getAttribute('data-status'), 'deferred')
        assert.notEqual(await next.getAttribute('data-activity-id'), 'check-in')
        await row('check-in').getByRole('button', { name: /^Resume activity/ }).click()
        await page.waitForFunction(() => document.querySelector('[data-testid="guided-next-step"]')?.getAttribute('data-activity-id') === 'check-in')
        pass(`${device} ${tier}: failed defer recovers, persisted defer stays quiet, resume restores availability`)

        // Only optional activities have skip controls; a skip never adds progress.
        const optional = page.getByTestId('today-activities').locator('li').filter({ has: page.locator('button').filter({ hasText: /^Skip for today$/ }) }).first()
        if (await optional.count()) {
          const id = await optional.getAttribute('data-activity-id')
          await optional.locator('summary').click()
          await optional.getByRole('button', { name: 'Skip for today', exact: true }).click()
          await page.waitForFunction(id => document.querySelector(`[data-testid="today-activities"] [data-activity-id="${id}"]`)?.getAttribute('data-status') === 'skipped', id)
          assert.equal(await completed(), 0)
          await reload()
          assert.equal(await row(id).getAttribute('data-status'), 'skipped')
          await row(id).getByRole('button', { name: /^Resume activity/ }).click()
          pass(`${device} ${tier}: optional skip persists without false completion`)
        }

        await row('schedule').locator('summary').click()
        await row('schedule').getByRole('button', { name: 'I’ve reviewed my schedule', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('[data-testid="today-activities"] [data-activity-id="schedule"]')?.getAttribute('data-status') === 'completed')
        await reload()
        assert.equal(await row('schedule').getAttribute('data-status'), 'completed')
        pass(`${device} ${tier}: explicit schedule review persists`)

        await next.getByRole('link', { name: 'Start daily check-in', exact: true }).click()
        await page.locator('.aos-check-in-form').waitFor()
        const contextDetails = page.locator('.aos-check-in-form details').first()
        assert.equal(await contextDetails.getAttribute('open'), null)
        const draftEnergy = page.getByRole('slider', { name: /^Energy/ })
        await draftEnergy.focus(); await draftEnergy.press('ArrowRight')
        const draftValue = await draftEnergy.inputValue()
        await reload()
        assert.equal(await draftEnergy.inputValue(), draftValue)
        assert.equal((await state()).checkIn.energy, undefined)
        pass(`${device} ${tier}: interrupted check-in draft resumes without recording unsaved answers`)
        await injectFailure('failNextCheckIn')
        const energyChoice = page.getByRole('button', { name: 'Doing okay', exact: true })
        if (await energyChoice.count()) await energyChoice.click()
        else { const energy = page.getByRole('slider', { name: /^Energy/ }); await energy.focus(); await energy.press('ArrowRight') }
        await page.getByRole('button', { name: /Save Daily Check-In|Save check-in/i }).click()
        await page.getByText('Check-in could not be saved. Try again.', { exact: true }).waitFor()
        assert.equal((await state()).checkIn?.energy, undefined)
        await page.getByRole('button', { name: /Save Daily Check-In|Save check-in/i }).click()
        await page.waitForFunction(() => {
          const date = document.querySelector('[data-qa-date]').getAttribute('data-qa-date')
          const tier = new URL(location.href).searchParams.get('tier')
          return typeof JSON.parse(localStorage.getItem(`local-qa-dashboard-v2:${tier}:${date}`)).checkIn.energy === 'number'
        })
        const saved = await state()
        assert.equal(saved.checkInWrites, 1)
        for (const key of ['sleepHours', 'sleepQuality', 'stress', 'soreness', 'mood', 'hunger', 'notes']) assert.equal(saved.checkIn[key], undefined, `${key} should not be fabricated`)
        await reload()
        await screenshot('check-in-saved')
        await page.getByRole('link', { name: /See today’s next step|Back to Today|Return to Today|Done — what’s next/ }).first().click()
        await next.waitFor()
        assert.equal(await row('check-in').getAttribute('data-status'), 'completed')
        assert.equal(await completed(), 1)
        assert.notEqual(await next.getAttribute('data-activity-id'), 'check-in')
        await reload()
        assert.equal(await completed(), 1)
        pass(`${device} ${tier}: failed check-in retries, one save, honest answered fields, reload and next step`)

        await row('water').getByRole('link').click()
        await page.getByRole('button', { name: 'Water', exact: true }).click()
        await page.getByRole('button', { name: 'Log water', exact: true }).click()
        await page.getByLabel('Amount (oz)', { exact: true }).fill('8')
        await page.getByRole('button', { name: 'Log 8 oz', exact: true }).click()
        await page.getByText('8 oz saved. Today’s plan is updated.', { exact: true }).waitFor()
        assert.equal((await state()).water, 8)
        await page.getByLabel('Close water entry').click()
        await go()
        assert.equal(await row('water').getAttribute('data-status'), 'in_progress')
        assert.equal(await completed(), 1)
        await screenshot('today-returning')
        pass(`${device} ${tier}: direct hydration workflow saves and returns as partial progress`)

        await nav.getByRole('link', { name: /Progress/ }).click()
        await page.getByRole('heading', { name: 'Your progress and assessments', exact: true }).waitFor()
        await screenshot('progress')
        await go('nutrition')
        await page.getByRole('button', { name: tier === 'ember' ? 'Macro Entry' : 'Food Log', exact: true }).click()
        if (tier !== 'ember') await page.getByRole('tab', { name: 'Search / manual', exact: true }).waitFor()
        assert.equal(await page.getByRole('tab', { name: 'Search / manual', exact: true }).count() > 0, tier !== 'ember')
        pass(`${device} ${tier}: progress destination and nutrition entitlements preserved`)
        if (device === 'mobile' && tier === 'ignite') {
          await page.setViewportSize({ width: 320, height: 740 })
          await go()
          await screenshot('today-320px')
          pass('320px IGNITE: guided Today fits narrow mobile')
        }
        assert.deepEqual(errors, [], `${device} ${tier} browser exceptions`)
        await context.close()
      }
    }
    writeFileSync(resolve(output, 'results.json'), JSON.stringify({ origin, environment: 'isolated fixture with simulated saves; external network blocked', checks }, null, 2) + '\n')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
