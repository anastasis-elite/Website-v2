import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(child => nodes(child, predicate))
  : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree)
  ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''
const plain = value => JSON.parse(JSON.stringify(value))

function logger({ localDate = '2026-11-14', currentDate = localDate } = {}) {
  const states = [], refs = [], requests = [], pending = [], saving = []
  let stateIndex = 0, refIndex = 0, saved = 0, tree
  const module = { exports: {} }
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
  }
  const mocks = {
    react, 'next/link': { __esModule: true, default: 'a' },
    '@/app/styles/globalstyles': {}, '@/lib/timezone': { localDateKey: () => currentDate },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  }
  const compiled = ts.transpileModule(readFileSync('components/CycleFlowLogger.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Date, require: name => mocks[name] || require(name), fetch(url, options) {
    requests.push({ url, body: JSON.parse(options.body) }); return new Promise((resolve, reject) => pending.push({ resolve, reject }))
  } })
  const render = () => { stateIndex = refIndex = 0; tree = module.exports.default({ clientId: 'member', localDate, timeZone: 'Pacific/Honolulu', onSaved: () => saved++, onSavingChange: value => saving.push(value) }); return tree }
  const find = predicate => nodes(render(), predicate)
  const button = label => find(node => node.type === 'button' && text(node) === label)[0]
  const click = label => { const buttonNode = button(label); assert.ok(buttonNode, label); const result = buttonNode.props.onClick(); render(); return result }
  const respond = (index, status, data) => pending[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => data })
  render()
  return { render, find, button, click, requests, pending, saving, respond, get tree() { return tree }, get saved() { return saved } }
}

test('shared logger opens with no product or ratings, saves explicitly, and locks repeated save handlers', async () => {
  const h = logger()
  assert.equal(h.requests.length, 0)
  assert.equal(h.button('Save Flow').props.disabled, true)
  assert.ok(h.find(node => node.type.name === 'ScaleInput').every(node => node.props.value === null))
  h.click('Add Product')
  const selects = h.find(node => node.type === 'select')
  selects[0].props.onChange({ target: { value: 'pad' } })
  h.render()
  const saturation = h.find(node => node.type === 'select' && node.props.value === '75')[0]
  saturation.props.onChange({ target: { value: '100' } })
  const save = h.button('Save Flow').props.onClick
  const first = save(), duplicate = save()
  assert.equal(h.requests.length, 1)
  assert.deepEqual(h.saving, [true])
  const payload = h.requests[0].body
  assert.equal(h.requests[0].url, '/api/cycle/flow')
  assert.equal(payload.logDate, '2026-11-14')
  assert.equal(payload.products[0].productType, 'pad'); assert.equal(payload.products[0].saturation, '100')
  for (const rating of ['energy', 'fatigue', 'perceivedRecovery', 'trainingReadiness']) assert.equal(rating in payload, false)
  h.respond(0, 200, { success: true, burden: { burdenBand: 'moderate' } })
  await first; await duplicate; h.render()
  assert.equal(h.saved, 1); assert.deepEqual(h.saving, [true, false])
  assert.equal(h.button('Flow saved').props.disabled, true)
  await save(); assert.equal(h.requests.length, 1, 'Even an old event handler cannot insert the confirmed entry again.')
  h.click('Log another entry')
  assert.equal(h.button('Save Flow').props.disabled, true)
  assert.equal(h.find(node => node.type === 'select' && node.props.value === 'pad').length, 0)
})

