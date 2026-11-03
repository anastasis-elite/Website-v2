import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const shared = await importTs('lib/health/appleExport/shared.ts')
const timezone = await importTs('lib/timezone.ts')
const path = 'components/account/AppleHealthExportImport.tsx'
const nodes = (tree, match) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, match))
  : !tree || typeof tree !== 'object' ? [] : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]
const rawText = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(rawText).join(' ') : tree && typeof tree === 'object' ? rawText(tree.props?.children) : ''
const text = tree => rawText(tree).replace(/\s+/g, ' ').trim()
const date = '2026-11-03'
const baseTime = Date.parse(`${date}T10:00:00Z`)
const records = (count = 1) => Array.from({ length: count }, (_, index) => ({ metric: index % 2 ? 'resting_heart_rate' : 'heart_rate',
  value: 65 + index % 5, unit: 'count/min', startAt: new Date(baseTime + index * 1000).toISOString(),
  endAt: new Date(baseTime + index * 1000).toISOString(), creationAt: `${date}T12:00:00.000Z`,
  sourceName: 'Synthetic Watch', sourceVersion: '1', sourceDevice: 'Synthetic device' }))
const preview = rows => ({ records: rows, stats: { recordsSeen: rows.length + 10, matched: rows.length, malformed: 2, skipped: 8 },
  range: rows.length ? { startAt: rows[0].startAt, endAt: rows.at(-1).endAt } : null, sources: ['Synthetic Watch'] })
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const forbidden = () => { throw new Error('Health export data must stay out of browser storage, console and analytics') }
const postResult = (call, patch = {}) => Response.json({ success: true, date: call.body.date, timezone: call.body.timezone,
  imported: call.body.records.length, alreadyPresent: 0, replayed: false,
  receipt: { id: `synthetic:${call.body.records[0].startAt}:${call.body.records.length}`, date: call.body.date, timezone: call.body.timezone,
    inputCount: call.body.records.length, imported: call.body.records.length, alreadyPresent: 0, confirmedAt: `${date}T13:00:00Z` }, ...patch })

