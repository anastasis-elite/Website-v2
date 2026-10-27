import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Exercise the actual browser controls with disposable React hooks, storage,
// and a server that commits once even when its first response is lost.
const require = createRequire(import.meta.url)
function moduleUrl(path, cache = new Map()) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path)
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const output = outputText.replace(/from ['"]([^'"]+)['"]/g, (original, specifier) => {
    const mock = specifier === 'react' ? 'export const useState=(...a)=>globalThis.waterHooks.useState(...a); export const useEffect=(...a)=>globalThis.waterHooks.useEffect(...a); export const useRef=(...a)=>globalThis.waterHooks.useRef(...a); export const useId=()=>globalThis.waterHooks.useId();'
      : specifier === 'next/navigation' ? 'export const useRouter=()=>globalThis.waterRouter'
      : specifier === 'next/link' ? "export default 'a'"
      : ['@/components/CycleProgressOrb', '@/components/WaterCup'].includes(specifier) ? "export default 'span'" : null
    if (mock) return `from 'data:text/javascript;base64,${Buffer.from(mock).toString('base64')}'`
    const base = specifier.startsWith('@/') ? resolve(specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(path), specifier) : null
    if (base) return `from '${moduleUrl(base + (existsSync(base + '.tsx') ? '.tsx' : '.ts'), cache)}'`
    return `from '${pathToFileURL(require.resolve(specifier)).href}'`
  })
  const url = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
  cache.set(path, url)
  return url
}
const QuickAdd = (await import(moduleUrl('components/hydration/HydrationQuickAdd.tsx'))).default
const Dock = (await import(moduleUrl('components/DashboardStatusDock.tsx'))).default
const submissions = await import(moduleUrl('lib/hydration/waterSubmission.ts'))
const clientId = 'QA-WATER-ONLY', logDate = '2026-10-13'
const quickProps = { clientId, logDate, consumed: 36, target: 111, renderTrigger: () => null }
const dockProps = { client: { client_id: clientId, timezone: 'America/Chicago' }, cycleStatus: {}, dailyPlan: { date: logDate, dailyTargets: { water: 111 }, dailyRemaining: { water: 75 } } }

function mount(Component, props, storage, fetch) {
  const slots = []; let cursor = 0, effects = [], tree, refreshes = 0
  globalThis.window = { localStorage: storage }
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  globalThis.fetch = fetch
  globalThis.waterRouter = { refresh() { refreshes++ } }
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useId() { const i = cursor++; return slots[i] ||= `water-${i}` },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((value, n) => value !== slots[i][n])) { slots[i] = deps; effects.push(fn) } },
  }
  function render() { globalThis.waterHooks = hooks; cursor = 0; tree = Component(props); for (const effect of effects.splice(0)) effect(); return tree }
  async function flush() { await new Promise(setImmediate); render(); await new Promise(setImmediate); render() }
  render(); render()
  return { render, flush, get tree() { return tree }, get refreshes() { return refreshes } }
}
function nodes(tree, predicate) {
  const found = []
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if (predicate(node)) found.push(node)
    visit(node.props?.children)
  }
  visit(tree); return found
}
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null ? '' : String(node)
const button = (app, label) => nodes(app.tree, node => node.type === 'button' && text(node) === label)[0]
function scenario() {
  const values = new Map(), calls = [], ids = new Set(); let total = 36, loseResponse = true
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), get length() { return values.size }, key: index => [...values.keys()][index] ?? null }
  async function fetch(url, init) {
    assert.equal(url, '/api/nutrition/add-water')
    const body = JSON.parse(init.body); calls.push(body)
    if (!ids.has(body.submissionId)) { ids.add(body.submissionId); total += body.ounces }
    if (loseResponse) { loseResponse = false; throw new TypeError('Response lost after commit') }
    return Response.json({ success: true, nutritionLog: { water_consumed_oz: total, water_oz: 111 } })
  }
  return { storage, fetch, values, calls, get total() { return total } }
}

test('inline hydration changes its draft without saving until Add is explicitly pressed', async () => {
  const server = scenario(), calls = []
  const app = mount(QuickAdd, { ...quickProps, inline: true }, server.storage, async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body)
    return Response.json({ nutritionLog: { water_consumed_oz: 36 + body.ounces } })
  })
  assert.equal(nodes(app.tree, node => node.type === 'dialog').length, 0)
  nodes(app.tree, node => node.type === 'input' && node.props.type === 'range')[0].props.onChange({ target: { value: '20' } })
  app.render()
  assert.equal(calls.length, 0)
  assert.match(text(app.tree), /36 oz logged/)
  button(app, 'Add 20 oz').props.onClick(); await app.flush()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].ounces, 20)
  assert.match(text(app.tree), /56 oz logged/)
})