test('logger preserves all product detail and explicitly chosen optional ratings', async () => {
  const h = logger(); h.click('Add Product')
  h.find(node => node.type === 'select' && node.props.value === 'tampon')[0].props.onChange({ target: { value: 'cup' } }); h.render()
  const inputs = h.find(node => node.type === 'input')
  inputs[0].props.onChange({ target: { value: '2' } })
  inputs[1].props.onChange({ target: { value: '35' } })
  inputs[2].props.onChange({ target: { value: '25' } })
  inputs[3].props.onChange({ target: { value: '4' } })
  h.find(node => node.type === 'select' && node.props.value === '')[0].props.onChange({ target: { value: '75' } })
  h.find(node => node.type.name === 'CycleInlineCheckbox')[0].props.onChange(true)
  h.find(node => node.type.name === 'ScaleInput' && node.props.label === 'Fatigue')[0].props.onChange(7)
  const first = h.click('Save Flow')
  assert.deepEqual(plain(h.requests[0].body.products[0]), { productType: 'cup', absorbency: null, quantity: 1, saturation: '75', estimatedMl: 35, empties: 2, capacityMl: 25, fullness: '75', changeIntervalHours: 4, leakOrOverflow: true, customLabel: null })
  assert.equal(h.requests[0].body.fatigue, 7)
  assert.equal('energy' in h.requests[0].body, false)
  h.respond(0, 200, { success: true }); await first
})

test('known validation failure permits correction; uncertain write never blindly repeats', async () => {
  const h = logger(); h.click('Add Product')
  let save = h.button('Save Flow').props.onClick
  let first = save(); h.respond(0, 400, { error: 'Correct the product.' }); await first; h.render()
  assert.equal(h.button('Save Flow').props.disabled, false)
  save = h.button('Save Flow').props.onClick
  first = save(); h.respond(1, 500, { error: 'Derived summary failed.' }); await first; h.render()
  assert.match(text(h.tree), /may already be recorded/)
  await save(); assert.equal(h.requests.length, 2)
  assert.equal(h.button('Save Flow').props.disabled, true)
  assert.equal(h.button('Log another entry'), undefined)
  const disconnected = logger(); disconnected.click('Add Product')
  const disconnectedSave = disconnected.button('Save Flow').props.onClick
  const request = disconnectedSave(); disconnected.pending[0].reject(new Error('Disconnected')); await request; disconnected.render()
  await disconnectedSave(); assert.equal(disconnected.requests.length, 1)
})

test('stale member local day blocks flow before a request is sent', async () => {
  const h = logger({ currentDate: '2026-11-15' }); h.click('Add Product'); await h.click('Save Flow')
  assert.equal(h.requests.length, 0); assert.match(text(h.tree), /new day has started/)
})

