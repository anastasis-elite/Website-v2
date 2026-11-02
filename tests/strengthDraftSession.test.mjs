import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { StrengthDraftSession, StrengthRequestError, strengthAssessmentTransport } = await importTs('lib/assessments/strengthDraftSession.ts')
const defaults = { birthdate: '', height_in: '', weight: '', weight_goal: '', training_environment: '', shoulder_press_weight: '', shoulder_press_reps: '', squat_weight: '', squat_reps: '', bench_press_weight: '', bench_press_reps: '', close_grip_press_weight: '', close_grip_press_reps: '', romanian_deadlift_weight: '', romanian_deadlift_reps: '', seated_row_weight: '', seated_row_reps: '', bicep_curl_weight: '', bicep_curl_reps: '', lateral_raise_weight: '', lateral_raise_reps: '', plank_time: '' }
const period = '2026-10-01'
const savedAt = '2026-10-16T15:00:00.000Z'
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const result = (assessment = null, extra = {}) => ({ success: true, period, currentPeriod: period, assessment, ...extra })
const draft = (values = defaults, revision = 1) => ({ status: 'draft', values: { ...values }, revision, savedAt, completedAt: null, assessmentDate: null })
const completed = values => ({ ...draft(values), status: 'completed', completedAt: savedAt, assessmentDate: savedAt, assessmentId: 'synthetic-assessment' })

function cloud() {
  let stored = null, revision = 0, completedRows = 0
  const writes = []
  const transport = async (method, body, requestedPeriod) => {
    if (method === 'GET') return structuredClone(result(stored, { period: requestedPeriod || period }))
    writes.push({ method, ...structuredClone(body) })
    if (stored?.status === 'completed') return result(stored)
    if (body.revision !== revision) throw new StrengthRequestError('conflict', result(stored))
    revision++
    stored = method === 'POST' ? { ...completed(body.values), revision } : draft(body.values, revision)
    if (method === 'POST') completedRows++
    return structuredClone(result(stored))
  }
  return { transport, writes, get completedRows() { return completedRows }, get stored() { return stored } }
}

test('switching accounts during initial load cannot attach another account’s cloud values to this form', async () => {
  const session = new StrengthDraftSession(defaults, async () => result(draft({ ...defaults, weight: '199' }), { clientId: 'OTHER-CLIENT' }), 'ORIGINAL-CLIENT')
  assert.equal(await session.load(), false)
  assert.equal(session.getSnapshot().values.weight, '')
  assert.equal(session.getSnapshot().loaded, false)
  assert.match(session.getSnapshot().loadError, /signed-in account has changed/)
})

test('first save across month rollover preserves entered values until explicitly carried into an empty new month', async () => {
  const writes = []
  const next = '2026-11-01'
  const session = new StrengthDraftSession(defaults, async (method, body, requestedPeriod) => {
    if (method === 'GET') return result(null, { period: requestedPeriod || period, currentPeriod: requestedPeriod || period })
    writes.push(body)
    if (body.period === period) throw new StrengthRequestError('period_changed', { currentPeriod: next })
    return result(draft(body.values), { period: next, currentPeriod: next })
  })
  await session.load()
  session.change('squat_weight', '12.')
  assert.equal(await session.save(), false)
  assert.equal(session.getSnapshot().values.squat_weight, '12.')
  assert.equal(session.getSnapshot().monthChanged, true)
  assert.equal(session.getSnapshot().currentPeriod, next)
  assert.equal(await session.continueInCurrentPeriod(), true)
  assert.equal(writes[1].period, next)
  assert.equal(writes[1].values.squat_weight, '12.')
  assert.equal(session.getSnapshot().unsaved, false)
})