test('quick add keeps one committed drink through response loss, double-click, reload, and retry', async () => {
  const server = scenario(), first = mount(QuickAdd, quickProps, server.storage, server.fetch)
  const save = button(first, 'Log 8 oz')
  save.props.onClick(); save.props.onClick(); await first.flush()
  assert.equal(server.calls.length, 1)
  assert.equal(server.total, 44)
  assert.equal(first.refreshes, 0)
  assert.match(text(first.tree), /Response lost/)
  const pendingId = server.calls[0].submissionId
  assert.equal(nodes(first.tree, node => node.type === 'input')[0].props.disabled, true)
  assert.throws(() => submissions.beginWaterSubmission(clientId, 12, logDate), /pending 8 oz/)
  const reloaded = mount(QuickAdd, { ...quickProps, defaultOunces: 12 }, server.storage, server.fetch)
  assert.equal(nodes(reloaded.tree, node => node.type === 'input' && node.props.type === 'number')[0].props.value, '8')
  button(reloaded, 'Retry 8 oz save').props.onClick(); await reloaded.flush()
  assert.equal(server.calls[1].submissionId, pendingId)
  assert.equal(server.calls[1].logDate, logDate)
  assert.equal(server.total, 44)
  assert.equal(reloaded.refreshes, 1)
  assert.equal(server.values.size, 0)
  button(reloaded, 'Log 8 oz').props.onClick(); await reloaded.flush()
  assert.notEqual(server.calls[2].submissionId, pendingId)
  assert.equal(server.total, 52)
})

test('closing an unsaved direct water dialog notifies its route without submitting or retaining a drink', () => {
  const server = scenario(); let closed = 0
  const app = mount(QuickAdd, { ...quickProps, initiallyOpen: true, onClosed: () => { closed++ } }, server.storage, server.fetch)
  button(app, 'Close').props.onClick(); app.render()
  const dialog = nodes(app.tree, node => node.type === 'dialog')[0]
  assert.equal(closed, 0, 'Navigation waits for the native dialog close event')
  dialog.props.onClose()
  assert.equal(closed, 1)
  assert.equal(server.calls.length, 0)
  assert.equal(server.total, 36)
  assert.equal(server.values.size, 0)
})

test('an older open control retries its original drink after another tab confirms and clears storage', async () => {
  const server = scenario(), original = mount(QuickAdd, quickProps, server.storage, server.fetch)
  button(original, 'Log 8 oz').props.onClick(); await original.flush()
  const receipt = server.calls[0]
  const otherTab = mount(QuickAdd, quickProps, server.storage, server.fetch)
  button(otherTab, 'Retry 8 oz save').props.onClick(); await otherTab.flush()
  assert.equal(server.values.size, 0)
  assert.equal(server.total, 44)
  button(original, 'Retry 8 oz save').props.onClick(); await original.flush()
  assert.equal(server.calls[2].submissionId, receipt.submissionId)
  assert.equal(server.total, 44)
})

test('status dock sends a durable ID and another hydration control can safely confirm its pending drink', async () => {
  const server = scenario(), dock = mount(Dock, dockProps, server.storage, server.fetch)
  const entry = nodes(dock.tree, node => node.type === QuickAdd)[0]
  assert.ok(entry, 'the dock uses the shared slider and confirmation interface')
  const water = mount(QuickAdd, entry.props, server.storage, server.fetch)
  nodes(water.tree, node => node.props?.['aria-label'] === 'Quick add water')[0].props.onClick(); water.render()
  button(water, '12 oz').props.onClick(); water.render()
  assert.equal(server.calls.length, 0, 'choosing a preset does not commit a drink')
  button(water, 'Log 12 oz').props.onClick(); button(water, 'Log 12 oz').props.onClick(); await water.flush()
  assert.equal(server.calls.length, 1)
  assert.equal(server.total, 48)
  assert.ok(server.calls[0].submissionId)
  assert.equal(button(water, 'Retry 12 oz save').props.disabled, false)
  const quick = mount(QuickAdd, quickProps, server.storage, server.fetch)
  button(quick, 'Retry 12 oz save').props.onClick(); await quick.flush()
  assert.equal(server.calls[1].submissionId, server.calls[0].submissionId)
  assert.equal(server.total, 48)
  assert.equal(server.values.size, 0)
})

