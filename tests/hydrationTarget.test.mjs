import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const clientId = 'QA-HYDRATION-TARGET', day = '2026-10-28'
const mocks = {
  'next/server': 'export const NextResponse={json:(body,init)=>Response.json(body,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.waterTargetDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan=()=>{}',
  '@/lib/timezone': 'export const getClientLocalDate=()=>globalThis.waterTargetDay',
}
const hydration = await importTs('app/api/nutrition/hydration/route.ts', mocks)
const addWater = await importTs('app/api/nutrition/add-water/route.ts', mocks)
const helpers = await importTs('lib/nutrition/directEntry.ts')
const entitlements = await importTs('lib/entitlements.ts')
const get = () => hydration.GET(new Request(`http://local.invalid/api/nutrition/hydration?clientId=${clientId}&logDate=${day}`))
function database({ saved, signedIn = true, foreign = false, failTable, onRead, onUpdate, failUpdate = false } = {}) {
  const client = { client_id: clientId, auth_user_id: foreign ? 'other' : 'owner', timezone: 'America/Chicago', program: 'ember' }
  const tables = { clients: [client], nutrition_logs: saved ? [{ id: 'saved-day', client_id: clientId, auth_user_id: 'owner', log_date: day, water_consumed_oz: 0, ...saved }] : [], assessments: [{ client_id: clientId, assessment_type: 'strength', data: { weight: 185 } }] }
  const writes = [], reads = []
  const db = { tables, writes, reads, auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'owner' } : null }, error: null }) },
    from(table) {
      let insert, update; const filters = []
      const q = { select() { return q }, eq(k, v) { filters.push(row => row[k] === v); return q }, is(k, v) { filters.push(row => (row[k] ?? null) === v); return q }, in() { return q }, gte() { return q }, lte() { return q }, order() { return q }, limit() { return q }, update(value) { update = value; return q },
        insert(value) { insert = value; return q }, maybeSingle() { return result(true) }, single() { return result(true) }, then(done, reject) { return result(false).then(done, reject) } }
      async function result(single) {
        reads.push(table); onRead?.(table, db)
        if (failTable === table) return { data: null, error: { message: 'Synthetic read failure' } }
        if (update && failUpdate) return { data: null, error: { message: 'Synthetic target save failed' } }
        if (insert) { tables[table].push({ id: 'first-water-day', ...insert }); writes.push(insert) }
        if (update) onUpdate?.(table, db)
        const rows = (tables[table] || []).filter(row => filters.every(filter => filter(row)))
        if (update) for (const row of rows) { Object.assign(row, update); writes.push(update) }
        return { data: structuredClone(single ? rows[0] || null : rows), error: null }
      }
      return q
    },
    async rpc(name, args) {
      assert.equal(name, 'add_daily_water')
      const row = tables.nutrition_logs.find(row => row.id === args.p_log_id)
      row.water_consumed_oz += args.p_ounces; writes.push(args)
      return { data: structuredClone(row), error: null }
    },
  }
  globalThis.waterTargetDb = db; globalThis.waterTargetDay = day
  return db
}

test('first-day target loads without writes and agrees with the actual first water save', async () => {
  const db = database()
  const response = await get(), initial = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(initial.consumed, 0); assert.equal(initial.target, 111)
  assert.equal(db.tables.nutrition_logs.length, 0); assert.equal(db.writes.length, 0)
  const added = await addWater.POST(new Request('http://local.invalid/api/nutrition/add-water', { method: 'POST', body: JSON.stringify({ clientId, logDate: day, ounces: 8, submissionId: '60000000-0000-4000-8000-000000000001' }) }))
  assert.equal(added.status, 200)
  const saved = (await added.json()).nutritionLog
  assert.equal(saved.water_oz, initial.target); assert.equal(saved.water_consumed_oz, 8)
  const after = await (await get()).json()
  assert.equal(after.target, initial.target); assert.equal(after.consumed, 8)
})

test('valid saved daily target is preserved; absent or invalid targets use the existing calculation', async () => {
  for (const target of [143, '143.5', 0, null, 'invalid']) {
    const db = database({ saved: { water_oz: target, water_consumed_oz: 20 } })
    const response = await get(), body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.target, Number(target) > 0 ? Number(target) : 111)
    assert.equal(body.consumed, 20); assert.equal(db.writes.length, 0)
    assert.equal(db.reads.includes('assessments'), !(Number(target) > 0))
    if (Number(target) > 0) {
      const response = await addWater.POST(new Request('http://local.invalid/api/nutrition/add-water', { method: 'POST', body: JSON.stringify({ clientId, logDate: day, ounces: 8, submissionId: '60000000-0000-4000-8000-000000000001' }) }))
      assert.equal(response.status, 200)
      assert.equal(Number((await response.json()).nutritionLog.water_oz), Number(target))
      assert.equal(db.reads.includes('assessments'), false, 'Saving water does not recalculate a valid saved target')
    }
  }
})