test('carrying a rollover form never replaces an existing new-month assessment', async () => {
  const session = new StrengthDraftSession(defaults, async (method, body, requestedPeriod) => {
    if (method === 'GET') return requestedPeriod ? result(draft({ ...defaults, weight: '165' }), { period: requestedPeriod, currentPeriod: requestedPeriod }) : result()
    throw new StrengthRequestError('period_changed', { currentPeriod: '2026-11-01' })
  })
  await session.load(); session.change('weight', '150'); await session.save()
  assert.equal(await session.continueInCurrentPeriod(), false)
  assert.equal(session.getSnapshot().values.weight, '150')
  assert.equal(session.getSnapshot().conflict, true)
  assert.equal(session.getSnapshot().unsaved, true)
})

test('every partial string survives cloud draft saving and a new authenticated session', async () => {
  const server = cloud()
  const first = new StrengthDraftSession(defaults, server.transport)
  await first.load()
  const entered = Object.fromEntries(Object.keys(defaults).map((key, index) => [key, index % 3 === 0 ? '' : index % 3 === 1 ? '12.' : '0']))
  entered.birthdate = '1991-04-15'
  entered.training_environment = 'home'
  entered.weight_goal = 'Maintain strength'
  for (const [key, value] of Object.entries(entered)) first.change(key, value)
  assert.equal(first.getSnapshot().savedAt, null)
  assert.equal(first.getSnapshot().unsaved, true)
  assert.equal(await first.save(), true)
  assert.equal(first.getSnapshot().status, 'draft')
  assert.equal(first.getSnapshot().unsaved, false)
  const second = new StrengthDraftSession(defaults, server.transport)
  assert.equal(await second.load(), true)
  assert.deepEqual(second.getSnapshot().values, entered)
  assert.equal(second.getSnapshot().savedAt, savedAt)
  assert.equal(server.completedRows, 0, 'Draft persistence cannot create a completed assessment')
})

test('draft writes serialize edits made during an in-flight save and deduplicate rapid save clicks', async () => {
  const requests = [], firstWrite = deferred(), secondWrite = deferred()
  const session = new StrengthDraftSession(defaults, async (method, body) => {
    if (method === 'GET') return result()
    requests.push(body)
    return requests.length === 1 ? firstWrite.promise : secondWrite.promise
  })
  await session.load()
  session.change('weight', '150')
  const first = session.save()
  assert.equal(session.save(), first)
  session.change('plank_time', '32.')
  assert.equal(requests.length, 1)
  assert.equal(session.getSnapshot().savedAt, null, 'No save timestamp is shown before persistence is confirmed')
  firstWrite.resolve(result(draft(requests[0].values, 1)))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests.length, 2)
  assert.equal(requests[1].revision, 1)
  assert.equal(requests[1].values.plank_time, '32.')
  assert.equal(session.getSnapshot().unsaved, true)
  secondWrite.resolve(result(draft(requests[1].values, 2)))
  assert.equal(await first, true)
  assert.equal(session.getSnapshot().unsaved, false)
  assert.equal(session.getSnapshot().revision, 2)
})

test('final submission waits for the draft revision, deduplicates rapid clicks, and confirms completion last', async () => {
  const saveRequest = deferred(), finalRequest = deferred(), writes = []
  const session = new StrengthDraftSession(defaults, async (method, body) => {
    if (method === 'GET') return result()
    writes.push({ method, ...body })
    return method === 'PUT' ? saveRequest.promise : finalRequest.promise
  })
  await session.load()
  session.change('height_in', '65')
  session.change('weight', '150')
  const saving = session.save()
  const submitting = session.submit()
  assert.equal(session.submit(), submitting)
  session.change('weight', '999')
  assert.equal(session.getSnapshot().values.weight, '150', 'Measurements are stable during final submission')
  assert.equal(writes.length, 1)
  saveRequest.resolve(result(draft(writes[0].values, 1)))
  await saving
  await Promise.resolve()
  assert.equal(writes.length, 2)
  assert.equal(writes[1].method, 'POST')
  assert.equal(writes[1].revision, 1)
  assert.notEqual(session.getSnapshot().status, 'completed')
  finalRequest.resolve(result({ ...completed(writes[1].values), revision: 2 }))
  assert.equal(await submitting, true)
  assert.equal(session.getSnapshot().status, 'completed')
  assert.equal(session.getSnapshot().completedAt, savedAt)
  assert.equal(session.getSnapshot().unsaved, false)
})

