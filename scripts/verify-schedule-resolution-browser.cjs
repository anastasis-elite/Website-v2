// Opt-in localhost verification of real dashboard components with synthetic data.
// Transport receipts and persistence are simulated; this is not live-account QA.
const assert = require('node:assert/strict')
const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.DASHBOARD_QA_URL || 'http://127.0.0.1:3101'
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) throw new Error('Only an isolated localhost fixture is allowed.')
const output = resolve(process.env.DASHBOARD_QA_OUTPUT || 'docs/screenshots/schedule-resolution')
mkdirSync(output, { recursive: true })
const checks = []
const pass = name => { checks.push({ name, result: 'PASS' }); console.log(`PASS ${name}`) }

;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) })
  try {
    for (const width of [390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: 'America/Chicago', reducedMotion: 'reduce' })
      const external = []
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue()
        external.push(route.request().url()); return route.abort()
      })
      const page = await context.newPage()
      page.setDefaultTimeout(20000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const go = async (tier = 'ember', view = 'home') => {
        await page.goto(`${origin}/local-dashboard-qa?scenario=schedule&tier=${tier}&view=${view}`)
        await page.locator('[data-qa-scenario="schedule"]').waitFor()
        const decline = page.getByRole('button', { name: 'Decline', exact: true })
        if (await decline.isVisible()) await decline.click()
      }
      const reload = async () => { await page.reload(); await page.locator('[data-qa-scenario="schedule"]').waitFor() }
      const key = () => page.evaluate(() => `local-qa-dashboard-v2:${new URL(location.href).searchParams.get('tier')}:${document.querySelector('[data-qa-date]').getAttribute('data-qa-date')}:schedule`)
      const state = async () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), await key())
      const patch = async value => { await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) || '{}'), ...value })), { key: await key(), value }); await reload() }
      const eventActions = id => page.locator(`.schedule-event-actions[data-event-id="${id}"]`).first()
      const row = id => page.getByTestId('today-activities').locator(`li[data-activity-id="schedule-event:${id}"]`)
      const next = page.getByTestId('guided-next-step')
      const progress = async () => ({ completed: Number(await page.getByRole('progressbar').getAttribute('aria-valuenow')), total: Number(await page.getByRole('progressbar').getAttribute('aria-valuemax')) })
      const saved = async (id, field, value) => page.waitForFunction(({ id, field, value }) => {
        const tier = new URL(location.href).searchParams.get('tier'), date = document.querySelector('[data-qa-date]').getAttribute('data-qa-date')
        return JSON.parse(localStorage.getItem(`local-qa-dashboard-v2:${tier}:${date}:schedule`) || '{}').scheduleOverrides?.[id]?.[field] === value
      }, { id, field, value })
      const screenshot = async name => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px ${name}: no horizontal overflow`)
        await page.screenshot({ path: resolve(output, `${width}px-${name}.png`), fullPage: true })
      }

      await go()
      assert.equal(await next.getAttribute('data-activity-id'), 'qa-school-drop-off')
      const before = await progress(), initialCheckIn = (await state()).checkIn
      assert.equal(await next.getByRole('button', { name: 'Complete', exact: true }).count(), 1)
      assert.equal(await next.getByRole('button', { name: 'Skip', exact: true }).count(), 1)
      assert.equal(await next.getByRole('button', { name: 'Reschedule', exact: true }).count(), 0, 'Fixed recurring commitment does not move')
      const targets = await next.locator('button').evaluateAll(buttons => buttons.map(button => { const rect = button.getBoundingClientRect(); return { text: button.textContent, width: rect.width, height: rect.height } }))
      assert.ok(targets.every(target => target.width >= 44 && target.height >= 44), JSON.stringify(targets))
      await screenshot('ember-overdue-actions')
      pass(`${width}px EMBER: overdue School drop-off has accessible direct Complete and Skip`)

      await patch({ failNextSchedule: true })
      await next.getByRole('button', { name: 'Complete', exact: true }).click()
      await next.getByRole('alert').filter({ hasText: 'Schedule change could not be saved. Try again.' }).waitFor()
      assert.deepEqual(await progress(), before)
      assert.equal((await state()).scheduleWrites, 0)
      await next.getByRole('button', { name: 'Retry', exact: true }).click()
      await saved('qa-school-drop-off', 'status', 'completed')
      await page.waitForFunction(() => document.querySelector('[data-testid="guided-next-step"]')?.getAttribute('data-activity-id') !== 'qa-school-drop-off')
      assert.equal(await row('qa-school-drop-off').getAttribute('data-status'), 'completed')
      assert.deepEqual(await progress(), { completed: before.completed + 1, total: before.total })
      assert.equal((await state()).scheduleWrites, 1)
      await reload()
      assert.equal(await row('qa-school-drop-off').getAttribute('data-status'), 'completed')
      assert.equal(await next.getAttribute('data-activity-id'), 'qa-school-pick-up')
      pass(`${width}px EMBER: failed completion Retry persists once, advances next step and adds one required completion after refresh`)

      await next.getByRole('button', { name: 'Skip', exact: true }).click()
      const confirmation = next.getByRole('group', { name: 'Confirm skip', exact: true })
      await confirmation.waitFor()
      assert.equal((await state()).scheduleWrites, 1)
      await confirmation.getByRole('button', { name: 'Confirm skip', exact: true }).click()
      await saved('qa-school-pick-up', 'status', 'skipped')
      await page.waitForFunction(() => document.querySelector('[data-testid="guided-next-step"]')?.getAttribute('data-activity-id') === 'qa-household')
      assert.equal(await row('qa-school-pick-up').getAttribute('data-status'), 'skipped')
      assert.deepEqual(await progress(), { completed: before.completed + 1, total: before.total })
      pass(`${width}px EMBER: confirmed overdue fixed-task skip stays in history and adds no completion`)

      await next.getByRole('button', { name: 'Reschedule', exact: true }).click()
      const date = await page.locator('[data-qa-date]').getAttribute('data-qa-date')
      await next.getByLabel('New time (America/Chicago)', { exact: true }).fill(`${date}T20:00`)
      await next.getByRole('button', { name: 'Save new time', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[data-testid="today-activities"] li[data-activity-id="schedule-event:qa-household"]')?.getAttribute('data-status') === 'upcoming')
      const moved = (await state()).scheduleOverrides['qa-household']
      assert.ok(moved.adjusted_start_at && moved.adjusted_end_at)
      assert.equal(moved.status, 'scheduled')
      assert.deepEqual(await progress(), { completed: before.completed + 1, total: before.total })
      assert.equal(await next.getByText('This fits the next part of your schedule.', { exact: true }).count(), 1)
      pass(`${width}px EMBER: eligible task reschedules with explicit save, remains upcoming and does not falsely complete`)

      const informational = eventActions('qa-external')
      assert.equal(await informational.getByRole('link', { name: 'Open Event', exact: true }).count(), 1)
      for (const name of ['Complete', 'Skip', 'Reschedule']) assert.equal(await informational.getByRole('button', { name, exact: true }).count(), 0)
      await informational.getByRole('button', { name: 'Dismiss from Today', exact: true }).click()
      await informational.getByRole('button', { name: 'Confirm dismissal', exact: true }).click()
      await saved('qa-external', 'dismissed_from_today', date)
      assert.equal((await state()).scheduleOverrides['qa-external'].status, undefined)
      assert.equal((await state()).scheduleOverrides['qa-external'].adjusted_start_at, undefined)
      assert.deepEqual(await progress(), { completed: before.completed + 1, total: before.total })
      assert.deepEqual((await state()).checkIn, initialCheckIn)
      await reload()
      assert.equal(await eventActions('qa-external').count(), 0)
      pass(`${width}px EMBER: informational dismissal persists without changing provider event, required progress or actual check-in`)

      await go('ember', 'schedule')
      await page.getByRole('heading', { name: 'Your day, with room to breathe', exact: true }).waitFor()
      assert.equal(await page.locator('#event-qa-school-drop-off .schedule-event-actions').getByText('Done', { exact: true }).count(), 1)
      assert.equal(await page.locator('#event-qa-school-pick-up .schedule-event-actions').getByText('Skipped', { exact: true }).count(), 1)
      assert.equal(await page.locator('#event-qa-household').getByText(/Originally/).count(), 1)
      const history = page.getByRole('region', { name: 'Dismissed calendar events', exact: true })
      await history.getByRole('heading', { name: 'Community calendar meeting', exact: true }).waitFor()
      assert.equal(await history.getByRole('link', { name: 'Open Event', exact: true }).count(), 1)
      assert.equal(await page.getByText(`${before.completed + 1} of ${before.total} required activities completed. Skipped activities are not completed.`, { exact: true }).count(), 1)
      await screenshot('ember-schedule-history')
      pass(`${width}px EMBER: Schedule history and dynamic required progress match Today after reload`)

      await go()
      // Remove only the synthetic auth session. The fixture signs in again on reload.
      await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key) })
      await reload()
      assert.equal(await row('qa-school-drop-off').getAttribute('data-status'), 'completed')
      assert.equal(await row('qa-school-pick-up').getAttribute('data-status'), 'skipped')
      pass(`${width}px EMBER: simulated session re-entry retains saved outcomes (not live logout/login verification)`)

      await patch({ scheduleDelayMs: 250 })
      const writes = (await state()).scheduleWrites, requests = (await state()).scheduleRequests.length
      await eventActions('qa-reschedule').getByRole('button', { name: 'Complete', exact: true }).evaluate(button => { button.click(); button.click() })
      await saved('qa-reschedule', 'status', 'completed')
      assert.equal((await state()).scheduleWrites, writes + 1)
      assert.equal((await state()).scheduleRequests.length, requests + 1)
      pass(`${width}px EMBER: two rapid UI clicks send one action request`)

      for (const tier of ['ignite', 'phoenix']) {
        await go(tier)
        assert.equal(await next.getAttribute('data-activity-id'), 'qa-school-drop-off')
        await next.getByRole('button', { name: 'Complete', exact: true }).click()
        await saved('qa-school-drop-off', 'status', 'completed')
        assert.equal(await row('qa-school-drop-off').getAttribute('data-status'), 'completed')
        await screenshot(`${tier}-schedule-smoke`)
        pass(`${width}px ${tier.toUpperCase()}: dashboard and schedule completion smoke test`)
      }
      assert.deepEqual(errors, [], `${width}px browser exceptions`)
      assert.equal(external.filter(url => /googleapis|calendar|supabase/i.test(url)).length, 0, `No calendar/Supabase traffic escaped: ${external.join(', ')}`)
      await context.close()
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago' })
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    const page = await context.newPage()
    await page.goto(`${origin}/local-dashboard-qa?scenario=schedule&tier=ember`)
    await page.locator('[data-qa-scenario="schedule"]').waitFor()
    const conflict = await page.evaluate(async () => {
      const date = document.querySelector('[data-qa-date]').getAttribute('data-qa-date')
      return Promise.all(['complete', 'skip'].map(async action => {
        const result = await fetch('/api/schedule/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: 'qa-school-drop-off', date, action }) })
        return { status: result.status, data: await result.json() }
      }))
    })
    assert.deepEqual(conflict.map(result => result.status), [200, 409])
    pass('Synthetic transport rejects competing complete/skip requests with one saved terminal outcome; real API concurrency covered separately')
    await context.close()
    writeFileSync(resolve(output, 'results.json'), JSON.stringify({ origin, environment: 'Local synthetic fixture; real components; simulated persistence/authentication; all external traffic blocked', checks, notTested: ['Live EMBER account and Supabase persistence', 'Real logout and login', 'Provider calendar synchronization'] }, null, 2) + '\n')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
