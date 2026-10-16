// Opt-in real-component browser verification. Only localhost is accepted.
// Assessment/auth requests are intercepted with synthetic server-side memory;
// every external request is blocked. This does not claim live auth/RLS coverage.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.STRENGTH_QA_URL || 'http://127.0.0.1:3107'
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) throw new Error('Only an isolated localhost fixture is allowed.')
const output = resolve(process.env.STRENGTH_QA_OUTPUT || '/private/tmp/strength-assessment-browser-results')
await mkdir(output, { recursive: true })
const checks = [], errors = [], external = [], stores = new Map()
const currentPeriod = '2026-10-01'
const savedAt = '2026-10-16T04:30:00.000Z'
const fields = {
  birthdate: '1991-04-15', height_in: '65.', weight: '150.', weight_goal: 'Maintain strength', training_environment: 'home',
  shoulder_press_weight: '10.', shoulder_press_reps: '8', squat_weight: '45.', squat_reps: '8',
  bench_press_weight: '35.', bench_press_reps: '8', close_grip_press_weight: '25.', close_grip_press_reps: '8',
  romanian_deadlift_weight: '45.', romanian_deadlift_reps: '8', seated_row_weight: '35.', seated_row_reps: '8',
  bicep_curl_weight: '10.', bicep_curl_reps: '8', lateral_raise_weight: '5.', lateral_raise_reps: '8', plank_time: '30.',
}
const empty = Object.fromEntries(Object.keys(fields).map(key => [key, '']))
const pass = name => { checks.push({ name, result: 'PASS' }); console.log(`PASS ${name}`) }
function store(owner) {
  if (!stores.has(owner)) stores.set(owner, { records: new Map(), history: [], writes: [], finals: 0, failNextSave: false, offline: false })
  return stores.get(owner)
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) })