test('network failures retain all values and the previous successful timestamp, with an explicit retry', async () => {
  let fail = false
  const server = cloud()
  const session = new StrengthDraftSession(defaults, async (...args) => {
    if (fail) throw new Error('Load failed: confidential transport detail')
    return server.transport(...args)
  })
  await session.load()
  session.change('weight', '150')
  await session.save()
  fail = true
  session.change('squat_weight', '45.')
  const before = { ...session.getSnapshot().values }
  assert.equal(await session.save(), false)
  assert.deepEqual(session.getSnapshot().values, before)
  assert.equal(session.getSnapshot().savedAt, savedAt)
  assert.equal(session.getSnapshot().unsaved, true)
  assert.match(session.getSnapshot().saveError, /haven’t been saved/)
  assert.doesNotMatch(session.getSnapshot().saveError, /confidential|Load failed/)
  fail = false
  assert.equal(await session.save(), true)
  assert.equal(session.getSnapshot().saveError, null)
  assert.equal(session.getSnapshot().unsaved, false)
})

test('an ambiguous network failure after commit can be retried without duplicate final records', async () => {
  const server = cloud()
  let loseResponse = true
  const session = new StrengthDraftSession(defaults, async (...args) => {
    const response = await server.transport(...args)
    if (args[0] === 'POST' && loseResponse) { loseResponse = false; throw new Error('Network disconnected after commit') }
    return response
  })
  await session.load()
  session.change('height_in', '65')
  session.change('weight', '150')
  assert.equal(await session.submit(), false)
  assert.equal(server.completedRows, 1)
  assert.notEqual(session.getSnapshot().status, 'completed')
  assert.match(session.getSnapshot().submitError, /couldn’t confirm/)
  assert.equal(await session.submit(), true)
  assert.equal(session.getSnapshot().status, 'completed')
  assert.equal(server.completedRows, 1)
})

test('cross-session revision conflicts preserve local entries and block overwrites until deliberate review', async () => {
  const server = cloud()
  const first = new StrengthDraftSession(defaults, server.transport)
  const second = new StrengthDraftSession(defaults, server.transport)
  await Promise.all([first.load(), second.load()])
  first.change('weight', '150')
  await first.save()
  second.change('weight', '160')
  second.change('plank_time', '22.')
  assert.equal(await second.save(), false)
  assert.equal(second.getSnapshot().conflict, true)
  assert.equal(second.getSnapshot().values.weight, '160')
  assert.equal(second.getSnapshot().values.plank_time, '22.')
  const writes = server.writes.length
  assert.equal(await second.save(), false)
  assert.equal(await second.submit(), false)
  assert.equal(server.writes.length, writes)
  assert.equal(await second.load(), false, 'An automatic load cannot replace unsaved entries')
  assert.equal(await second.reviewSaved(), true)
  assert.equal(second.getSnapshot().values.weight, '150')
  assert.equal(second.getSnapshot().conflict, false)
})

test('completed results restore their original date and reject edits, drafts, and repeat submissions', async () => {
  let writes = 0
  const original = completed({ ...defaults, weight: '150', plank_time: '42' })
  const session = new StrengthDraftSession(defaults, async method => {
    if (method !== 'GET') writes++
    return result(original)
  })
  await session.load()
  session.change('weight', '160')
  assert.equal(session.getSnapshot().values.weight, '150')
  assert.equal(session.getSnapshot().assessmentDate, savedAt)
  assert.equal(await session.save(), false)
  assert.equal(await session.submit(), false)
  assert.equal(writes, 0)
})