function harness(options = {}) {
  const states = [], refs = [], effects = [], callbacks = [], pending = [], calls = [], workers = []
  let stateIndex = 0, refIndex = 0, effectIndex = 0, callbackIndex = 0, authListener = null, authChecks = 0
  let props = { clientId: 'OWN-CLIENT', userId: 'OWN-USER', timeZone: 'UTC', eligible: true, ...options.props }
  let post = options.post || (async call => postResult(call))
  let get = options.get || (async call => {
    const query = new URL(call.url, 'https://synthetic.test').searchParams
    return Response.json({ date: query.get('date'), timezone: query.get('timezone'), records: [], total: 0,
      counts: { heart_rate: 0, resting_heart_rate: 0 }, range: null, nextCursor: null, receipts: [], provenance: 'Apple Health export; user imported' })
  })
  const auth = { getUser() { authChecks++; return options.authPromise || Promise.resolve({ data: { user: { id: 'OWN-USER' } }, error: null }) },
    onAuthStateChange(fn) { authListener = fn; return { data: { subscription: { unsubscribe() { authListener = null } } } } } }
  class FakeWorker {
    constructor(url, settings) { this.url = String(url); this.settings = settings; this.messages = []; this.terminated = false; workers.push(this) }
    postMessage(message) { this.messages.push(message) }
    terminate() { this.terminated = true }
    emit(data) { this.onmessage?.({ data }) }
  }
  const react = {
    useId: () => 'health-export',
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    useCallback(fn, deps) { const index = callbackIndex++, previous = callbacks[index]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) callbacks[index] = { fn, deps }; return callbacks[index].fn },
    useEffect(fn, deps) { const index = effectIndex++, previous = effects[index]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) pending.push(() => { previous?.cleanup?.(); effects[index] = { deps, cleanup: fn() } }) },
  }
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [`${date}T13:00:00Z`])) } }
  const mocks = { react, '@/lib/supabase/client': { createClient: () => ({ auth }) }, '@/lib/timezone': timezone,
    '@/lib/health/appleExport/shared': shared }
  const module = { exports: {} }
  const source = readFileSync(path, 'utf8').replace('import.meta.url', JSON.stringify('file:///synthetic/components/account/AppleHealthExportImport.tsx'))
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(code, { module, exports: module.exports, Date: FixedDate, Intl, URL, URLSearchParams, TextEncoder, AbortController,
    Worker: FakeWorker, window: { location: { reload() {} } }, localStorage: { getItem: forbidden, setItem: forbidden },
    sessionStorage: { getItem: forbidden, setItem: forbidden }, console: { log: forbidden, error: forbidden, warn: forbidden },
    fetch: async (url, settings = {}) => { const call = { url, ...settings, method: settings.method || 'GET', body: settings.body ? JSON.parse(settings.body) : undefined, wireBody: settings.body }; calls.push(call); return call.method === 'POST' ? post(call) : get(call) },
    require: name => name.endsWith('.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } : mocks[name] || require(name),
  }, { filename: path })
  function render() {
    stateIndex = refIndex = effectIndex = callbackIndex = 0
    const tree = module.exports.default(props)
    const input = nodes(tree, node => node.type === 'input' && node.props.type === 'file')[0]
    if (input?.ref && !input.ref.current) input.ref.current = { value: 'local-private-export.xml' }
    while (pending.length) pending.shift()()
    return tree
  }
  const button = label => nodes(render(), node => node.type === 'button' && text(node) === label)[0]
  const input = suffix => nodes(render(), node => node.type === 'input' && node.props.id?.endsWith(suffix))[0]
  const flush = async () => { await new Promise(setImmediate); render(); await new Promise(setImmediate); render() }
  const parse = () => { nodes(render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); return workers.at(-1) }
  return { render, flush, workers, calls, button, input, parse,
    get authChecks() { return authChecks },
    get postCalls() { return calls.filter(call => call.method === 'POST') },
    get fileValue() { return input('-file')?.ref?.current?.value },
    async ready() { render(); await flush() },
    file(value = { name: 'never-upload-this.xml', size: 2048, rawXml: '<private-raw-sentinel />' }) { input('-file').props.onChange({ target: { files: [value] } }); return value },
    confirm(value = true) { nodes(render(), node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: value } }) },
    makePreview(rows = records()) { const parser = parse(); parser.emit({ type: 'preview', preview: preview(rows) }); render(); return parser },
    auth(userId, event = 'SIGNED_IN') { authListener?.(event, userId ? { user: { id: userId } } : null); render() },
    setPost(fn) { post = fn }, setGet(fn) { get = fn },
    unmount() { for (const effect of effects) effect?.cleanup?.() },
  }
}

test('Account placement, labelled controls and local preview require explicit confirmation before normalized-only upload', async () => {
  const view = harness(); await view.ready()
  const rawFile = view.file(), parser = view.makePreview(records(3))
  assert.match(parser.url, /lib\/health\/appleExport\/parser\.worker\.ts$/)
  assert.equal(parser.settings.type, 'module')
  assert.equal(parser.messages[0].file, rawFile)
  assert.equal(parser.messages[0].date, date)
  assert.equal(parser.terminated, true)
  assert.equal(view.postCalls.length, 0)
  view.button('Confirm and import previewed readings').props.onClick(); await view.flush()
  assert.equal(view.postCalls.length, 0, 'Programmatic action is guarded as well as the disabled button.')
  const tree = view.render()
  assert.match(tree.props.className, /ph-no-capture ph-sensitive/)
  assert.equal(view.input('-date').props.type, 'date')
  assert.equal(view.input('-zone').props['aria-describedby'], 'health-export-zone-help')
  assert.equal(nodes(tree, node => node.props.role === 'region')[0].props.tabIndex, 0)
  assert.equal(nodes(tree, node => node.type === 'fieldset')[0].props.disabled, false)
  assert.match(text(tree), /Nothing has been sent/)
  assert.match(text(tree), /Apple Health export; user imported/)
  assert.match(text(tree), /Gaps are unknown/)
  assert.match(text(tree), /Native and export readings can overlap/)
  assert.match(text(tree), /2 malformed or invalid/)
  view.confirm(); view.button('Confirm and import previewed readings').props.onClick(); await view.flush()
  assert.equal(view.postCalls.length, 1)
  const call = view.postCalls[0]
  assert.deepEqual(Object.keys(call.body).sort(), ['date', 'records', 'timezone'])
  assert.deepEqual(call.body.records, records(3))
  assert.equal(call.headers['X-Expected-Client-Id'], 'OWN-CLIENT')
  assert.equal(call.headers['X-Expected-User-Id'], 'OWN-USER')
  assert.equal(call.credentials, 'same-origin'); assert.equal(call.cache, 'no-store')
  assert.doesNotMatch(call.wireBody, /never-upload|rawXml|private-raw-sentinel|filename/)
  assert.match(text(view.render()), /All previewed readings are confirmed/)
  assert.match(text(view.render()), /3 imported;\s+0 already present/)
  const account = readFileSync('components/account/AccountDashboard.tsx', 'utf8')
  assert.ok(account.indexOf('Connections &amp; privacy') < account.indexOf('<AppleHealthExportImport'))
  assert.match(account, /key=\{`\$\{importUserId\}:\$\{data\.profile\.clientId\}`\}/)
  view.unmount()
})