test('slider, presets and manual amounts stay synchronized and only confirmation saves', async () => {
  const server = scenario()
  const app = mount(QuickAdd, quickProps, server.storage, server.fetch)
  const input = type => nodes(app.tree, node => node.type === 'input' && node.props.type === type)[0]
  input('range').props.onChange({ target: { value: '18' } }); app.render()
  assert.equal(input('number').props.value, '18')
  assert.equal(button(app, 'Log 18 oz').props.disabled, false)
  button(app, '16 oz').props.onClick(); app.render()
  assert.equal(input('number').props.value, '16')
  assert.equal(input('range').props.value, 16)
  assert.equal(button(app, '16 oz').props['aria-pressed'], true)
  input('number').props.onChange({ target: { value: '7.5' } }); app.render()
  assert.equal(input('range').props.value, 7.5)
  assert.equal(input('range').props['aria-valuetext'], '7.5 fluid ounces')
  assert.equal(button(app, '8 oz').props['aria-pressed'], false)
  assert.equal(server.calls.length, 0)
  button(app, 'Log 7.5 oz').props.onClick(); await app.flush()
  assert.equal(server.calls[0].ounces, 7.5)
})

test('confirmed persistence updates the displayed total and owner before navigation refresh', async () => {
  const server = scenario(), saved = []
  // The first request in this scenario commits and loses its response. Confirm it on retry.
  const app = mount(QuickAdd, { ...quickProps, onSaved: total => saved.push(total), initiallyOpen: true }, server.storage, server.fetch)
  button(app, 'Log 8 oz').props.onClick(); await app.flush()
  assert.deepEqual(saved, [])
  assert.match(text(app.tree), /36 oz logged/)
  button(app, 'Retry 8 oz save').props.onClick(); await app.flush()
  assert.deepEqual(saved, [44])
  assert.match(text(app.tree), /44 oz logged/)
  assert.match(text(app.tree), /8 oz saved/)
  assert.equal(app.refreshes, 1)
})

test('invalid manual entry prevents a save without inventing a water amount', () => {
  const server = scenario(), app = mount(QuickAdd, quickProps, server.storage, server.fetch)
  const manual = () => nodes(app.tree, node => node.type === 'input' && node.props.type === 'number')[0]
  for (const value of ['', '0', '-2', 'invalid']) {
    manual().props.onChange({ target: { value } }); app.render()
    assert.equal(nodes(app.tree, node => node.props?.className === 'tier-primary-action water-save-action')[0].props.disabled, true)
  }
  assert.equal(server.calls.length, 0)
})

test('a response from the previous client cannot update the next client dashboard', async () => {
  const server = scenario(), saved = []
  let release
  const props = { ...quickProps, onSaved: total => saved.push(total) }
  const app = mount(QuickAdd, props, server.storage, () => new Promise(resolve => { release = resolve }))
  button(app, 'Log 8 oz').props.onClick()
  props.clientId = 'QA-OTHER-CLIENT'
  props.consumed = 0
  app.render(); app.render()
  release(Response.json({ success: true, nutritionLog: { water_consumed_oz: 44 } }))
  await app.flush()
  assert.deepEqual(saved, [])
  assert.equal(app.refreshes, 0)
  assert.match(text(app.tree), /No water logged yet/)
  assert.doesNotMatch(text(app.tree), /44 oz logged|8 oz saved/)
})

test('an absent confirmed total preserves the receipt for the same drink retry', async () => {
  const server = scenario(), saved = [], calls = []
  const app = mount(QuickAdd, { ...quickProps, onSaved: total => saved.push(total) }, server.storage, async (_url, request) => {
    calls.push(JSON.parse(request.body))
    return Response.json({ success: true, nutritionLog: { water_consumed_oz: calls.length === 1 ? null : 44 } })
  })
  button(app, 'Log 8 oz').props.onClick(); await app.flush()
  assert.deepEqual(saved, [])
  assert.equal(app.refreshes, 0)
  assert.equal(server.values.size, 1)
  assert.match(text(app.tree), /saved water total could not be confirmed/)
  button(app, 'Retry 8 oz save').props.onClick(); await app.flush()
  assert.equal(calls[1].submissionId, calls[0].submissionId)
  assert.deepEqual(saved, [44])
  assert.equal(server.values.size, 0)
})