async function contextFor(owner, width = 390) {
  const cloud = store(owner)
  const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: 'Pacific/Auckland', reducedMotion: 'reduce' })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { external.push(url.origin); return route.abort() }
    if (url.pathname === '/api/auth/logout') return route.fulfill({ status: 200, json: { success: true } })
    if (url.pathname !== '/api/assessment-strength') return route.continue()
    if (cloud.offline) return route.abort('internetdisconnected')
    const method = request.method(), body = method === 'GET' ? null : request.postDataJSON()
    const period = body?.period || url.searchParams.get('period') || currentPeriod
    const selected = url.searchParams.get('assessmentId')
    let assessment = selected ? cloud.history.find(item => item.assessmentId === selected) : cloud.records.get(period)
    const previous = [...cloud.records.entries()].filter(([key, record]) => key < currentPeriod && record.status === 'draft').sort(([a], [b]) => b.localeCompare(a))[0]
    const response = value => ({ success: true, clientId: 'QA-STRENGTH-ONLY', period, currentPeriod, assessment: value || null,
      previousDraft: previous ? { ...previous[1], period: previous[0] } : null,
      history: cloud.history.map(({ assessmentId, assessmentDate, period }) => ({ assessmentId, assessmentDate, period, status: 'completed' })) })
    if (method === 'GET') return route.fulfill({ status: 200, json: response(assessment) })
    if (body.expectedClientId !== 'QA-STRENGTH-ONLY') return route.fulfill({ status: 409, json: { code: 'account_changed' } })
    cloud.writes.push({ method, period, revision: body.revision })
    if (cloud.failNextSave) { cloud.failNextSave = false; return route.fulfill({ status: 503, json: { code: 'save_failed' } }) }
    if (assessment?.status === 'completed') return route.fulfill({ status: 200, json: response(assessment) })
    if (body.revision !== (assessment?.revision || 0)) return route.fulfill({ status: 409, json: { code: 'conflict' } })
    if (method === 'POST' && (!(Number(body.values.height_in) > 0) || !(Number(body.values.weight) > 0))) return route.fulfill({ status: 400, json: { code: 'validation' } })
    await pause(150)
    assessment = { status: method === 'POST' ? 'completed' : 'draft', values: body.values,
      revision: (assessment?.revision || 0) + 1, savedAt, completedAt: method === 'POST' ? savedAt : null,
      assessmentDate: method === 'POST' ? savedAt : null, period,
      ...(method === 'POST' ? { assessmentId: `synthetic-${owner}-${cloud.finals + 1}` } : {}) }
    cloud.records.set(period, structuredClone(assessment))
    if (method === 'POST') { cloud.finals++; cloud.history.push(structuredClone(assessment)) }
    return route.fulfill({ status: 200, json: { ...response(assessment), ...(method === 'POST' ? { planStatus: 'generated', redirect: '/dashboard/program' } : {}) } })
  })
  context.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(25_000) })
  return context
}
async function open(context, pathname = '/dashboard/assessment/start2') {
  const page = await context.newPage()
  await page.goto(origin + pathname)
  if (pathname.includes('/start2')) await page.locator('#height_in').waitFor()
  return page
}
const valuesOnPage = page => page.locator('form input[name], form select[name]').evaluateAll(inputs => Object.fromEntries(inputs.map(input => [input.name, input.value])))
async function saved(page) {
  await page.getByText('In Progress · Your assessment was saved as a draft.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Save Draft', exact: true }).waitFor()
}
async function screenshot(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`)
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true })
}

try {
  const first = await contextFor('same-account')
  let page = await open(first, '/dashboard')
  await page.getByRole('link', { name: 'Start Assessment', exact: true }).click()
  await page.locator('#height_in').fill('6')
  await page.waitForTimeout(450)
  await page.locator('#height_in').fill('65.')
  await page.locator('#weight').fill('150.')
  assert.equal(store('same-account').writes.length, 0)
  await saved(page)
  assert.equal(store('same-account').writes.length, 1)
  assert.equal(store('same-account').records.get(currentPeriod).values.height_in, '65.')
  pass('Debounced cloud autosave preserves partial decimal strings and confirms its timestamp')
  for (const [key, value] of Object.entries(fields)) await page.locator(`#${key}`).fill(value).catch(async error => { if (key === 'training_environment') await page.locator(`#${key}`).selectOption(value); else throw error })
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  await saved(page)
  assert.deepEqual(await valuesOnPage(page), fields)
  await screenshot(page, '390px-cloud-draft')
  await first.close()
  const resumed = await contextFor('same-account')
  page = await open(resumed, '/dashboard')
  await page.getByRole('link', { name: 'Resume Assessment', exact: true }).click()
  await saved(page)
  assert.deepEqual(await valuesOnPage(page), fields)
  pass('Closing the browser context and reopening a fresh simulated authenticated session restores every saved value')

  store('same-account').offline = true
  await resumed.setOffline(true)
  await page.locator('#plank_time').fill('44.')
  const writesBefore = store('same-account').writes.length
  await page.waitForTimeout(900)
  await page.getByText(/You’re offline/).waitFor()
  assert.equal(store('same-account').writes.length, writesBefore)
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('link', { name: 'QA Dashboard', exact: true }).click()
  assert.match(page.url(), /assessment\/start2/)
  page.once('dialog', dialog => dialog.dismiss())
  await page.goBack({ timeout: 3000 }).catch(() => {})
  await page.waitForURL(/assessment\/start2/, { timeout: 3000 })
  assert.match(page.url(), /assessment\/start2/)
  assert.equal(await page.locator('#plank_time').inputValue(), '44.')
  await page.getByRole('button', { name: 'You', exact: true }).click()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  assert.match(page.url(), /assessment\/start2/)
  await page.getByRole('button', { name: 'Close your tools', exact: true }).click()
  pass('Offline values stay in memory; canceled Next link, Back, and real menu logout preserve the form')
  store('same-account').offline = false
  await resumed.setOffline(false)
  await saved(page)
  assert.equal(store('same-account').records.get(currentPeriod).values.plank_time, '44.')
  store('same-account').failNextSave = true
  await page.locator('#plank_time').fill('45.')
  await page.getByRole('button', { name: 'Retry Saving Draft', exact: true }).waitFor()
  assert.equal(await page.locator('#plank_time').inputValue(), '45.')
  await page.getByRole('button', { name: 'Retry Saving Draft', exact: true }).click()
  await saved(page)
  pass('Reconnect and failed-save retry persist retained values without false saved states')
  await page.getByRole('link', { name: 'QA Dashboard', exact: true }).click()
  await page.getByRole('heading', { name: 'In Progress', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Resume Assessment', exact: true }).click()
  await saved(page)
  await page.getByRole('button', { name: 'Submit Assessment', exact: true }).evaluate(button => { button.click(); button.click() })
  await page.getByRole('heading', { name: 'Your strength assessment is complete.', exact: true }).waitFor()
  assert.equal(store('same-account').finals, 1)
  assert.equal(store('same-account').writes.filter(write => write.method === 'POST').length, 1)
  assert.equal(await page.locator('#weight').isDisabled(), true)
  await page.getByText(/Original assessment date:.*October 15, 2026/).waitFor()
  await screenshot(page, '390px-completed-results')
  await page.reload()
  await page.getByRole('heading', { name: 'Your strength assessment is complete.', exact: true }).waitFor()
  await page.getByRole('link', { name: 'QA Progress', exact: true }).click()
  await page.getByRole('heading', { name: 'Completed', exact: true }).waitFor()
  pass('Rapid final submissions commit once, show immutable results in the account timezone, and refresh Progress to Completed')
  await page.getByRole('button', { name: 'You', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('heading', { name: 'Synthetic signed-out page', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Sign in to synthetic session', exact: true }).click()
  await page.getByRole('heading', { name: 'Completed', exact: true }).waitFor()
  await page.getByRole('link', { name: 'View Saved Results', exact: true }).click()
  await page.getByRole('heading', { name: 'Your strength assessment is complete.', exact: true }).waitFor()
  assert.deepEqual(await valuesOnPage(page), { ...fields, plank_time: '45.' })
  pass('Actual menu sign-out and simulated sign-in navigation restore the completed result and every saved value')
  await resumed.close()

  const loginEntry = await contextFor('login-entry')
  const entryPage = await open(loginEntry, '/login')
  await entryPage.getByRole('link', { name: 'Sign in to synthetic session', exact: true }).click()
  await entryPage.getByRole('link', { name: 'Start Assessment', exact: true }).click()
  await entryPage.locator('#weight').waitFor()
  await entryPage.waitForFunction(() => !document.querySelector('#weight').disabled)
  await loginEntry.setOffline(true)
  await entryPage.locator('#weight').fill('155.')
  entryPage.once('dialog', dialog => dialog.dismiss())
  await entryPage.goBack({ timeout: 3000 }).catch(() => {})
  await entryPage.waitForURL(/assessment\/start2/)
  assert.equal(await entryPage.locator('#weight').inputValue(), '155.')
  await loginEntry.setOffline(false)
  await saved(entryPage)
  await entryPage.locator('#weight').fill('156.')
  entryPage.once('dialog', dialog => dialog.accept())
  await entryPage.goBack({ timeout: 3000 }).catch(() => {})
  await entryPage.waitForURL(origin + '/dashboard')
  pass('Client-side login entry keeps the early Back guard; confirming departure permits navigation')
  await loginEntry.close()

  const rollover = store('rollover')
  rollover.records.set('2026-09-01', { status: 'draft', values: { ...empty, plank_time: '19.' }, revision: 4, savedAt, completedAt: null, assessmentDate: null })
  const prior = await contextFor('rollover')
  const priorPage = await open(prior, '/dashboard')
  await priorPage.getByRole('link', { name: 'Resume September Assessment', exact: true }).click()
  await priorPage.getByRole('heading', { name: 'Resume your strength assessment.', exact: true }).waitFor()
  assert.equal(await priorPage.locator('#plank_time').inputValue(), '19.')
  await priorPage.getByText(/Strength Assessment · September 2026/).waitFor()
  pass('Prior-month Resume URL opens its original period and preserves its partial measurements')
  await prior.close()

  const isolated = await contextFor('different-account')
  const isolatedPage = await open(isolated)
  await isolatedPage.locator('#height_in').waitFor({ state: 'visible' })
  await isolatedPage.waitForFunction(() => !document.querySelector('#height_in').disabled)
  assert.equal(await isolatedPage.locator('#weight').inputValue(), '')
  assert.equal(await isolatedPage.locator('#plank_time').inputValue(), '')
  await isolated.close()
  pass('Separate synthetic account transport restores no other account measurements')

  const history = store('history')
  history.history = [111, 112].map((weight, index) => ({ status: 'completed', values: { ...fields, weight: String(weight) }, period: currentPeriod, revision: 0, savedAt, completedAt: savedAt, assessmentDate: savedAt, assessmentId: `synthetic-history-${index + 1}` }))
  history.records.set(currentPeriod, history.history[0])
  const historicalContext = await contextFor('history')
  const historicalPage = await open(historicalContext)
  await historicalPage.getByRole('heading', { name: 'Assessment history', exact: true }).waitFor()
  await historicalPage.getByRole('link', { name: /View saved assessment 2/ }).click()
  await historicalPage.waitForFunction(() => document.querySelector('#weight')?.value === '112')
  await historicalPage.getByRole('link', { name: /View saved assessment 1/ }).click()
  await historicalPage.waitForFunction(() => document.querySelector('#weight')?.value === '111')
  assert.equal(history.history.length, 2)
  await historicalContext.close()
  pass('Both same-month historical records retain separately viewable original values')

  for (const width of [320, 1440]) {
    const viewport = await contextFor(`viewport-${width}`, width)
    const viewportPage = await open(viewport)
    await viewportPage.locator('#height_in').fill('65.')
    await saved(viewportPage)
    await screenshot(viewportPage, `${width}px-draft`)
    await viewport.close()
  }
  pass('320px, 390px, and 1440px viewports render with no horizontal overflow')
  assert.deepEqual(errors, [], 'Browser exceptions')
  assert.deepEqual(external, [], 'No external account, analytics, or database requests')
} catch (error) {
  checks.push({ name: 'Browser smoke completion', result: 'FAIL', error: error.message })
  process.exitCode = 1
  console.error(error)
} finally {
  await browser.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ origin, environment: 'Isolated localhost; real UI, synthetic intercepted account persistence; all external requests blocked', checks, browserExceptions: errors, externalOrigins: external, notTested: ['Live Supabase persistence and RLS', 'Real account authentication', 'Production deployment'], }, null, 2) + '\n')
}
