// Opt-in real Auth/API acceptance. Credentials and health payloads never enter receipts.
import { readFile, stat, writeFile } from 'node:fs/promises'
import { createServerClient } from '@supabase/ssr'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const receiptPath = option('--receipt')
const receipt = { status: 'NOT TESTED', checks: [], productionPromotionAllowed: false }
async function finish(code, reason) {
  receipt.reason = reason
  if (receiptPath) await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt))
  process.exitCode = code
}

const fixturePath = option('--fixture'), base = option('--base-url')
if (!fixturePath || !base || !args.includes('--allow-synthetic-writes')) {
  await finish(2, 'A private synthetic account fixture, exact deployment URL, and explicit synthetic-write opt-in are required.')
} else {
  try {
    const file = await stat(fixturePath)
    assert.equal(file.mode & 0o077, 0, 'Private fixture must have mode 0600')
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
    const origin = new URL(base)
    assert.equal(origin.protocol, 'https:')
    assert.equal(origin.origin, base)
    assert.equal(fixture.syntheticOnly, true)
    assert.equal(fixture.supabaseUrl, 'https://lcccpqgnpznhbtmkmytp.supabase.co')
    assert.ok(typeof fixture.publishableKey === 'string' && !fixture.publishableKey.startsWith('sb_secret_'))
    if (!fixture.publishableKey.startsWith('sb_publishable_')) assert.equal(JSON.parse(Buffer.from(fixture.publishableKey.split('.')[1], 'base64url')).role, 'anon')
    assert.ok(fixture.accounts?.length >= 2)
    const accounts = fixture.accounts.slice(0, 2)
    assert.equal(new Set(accounts.map(a => a.userId)).size, 2)
    for (const account of accounts) {
      assert.match(account.email, /^strength-release-qa-[a-z0-9-]+@example\.invalid$/)
      assert.match(account.clientId, /^STRENGTH-RELEASE-QA-/)
      assert.ok(account.userId && account.password)
    }
    async function login(account) {
      const jar = new Map()
      const db = createServerClient(fixture.supabaseUrl, fixture.publishableKey, {
        cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cookies => cookies.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) },
        auth: { autoRefreshToken: false },
      })
      const { data, error } = await db.auth.signInWithPassword({ email: account.email, password: account.password })
      assert.equal(error, null)
      assert.equal(data.user.id, account.userId)
      assert.equal(data.user.app_metadata.strength_release_qa, true)
      const member = await db.from('clients').select('client_id,full_name,program,access,active,onboarding_completed').eq('auth_user_id', data.user.id).single()
      assert.equal(member.error, null)
      assert.equal(member.data.client_id, account.clientId)
      assert.match(member.data.full_name, /^Strength Release QA/)
      assert.equal(member.data.access, true)
      assert.equal(member.data.active, true)
      assert.equal(member.data.onboarding_completed, true)
      const request = async (method, body, query = '') => {
        const response = await fetch(`${base}/api/assessment-strength${query}`, {
          method, redirect: 'manual', cache: 'no-store', headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
        })
        const payload = await response.json().catch(() => null)
        assert.ok(payload, 'Deployment must return an API response; check deployment protection')
        return { status: response.status, payload }
      }
      return { db, request }
    }
    const a = await login(accounts[0]), b = await login(accounts[1])
    receipt.checks.push('Two pinned synthetic identities authenticated through real Supabase Auth')
    const initial = await a.request('GET')
    assert.equal(initial.status, 200)
    assert.equal(initial.payload.assessment, null, 'Use a fresh synthetic account with no current-month assessment')
    const period = initial.payload.period
    const values = { birthdate: '1991-04-15', height_in: '', weight: '', weight_goal: 'Maintain strength', training_environment: 'home', plank_time: '0' }
    for (const lift of ['shoulder_press', 'squat', 'bench_press', 'close_grip_press', 'romanian_deadlift', 'seated_row', 'bicep_curl', 'lateral_raise']) Object.assign(values, { [`${lift}_weight`]: '12.', [`${lift}_reps`]: '' })
    const envelope = (revision, entered = values) => ({ expectedClientId: accounts[0].clientId, period, revision, values: entered })
    const saved = await a.request('PUT', envelope(0))
    assert.equal(saved.status, 200)
    assert.equal(saved.payload.assessment.status, 'draft')
    assert.ok(saved.payload.assessment.savedAt)
    const resumed = await login(accounts[0])
    const loaded = await resumed.request('GET')
    assert.equal(loaded.status, 200)
    assert.deepEqual(loaded.payload.assessment.values, values)
    receipt.checks.push('Every incomplete measurement restored in an independent authenticated session')
    assert.equal((await a.request('PUT', envelope(0, { ...values, weight: '151' }))).status, 409)
    assert.equal((await b.request('PUT', envelope(0))).status, 409)
    const foreignRead = await b.db.from('strength_assessment_sessions').select('id').eq('client_id', accounts[0].clientId)
    assert.equal(foreignRead.error, null); assert.deepEqual(foreignRead.data, [])
    receipt.checks.push('Stale revisions, account switches, and cross-user reads denied')
    const finalValues = { ...values, height_in: '67', weight: '160' }
    for (const name of Object.keys(finalValues)) if (name.endsWith('_reps')) finalValues[name] = '8'
    const finals = await Promise.all([resumed.request('POST', envelope(loaded.payload.assessment.revision, finalValues)), a.request('POST', envelope(loaded.payload.assessment.revision, finalValues))])
    for (const final of finals) { assert.equal(final.status, 200); assert.equal(final.payload.assessment.status, 'completed'); assert.ok(final.payload.assessment.completedAt) }
    assert.equal(finals[0].payload.assessment.assessmentId, finals[1].payload.assessment.assessmentId)
    const third = await login(accounts[0]), restored = await third.request('GET')
    assert.equal(restored.payload.assessment.status, 'completed'); assert.deepEqual(restored.payload.assessment.values, finalValues)
    assert.equal(restored.payload.history.length, initial.payload.history.length + 1)
    assert.ok(initial.payload.history.every(old => restored.payload.history.some(next => next.assessmentId === old.assessmentId)))
    assert.equal((await b.request('GET', undefined, `?assessmentId=${encodeURIComponent(restored.payload.assessment.assessmentId)}`)).status, 404)
    assert.equal((await third.request('PUT', envelope(restored.payload.assessment.revision))).status, 409)
    receipt.checks.push('Concurrent final submissions create one immutable completion; new login restores every result and preserves history')
    receipt.status = 'PASS'
    // Browser dashboard/Progress and offline acceptance remain separately required.
    await finish(0, 'Real Auth/API acceptance passed using designated synthetic records only. Complete browser production smoke before promotion.')
  } catch {
    receipt.status = 'FAIL'
    await finish(1, 'A prerequisite or live acceptance assertion failed. Review locally without exposing credentials or measurement payloads.')
  }
}