test('parsing cancellation and selection changes discard only ephemeral preview and fence late worker events', async () => {
  const view = harness(); await view.ready(); view.file()
  const parser = view.parse()
  parser.emit({ type: 'progress', bytes: 512, total: 2048 })
  const progress = nodes(view.render(), node => node.type === 'progress')[0]
  assert.equal(progress.props.value, 512); assert.equal(progress.props.max, 2048)
  view.button('Cancel preview').props.onClick()
  assert.equal(parser.terminated, true)
  parser.emit({ type: 'preview', preview: preview(records()) })
  assert.equal(nodes(view.render(), node => node.type === 'input' && node.props.type === 'checkbox').length, 0)
  assert.match(text(view.render()), /Preview canceled\. No readings were sent/)
  assert.equal(view.postCalls.length, 0)
  view.makePreview(records())
  view.input('-zone').props.onChange({ target: { value: 'Not/A_Zone' } })
  assert.doesNotThrow(() => view.render())
  assert.equal(nodes(view.render(), node => node.type === 'input' && node.props.type === 'checkbox').length, 0)
  assert.equal(view.button('Preview selected day').props.disabled, true)
  assert.equal(view.postCalls.length, 0)
  view.unmount()
})

test('partial batch failure stays truthful and explicit same-preview retry reports existing records without duplicate intent', async () => {
  const view = harness(); await view.ready(); view.file(); view.makePreview(records(201))
  let attempts = 0
  view.setPost(async call => {
    attempts++
    if (attempts === 2) return Response.json({ error: 'Synthetic failed batch' }, { status: 503 })
    return postResult(call)
  })
  view.confirm(); view.button('Confirm and import previewed readings').props.onClick(); await view.flush()
  assert.equal(view.postCalls.length, 2)
  assert.match(text(view.render()), /Import was not fully confirmed/)
  assert.match(text(view.render()), /100 imported;\s+0 already present;\s+100 confirmed/)
  assert.doesNotMatch(text(view.render()), /All previewed readings are confirmed/)
  assert.equal(nodes(view.render(), node => node.type === 'input' && node.props.type === 'checkbox')[0].props.checked, false)
  let retry = 0
  view.setPost(async call => { retry++; return postResult(call, {
    imported: retry === 1 ? 0 : call.body.records.length, alreadyPresent: retry === 1 ? call.body.records.length : 0, replayed: retry === 1 }) })
  view.confirm(); view.button('Confirm and import previewed readings').props.onClick(); await view.flush()
  assert.equal(view.postCalls.length, 5)
  assert.deepEqual(view.postCalls[2].body, view.postCalls[0].body)
  assert.match(text(view.render()), /101 imported;\s+100 already present;\s+201 confirmed/)
  assert.match(text(view.render()), /All previewed readings are confirmed/)
  view.unmount()
})

test('normalized upload batches respect both record count and exact UTF-8 body limits', async () => {
  const view = harness(); await view.ready(); view.file()
  const rows = records(100).map(row => ({ ...row, sourceName: '🙂'.repeat(100), sourceVersion: '🙂'.repeat(50), sourceDevice: '🙂'.repeat(500) }))
  view.makePreview(rows); view.confirm(); view.button('Confirm and import previewed readings').props.onClick(); await view.flush()
  assert.ok(view.postCalls.length > 1)
  assert.equal(view.postCalls.flatMap(call => call.body.records).length, rows.length)
  for (const call of view.postCalls) {
    assert.ok(call.body.records.length <= shared.APPLE_EXPORT_LIMITS.batchRecords)
    assert.ok(new TextEncoder().encode(call.wireBody).length <= shared.APPLE_EXPORT_LIMITS.bodyBytes)
  }
  assert.match(text(view.render()), /All previewed readings are confirmed/)
  view.unmount()
})