test('a completed response from another session never silently replaces divergent in-memory measurements', async () => {
  for (const operation of ['save', 'submit']) {
    const session = new StrengthDraftSession(defaults, async method => method === 'GET' ? result() : result(completed({ ...defaults, weight: '150' })))
    await session.load()
    session.change('weight', '160')
    session.change('plank_time', '12.')
    assert.equal(await session[operation](), false)
    assert.equal(session.getSnapshot().conflict, true)
    assert.equal(session.getSnapshot().values.weight, '160')
    assert.equal(session.getSnapshot().values.plank_time, '12.')
    assert.equal(session.getSnapshot().unsaved, true)
    assert.notEqual(session.getSnapshot().status, 'completed')
  }
})

test('month rollover retains an existing draft’s original period and offers the new current period separately', async () => {
  const requests = []
  const oldPeriod = '2026-09-01'
  const session = new StrengthDraftSession(defaults, async (method, body, requestedPeriod) => {
    if (method === 'GET') return result(draft({ ...defaults, plank_time: '14.' }), { period: requestedPeriod, currentPeriod: period })
    requests.push(body)
    return result(draft(body.values, 2), { period: oldPeriod, currentPeriod: period })
  })
  await session.load(oldPeriod)
  session.change('weight', '150')
  await session.save()
  assert.equal(requests[0].period, oldPeriod)
  assert.equal(session.getSnapshot().period, oldPeriod)
  assert.equal(session.getSnapshot().currentPeriod, period)
  assert.equal(session.getSnapshot().values.plank_time, '14.')
})

test('loading errors have a separate retry state and never expose database messages', async () => {
  let fail = true
  const session = new StrengthDraftSession(defaults, async () => {
    if (fail) throw new Error('secret database row')
    return result(draft({ ...defaults, weight: '150' }))
  })
  session.change('weight', '900')
  assert.equal(session.getSnapshot().values.weight, '')
  assert.equal(await session.load(), false)
  assert.equal(session.getSnapshot().loaded, false)
  assert.match(session.getSnapshot().loadError, /couldn’t load/)
  assert.doesNotMatch(session.getSnapshot().loadError, /secret/)
  assert.equal(session.getSnapshot().saveError, null)
  fail = false
  assert.equal(await session.load(), true)
  assert.equal(session.getSnapshot().values.weight, '150')
  assert.equal(session.getSnapshot().loadError, null)
})

test('unconfirmed draft and final responses never show saved or completed', async () => {
  const session = new StrengthDraftSession(defaults, async method => method === 'GET' ? result() : result({ ...draft(), savedAt: null }))
  await session.load()
  session.change('weight', '150')
  assert.equal(await session.save(), false)
  assert.equal(session.getSnapshot().savedAt, null)
  assert.equal(session.getSnapshot().unsaved, true)
  assert.equal(await session.submit(), false)
  assert.notEqual(session.getSnapshot().status, 'completed')
})

test('the HTTP transport requires authenticated no-cache responses with confirmed persistence', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const requests = []
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return Response.json(result(draft())) }
  await strengthAssessmentTransport('GET', undefined, period)
  assert.equal(requests[0].url, `/api/assessment-strength?period=${period}`)
  assert.equal(requests[0].options.credentials, 'same-origin')
  assert.equal(requests[0].options.cache, 'no-store')
  globalThis.fetch = async () => Response.json({ success: true, period, currentPeriod: period })
  await assert.rejects(() => strengthAssessmentTransport('PUT', { values: defaults }), error => error.code === 'unconfirmed')
  globalThis.fetch = async () => Response.json({ error: 'private SQL details', code: 'save_failed' }, { status: 503 })
  await assert.rejects(() => strengthAssessmentTransport('PUT', { values: defaults }), error => error.code === 'save_failed' && !error.message.includes('private'))
})