test('an explicit water save repairs only an invalid target and returns the same target shown before save', async () => {
  for (const water_oz of [0, null, undefined]) {
    const db = database({ saved: { water_oz } })
    const initial = await (await get()).json()
    assert.equal(initial.target, 111); assert.equal(db.writes.length, 0)
    const response = await addWater.POST(new Request('http://local.invalid/api/nutrition/add-water', { method: 'POST', body: JSON.stringify({ clientId, logDate: day, ounces: 8, submissionId: '60000000-0000-4000-8000-000000000001' }) }))
    assert.equal(response.status, 200)
    const saved = (await response.json()).nutritionLog
    assert.equal(saved.water_oz, initial.target); assert.equal(saved.water_consumed_oz, 8)
  }
})

test('an invalid-target repair preserves a concurrent valid target and stops before intake if target persistence fails', async () => {
  let db = database({ saved: { water_oz: 0 }, onUpdate(_table, db) { db.tables.nutrition_logs[0].water_oz = 155 } })
  const request = () => new Request('http://local.invalid/api/nutrition/add-water', { method: 'POST', body: JSON.stringify({ clientId, logDate: day, ounces: 8, submissionId: '60000000-0000-4000-8000-000000000001' }) })
  let response = await addWater.POST(request())
  assert.equal(response.status, 200); assert.equal((await response.json()).nutritionLog.water_oz, 155)
  assert.equal(db.writes.length, 1, 'Only the drink RPC writes; the concurrent valid target is retained')
  db = database({ saved: { water_oz: 0 }, failUpdate: true })
  response = await addWater.POST(request())
  assert.equal(response.status, 500); assert.equal(db.tables.nutrition_logs[0].water_consumed_oz, 0); assert.equal(db.writes.length, 0)
})

test('a daily target saved during calculation wins over the preliminary calculation', async () => {
  const db = database({ onRead(table, db) { if (table === 'daily_health_metrics') db.tables.nutrition_logs.push({ id: 'concurrent-day', client_id: clientId, log_date: day, water_oz: 125, water_consumed_oz: 16 }) } })
  const body = await (await get()).json()
  assert.equal(body.target, 125); assert.equal(body.consumed, 16); assert.equal(db.writes.length, 0)
})

test('hydration read fails honestly for unavailable source data and unauthorized ownership', async () => {
  for (const options of [{ failTable: 'nutrition_logs' }, { failTable: 'assessments' }, { failTable: 'clients' }, { signedIn: false }, { foreign: true }]) {
    const db = database(options), response = await get(), body = await response.json()
    assert.equal(response.status, options.signedIn === false ? 401 : options.foreign ? 404 : 500)
    assert.equal(body.target, undefined); assert.equal(body.consumed, undefined); assert.equal(db.writes.length, 0)
  }
})

test('a request for an older local day and a day changing during calculation cannot return a stale target', async () => {
  let db = database(); globalThis.waterTargetDay = '2026-10-29'
  assert.equal((await get()).status, 409); assert.equal(db.writes.length, 0)
  db = database({ onRead(table) { if (table === 'daily_health_metrics') globalThis.waterTargetDay = '2026-10-29' } })
  assert.equal((await get()).status, 409); assert.equal(db.writes.length, 0)
})

test('browser loader rejects foreign dates and malformed or failed target responses', async () => {
  for (const body of [{ clientId, logDate: '2026-10-29', target: 111, consumed: 0 }, { clientId: 'other', logDate: day, target: 111, consumed: 0 }, { clientId, logDate: day, target: 0, consumed: 0 }, { clientId, logDate: day, target: 111, consumed: -1 }]) {
    await assert.rejects(helpers.readDirectWaterEntry(clientId, day, undefined, async () => Response.json(body)))
  }
  await assert.rejects(helpers.readDirectWaterEntry(clientId, day, undefined, async () => Response.json({ error: 'Unavailable' }, { status: 503 })), /Unavailable/)
})