test('hydration sends no request when the retry identity cannot be persisted', async () => {
  let calls = 0
  const storage = { getItem() { return null }, setItem() { throw new Error('Quota exceeded') } }
  const app = mount(QuickAdd, quickProps, storage, async () => { calls++; return Response.json({}) })
  button(app, 'Log 8 oz').props.onClick(); await app.flush()
  assert.equal(calls, 0)
  assert.equal(app.refreshes, 0)
  assert.match(text(app.tree), /Enable browser storage/)
})

test('prior-day ambiguous saves retain their identity and cannot become a new day drink', async () => {
  const server = scenario(), first = mount(QuickAdd, quickProps, server.storage, server.fetch)
  button(first, 'Log 8 oz').props.onClick(); await first.flush()
  const saved = [...server.values.values()][0]
  const nextDay = mount(QuickAdd, { ...quickProps, logDate: '2026-10-14' }, server.storage, server.fetch)
  assert.equal(button(nextDay, 'Retry 8 oz save').props.disabled, true)
  assert.match(text(nextDay.tree), /2026-10-13 could not be confirmed/)
  assert.throws(() => submissions.beginWaterSubmission(clientId, 8, '2026-10-14'), /2026-10-13/)
  assert.equal(server.calls.length, 1)
  assert.equal([...server.values.values()][0], saved)
})


test('explicit new-day recovery keeps the complete earlier receipt before freeing today’s slot', async () => {
  const server = scenario(), first = mount(QuickAdd, quickProps, server.storage, server.fetch)
  button(first, 'Log 8 oz').props.onClick(); await first.flush()
  const receipt = JSON.parse([...server.values.values()][0])
  const nextDay = mount(QuickAdd, { ...quickProps, logDate: '2026-10-14' }, server.storage, server.fetch)
  button(nextDay, 'Keep earlier save and log today').props.onClick(); await nextDay.flush()
  assert.equal(submissions.pendingWaterSubmission(clientId), null)
  assert.deepEqual(submissions.archivedWaterSubmissions(clientId), [receipt])
  assert.equal(server.calls.length, 1, 'Recovery never retries or redates the old drink')
  button(nextDay, 'Log 8 oz').props.onClick(); await nextDay.flush()
  assert.equal(server.calls.at(-1).logDate, '2026-10-14')
  assert.notEqual(server.calls.at(-1).submissionId, receipt.submissionId)
  assert.equal(submissions.archivedWaterSubmissions(clientId)[0].logDate, logDate)
})

test('failed archival never frees the active receipt or submits today’s water', async () => {
  const server = scenario(), first = mount(QuickAdd, quickProps, server.storage, server.fetch)
  button(first, 'Log 8 oz').props.onClick(); await first.flush()
  const receipt = submissions.pendingWaterSubmission(clientId)
  const originalSet = server.storage.setItem
  server.storage.setItem = (key, value) => { if (key.includes('water-unconfirmed')) throw new Error('Quota'); originalSet(key, value) }
  const nextDay = mount(QuickAdd, { ...quickProps, logDate: '2026-10-14' }, server.storage, server.fetch)
  button(nextDay, 'Keep earlier save and log today').props.onClick(); await nextDay.flush()
  assert.deepEqual(submissions.pendingWaterSubmission(clientId), receipt)
  assert.equal(button(nextDay, 'Retry 8 oz save').props.disabled, true)
  assert.equal(server.calls.length, 1)
})

test('earlier receipt reconciliation requires verified ownership, original date and actual RPC receipt', async () => {
  const { readWaterReceiptStatus } = await import(moduleUrl('lib/hydration/reconcileWaterSubmission.ts'))
  const receipt = { submissionId:'12345678-1234-4234-8234-123456789abc',ounces:8,logDate }
  const makeDb = (data, error = null) => ({auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from(table){assert.equal(table,'nutrition_logs');const query={select(){return query},eq(){return query},maybeSingle:async()=>({data,error})};return query}})
  const row = {client_id:clientId,auth_user_id:'owner',log_date:logDate,water_submission_ids:[receipt.submissionId]}
  assert.equal(await readWaterReceiptStatus(makeDb(row),clientId,receipt),'confirmed')
  assert.equal(await readWaterReceiptStatus(makeDb({...row,water_submission_ids:[]}),clientId,receipt),'unconfirmed')
  for (const invalid of [{...row,auth_user_id:'foreign'},{...row,log_date:'2026-10-14'},null]) assert.equal(await readWaterReceiptStatus(makeDb(invalid),clientId,receipt),'unknown')
  assert.equal(await readWaterReceiptStatus(makeDb(row,{message:'Timeout'}),clientId,receipt),'unknown')
})