test('unknown account, changed account and stopped in-flight imports never reuse or falsely confirm a previous account preview', async () => {
  const checking = deferred(), pending = harness({ authPromise: checking.promise })
  pending.render()
  assert.equal(nodes(pending.render(), node => node.type === 'fieldset')[0].props.disabled, true)
  assert.equal(pending.calls.length, 0)
  pending.auth('OTHER-USER')
  checking.resolve({ data: { user: { id: 'OWN-USER' } }, error: null }); await pending.flush()
  assert.match(text(pending.render()), /signed-in account changed/)
  assert.equal(pending.calls.length, 0)
  pending.unmount()

  const view = harness(); await view.ready(); view.file(); view.makePreview(records(2))
  const send = deferred(); view.setPost(() => send.promise)
  view.confirm(); view.button('Confirm and import previewed readings').props.onClick()
  assert.equal(view.postCalls.length, 1)
  view.auth('OTHER-USER')
  assert.equal(view.postCalls[0].signal.aborted, true)
  assert.equal(view.fileValue, '')
  send.resolve(Response.json({ success: true, date, timezone: 'UTC', imported: 2, alreadyPresent: 0 })); await view.flush()
  assert.match(text(view.render()), /signed-in account changed/)
  assert.doesNotMatch(text(view.render()), /All previewed readings|Timestamp range:/)
  assert.equal(nodes(view.render(), node => node.type === 'input' && node.props.type === 'checkbox').length, 0)
  view.unmount()

  const stopped = harness(); await stopped.ready(); stopped.file(); stopped.makePreview(records(2))
  const inFlight = deferred(); stopped.setPost(() => inFlight.promise)
  stopped.confirm(); stopped.button('Confirm and import previewed readings').props.onClick()
  stopped.button('Stop import').props.onClick()
  inFlight.resolve(Response.json({ success: true, date, timezone: 'UTC', imported: 2, alreadyPresent: 0 })); await stopped.flush()
  assert.match(text(stopped.render()), /an in-flight batch may also have saved/)
  assert.doesNotMatch(text(stopped.render()), /All previewed readings are confirmed/)
  assert.equal(stopped.postCalls[0].signal.aborted, true)
  stopped.unmount()
})

test('persisted review reads reload independently with truthful gaps, paging and retry while Free renders no health controls or requests', async () => {
  const rows = records(2), view = harness({ get: async call => {
    const query = new URL(call.url, 'https://synthetic.test').searchParams
    return Response.json({ date: query.get('date'), timezone: query.get('timezone'), records: rows, total: 102,
      counts: { heart_rate: 51, resting_heart_rate: 51 }, range: { startAt: rows[0].startAt, endAt: rows[1].endAt },
      nextCursor: query.get('cursor') === '0' ? '100' : null, receipts: [], provenance: 'Apple Health export; user imported' })
  } })
  await view.ready()
  assert.equal(view.workers.length, 0)
  assert.match(text(view.render()), /102 readings saved/)
  assert.match(text(view.render()), /Gaps do not establish continuous coverage/)
  view.button('Next saved readings').props.onClick(); await view.flush()
  assert.match(view.calls.at(-1).url, /cursor=100/)
  assert.equal(view.calls.at(-1).headers['X-Expected-User-Id'], 'OWN-USER')
  view.setGet(async () => Response.json({ error: 'Synthetic unavailable result' }, { status: 503 }))
  view.button('Refresh saved readings').props.onClick(); await view.flush()
  assert.match(text(view.render()), /could not be loaded/)
  assert.doesNotMatch(text(view.render()), /No imported readings are saved/)
  assert.equal(view.postCalls.length, 0)
  view.unmount()

  const free = harness({ props: { eligible: false } }); await free.ready()
  assert.match(text(free.render()), /not currently available for this membership/)
  assert.equal(nodes(free.render(), node => node.type === 'form').length, 0)
  assert.equal(free.calls.length, 0); assert.equal(free.authChecks, 0)
  free.unmount()
})