function mountedDirect({ initialLog = null, initialError, request, environment = {} } = {}) {
  if (initialLog) initialLog = { client_id: clientId, log_date: day, ...initialLog }
  const slots = [], effects = []; let cursor = 0, props = { clientId, logDate: day, timezone: 'America/Chicago', program: 'ember', loggingIntent: { action: 'water' }, initialLog, initialError }
  const react = {
    useRef(initial) { return slots[cursor++] ||= { current: initial } },
    useMemo(fn) { return slots[cursor++] ||= fn() },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
    useEffect(fn, deps) { const index = cursor++; if (!slots[index] || deps.some((value, n) => slots[index].deps[n] !== value)) { const old = slots[index]; slots[index] = { deps }; effects.push(() => { old?.cleanup?.(); slots[index].cleanup = fn() }) } },
  }
  const module = { exports: {} }, nativeRequire = createRequire(import.meta.url)
  const router = { refresh() {}, replace() {} }
  const imports = { react, 'next/navigation': { useRouter: () => router }, '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'frame' }, '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' }, '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' }, '@/lib/supabase/client': { createClient: () => ({}) }, '@/lib/entitlements': entitlements, '@/lib/nutrition/directEntry': { ...helpers, readDirectWaterEntry: (id, date, signal) => helpers.readDirectWaterEntry(id, date, signal, request) } }
  vm.runInNewContext(ts.transpileModule(readFileSync('components/nutrition/DirectNutritionEntry.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: name => imports[name] || nativeRequire(name), AbortController, console, ...environment })
  const nodes = element => !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)]
  function render() { cursor = 0; const tree = module.exports.default(props); for (const effect of effects.splice(0)) effect(); return nodes(tree).find(node => node.type === 'water-entry') }
  return { render, nodes, setProps(next) { props = { ...props, ...next } }, async flush() { await new Promise(setImmediate); render(); await new Promise(setImmediate); return render() } }
}

test('direct water shows loading then zero against the real target and retains confirmed intake over an older read', async () => {
  let resolve, calls = 0
  const app = mountedDirect({ request: () => { calls++; return new Promise(done => { resolve = done }) } })
  let entry = app.render(); assert.equal(entry.props.targetStatus, 'loading')
  resolve(Response.json({ clientId, logDate: day, target: 111, consumed: 0 }))
  entry = await app.flush(); assert.equal(entry.props.consumed, 0); assert.equal(entry.props.target, 111)
  assert.equal(calls, 1)
  entry.props.onSaved(8, 111); assert.equal(app.render().props.consumed, 8)
  const pending = mountedDirect({ request: () => new Promise(done => { resolve = done }) })
  entry = pending.render(); entry.props.onSaved(12, 125)
  resolve(Response.json({ clientId, logDate: day, target: 111, consumed: 0 }))
  entry = await pending.flush(); assert.equal(entry.props.consumed, 12); assert.equal(entry.props.target, 125)
})

test('direct water preserves a saved target without calculating again and can retry an honest failure', async () => {
  const saved = mountedDirect({ initialLog: { id: 'saved', water_oz: 145, water_consumed_oz: 0 }, request: () => { throw new Error('Unexpected recalculation') } })
  assert.equal(saved.render().props.target, 145)
  let fail = true
  const app = mountedDirect({ request: async () => fail ? Response.json({ error: 'Target load failed' }, { status: 503 }) : Response.json({ clientId, logDate: day, target: 111, consumed: 0 }) })
  app.render(); let entry = await app.flush()
  assert.equal(entry.props.targetStatus, 'error'); assert.ok(app.nodes(entry).find(node => node.props?.role === 'alert'))
  fail = false; app.nodes(entry).find(node => node.type === 'button').props.onClick()
  entry = await app.flush(); assert.equal(entry.props.target, 111); assert.equal(entry.props.targetStatus, 'ready')
})

test('a target response for an earlier open day is ignored after entry switches day', async () => {
  const releases = []
  const app = mountedDirect({ request: () => new Promise(done => releases.push(done)) })
  app.render(); app.setProps({ logDate: '2026-10-29' }); app.render()
  releases[0](Response.json({ clientId, logDate: day, target: 111, consumed: 40 }))
  await app.flush(); assert.equal(app.render().props.target, 0)
  releases[1](Response.json({ clientId, logDate: '2026-10-29', target: 120, consumed: 0 }))
  const entry = await app.flush(); assert.equal(entry.props.target, 120); assert.equal(entry.props.consumed, 0)
})

test('switching scope cannot show an earlier saved target or a locally confirmed water total', async () => {
  let resolve
  const app = mountedDirect({ initialLog: { id: 'saved-day', water_oz: 111, water_consumed_oz: 20 }, request: () => new Promise(done => { resolve = done }) })
  app.render().props.onSaved(28, 111)
  app.setProps({ logDate: '2026-10-29' })
  const entry = app.render()
  assert.equal(entry.props.target, 0); assert.equal(entry.props.consumed, 0)
  resolve(Response.json({ clientId, logDate: '2026-10-29', target: 120, consumed: 0 }))
  assert.equal((await app.flush()).props.target, 120)
})

test('an open water entry clears yesterday’s target and disables saving when the member’s local day changes', () => {
  let checkDay
  const app = mountedDirect({ initialLog: { id: 'saved-day', water_oz: 111, water_consumed_oz: 20 }, environment: {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-29T06:00:00Z'])) } },
    window: { setInterval(fn) { checkDay = fn; return 1 }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
  } })
  assert.equal(app.render().props.target, 111)
  checkDay()
  const entry = app.render()
  assert.equal(entry.props.target, 0); assert.equal(entry.props.disabled, true); assert.equal(entry.props.consumedKnown, false)
})