const responseMock = `export const NextResponse={json(body,init={}){return {status:init.status||200,json:async()=>body}}}`
function flowDatabase(clientPatch = {}) {
  const cycle = { id: 'cycle-today', client_id: 'member', auth_user_id: 'owner', log_date: '2026-11-14', period_started: true, period_status: 'active', cycle_day: 1, cycle_phase: 'menstrual', symptoms: { migraine: 'moderate' }, notes: 'keep cycle detail' }
  const daily = { energy: 8, fatigue: 2, perceived_recovery: 9, training_readiness: 7, symptom_severity: { migraine: 'moderate' }, numeric_scales: { energy: 8, fatigue: 2 } }
  const historicFlow = { id: 'old-flow', raw_entry: { products: [{ productType: 'disc', estimatedMl: 20 }] } }
  const writes = [], flowHistory = [historicFlow]
  const client = { client_id: 'member', auth_user_id: 'owner', reproductive_status: 'cycling', cycle_tracking_enabled: true, ...clientPatch }
  const db = { writes, cycle, daily, flowHistory, auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) {
    let action = 'read', payload, filters = []
    const query = {
      select() { return query }, eq(key, value) { filters.push([key, value]); return query }, order() { return query }, limit() { return query },
      upsert(value) { action = 'upsert'; payload = plain(value); return query }, insert(value) { action = 'insert'; payload = plain(value); return query },
      async maybeSingle() { return { data: table === 'clients' ? client : table === 'cycle_logs' ? cycle : table === 'cycle_daily_symptoms' ? daily : null, error: null } },
      async single() { return execute(true) },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) },
    }
    function execute(single = false) {
      if (action !== 'read') {
        writes.push({ table, action, payload, filters })
        if (table === 'cycle_logs') Object.assign(cycle, payload)
        if (table === 'cycle_daily_symptoms') Object.assign(daily, payload)
        if (table === 'menstrual_flow_logs') flowHistory.push({ ...payload, id: 'new-flow' })
      }
      return { data: single ? { id: `${table}-id`, ...payload } : [], error: null }
    }
    return query
  } }
  return db
}
const { POST } = await importTs('app/api/cycle/flow/route.ts', {
  'next/server': responseMock,
  '@/lib/supabase/server': 'export async function createClient(){return globalThis.__flowDb}',
  '@/lib/membership/policy': 'export function membershipCan(){return true}',
  '@/lib/cycle/periodState': `export function cycleTrackingAllowed(c){return c.cycle_tracking_enabled!==false&&!['menopause','pregnant','not_tracking'].includes(c.reproductive_status)}`,
  '@/lib/timezone': 'export function getClientLocalDate(){return "2026-11-14"}',
  '@/lib/cycle/getCycleStatus': 'export function getCycleStatus(){return {cycleDay:6,phase:"follicular"}}',
  '@/lib/dashboard/invalidateDailyPlan': 'export function invalidateDailyPlan(){}',
  '@/lib/physiology/escalation': 'export function evaluateMenstrualFlowEscalation(){return {status:"none"}}',
  '@/lib/physiology/patternEngine': 'export function evaluatePhysiologyPatterns(){return []};export function buildClinicianPatternObservation(){return {}}',
})
const saveRequest = body => POST(new Request('http://localhost/api/cycle/flow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: 'member', ...body }) }))

test('flow endpoint rejects end/no-flow, empty products, stale dates and disabled tracking before writes', async () => {
  const products = [{ productType: 'pad', quantity: 1, saturation: '50' }]
  for (const body of [{ products: [] }, { products, periodAction: 'end' }, { products, noFlow: true }, { products, bleeding: false }, { products, periodEnded: true }, { products, logDate: '2026-11-13' }, { products: [{ productType: 'cup', quantity: 1 }] }]) {
    globalThis.__flowDb = flowDatabase()
    const result = await saveRequest(body)
    assert.ok([400, 409].includes(result.status), JSON.stringify(body)); assert.equal(globalThis.__flowDb.writes.length, 0)
  }
  for (const patch of [{ cycle_tracking_enabled: false }, { reproductive_status: 'not_tracking' }, { reproductive_status: 'pregnant' }, { reproductive_status: 'menopause' }]) {
    globalThis.__flowDb = flowDatabase(patch)
    assert.equal((await saveRequest({ products })).status, 409); assert.equal(globalThis.__flowDb.writes.length, 0)
  }
})

test('flow endpoint appends detail while preserving onset, lifecycle, cycle detail and untouched daily ratings', async () => {
  globalThis.__flowDb = flowDatabase()
  const oldFlow = plain(globalThis.__flowDb.flowHistory[0])
  const response = await saveRequest({ logDate: '2026-11-14', products: [{ productType: 'pad', quantity: 2, saturation: '50', changeIntervalHours: 3 }], symptoms: { back_pain: 'mild' } })
  assert.equal(response.status, 200)
  const db = globalThis.__flowDb
  assert.equal(db.flowHistory.length, 2); assert.deepEqual(db.flowHistory[0], oldFlow)
  assert.equal(db.cycle.period_started, true); assert.equal(db.cycle.period_status, 'active')
  assert.equal(db.cycle.cycle_day, 1); assert.equal(db.cycle.cycle_phase, 'menstrual'); assert.equal(db.cycle.notes, 'keep cycle detail')
  assert.deepEqual(db.cycle.symptoms, { migraine: 'moderate', back_pain: 'mild' })
  assert.equal(db.daily.energy, 8); assert.equal(db.daily.fatigue, 2); assert.equal(db.daily.perceived_recovery, 9); assert.equal(db.daily.training_readiness, 7)
  assert.deepEqual(db.daily.symptom_severity, { migraine: 'moderate', back_pain: 'mild' })
  assert.deepEqual(db.daily.numeric_scales, { energy: 8, fatigue: 2 })
  const productWrite = db.writes.find(write => write.table === 'menstrual_product_logs')
  assert.equal(productWrite.payload[0].change_interval_hours, 3)
  assert.equal(db.writes.find(write => write.table === 'menstrual_flow_logs').action, 'insert')
  assert.equal(db.writes.find(write => write.table === 'cycle_daily_symptoms').action, 'upsert')
})