test('SDK initial identity cannot bypass verified auth and either account-conflict response clears and locks the preview', async () => {
  const checking = deferred(), pending = harness({ authPromise: checking.promise })
  pending.render(); pending.auth('OWN-USER', 'INITIAL_SESSION')
  assert.equal(nodes(pending.render(), node => node.type === 'fieldset')[0].props.disabled, true)
  assert.equal(pending.calls.length, 0)
  checking.resolve({ data: { user: { id: 'OWN-USER' } }, error: null }); await pending.flush()
  assert.equal(nodes(pending.render(), node => node.type === 'fieldset')[0].props.disabled, false)
  assert.equal(pending.calls.length, 1)
  pending.unmount()

  const write = harness(); await write.ready(); write.file(); write.makePreview(records())
  write.setPost(async () => Response.json({ error: 'Synthetic changed account', code: 'ACCOUNT_CHANGED' }, { status: 409 }))
  write.confirm(); write.button('Confirm and import previewed readings').props.onClick(); await write.flush()
  assert.match(text(write.render()), /signed-in account changed/)
  assert.equal(nodes(write.render(), node => node.type === 'input' && node.props.type === 'checkbox').length, 0)
  assert.equal(nodes(write.render(), node => node.type === 'fieldset')[0].props.disabled, true)
  assert.doesNotMatch(text(write.render()), /All previewed readings/)
  write.unmount()

  const read = harness(); await read.ready(); read.file(); read.makePreview(records())
  read.setGet(async () => Response.json({ error: 'Synthetic changed account', code: 'ACCOUNT_CHANGED' }, { status: 409 }))
  read.button('Refresh saved readings').props.onClick(); await read.flush()
  assert.match(text(read.render()), /signed-in account changed/)
  assert.equal(read.fileValue, '')
  assert.equal(nodes(read.render(), node => node.type === 'input' && node.props.type === 'checkbox').length, 0)
  read.unmount()
})

test('durable per-batch receipts survive reload while replay reports current counts separately from original confirmation counts', async () => {
  const rows = records(2), receipt = { id: 'synthetic-first-batch', date, timezone: 'UTC', inputCount: 2,
    imported: 2, alreadyPresent: 0, confirmedAt: `${date}T12:30:00Z` }
  const view = harness({ get: async () => Response.json({ date, timezone: 'UTC', records: rows, total: 2,
    counts: { heart_rate: 1, resting_heart_rate: 1 }, range: { startAt: rows[0].startAt, endAt: rows.at(-1).endAt },
    nextCursor: null, provenance: 'Apple Health export; user imported', receipts: [receipt] }) })
  await view.ready()
  assert.match(text(view.render()), /2 readings: 2 imported and 0 already present at the original confirmation/)
  assert.match(text(view.render()), /not whole-file totals/)
  assert.equal(view.workers.length, 0)
  view.file(); view.makePreview(rows)
  view.setPost(async call => postResult(call, { imported: 0, alreadyPresent: 2, replayed: true, receipt }))
  view.confirm(); view.button('Confirm and import previewed readings').props.onClick(); await view.flush()
  assert.match(text(view.render()), /This attempt: 0 imported; 2 already present; 2 confirmed/)
  assert.match(text(view.render()), /1 previously confirmed batch was recognized/)
  assert.match(text(view.render()), /2 readings: 2 imported and 0 already present at the original confirmation/)
  assert.match(text(view.render()), /All previewed readings are confirmed/)
  view.setGet(async () => Response.json({ date, timezone: 'UTC', records: rows, total: 2,
    counts: { heart_rate: 1, resting_heart_rate: 1 }, range: null, nextCursor: null,
    provenance: 'Apple Health export; user imported', receipts: [{ ...receipt, date: '2026-11-02' }] }))
  view.button('Refresh saved readings').props.onClick(); await view.flush()
  assert.match(text(view.render()), /saved imported readings could not be loaded/)
  assert.doesNotMatch(text(view.render()), /already present at the original confirmation/)
  view.setPost(async call => postResult(call, { receipt: { ...receipt, date: '2026-11-02' } }))
  view.file(); view.makePreview(rows); view.confirm(); view.button('Confirm and import previewed readings').props.onClick(); await view.flush()
  assert.match(text(view.render()), /Import was not fully confirmed/)
  view.unmount()
})
