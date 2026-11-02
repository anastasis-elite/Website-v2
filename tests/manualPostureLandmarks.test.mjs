import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const manual = await importTs('lib/posture/manualLandmarks.ts')
const definitions = await importTs('lib/posture/landmarks.ts')
const geometry = await importTs('lib/posture/geometry.ts')
const text = node => (typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : '').replace(/\s+/g, ' ').trim()
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate)) : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const plain = value => JSON.parse(JSON.stringify(value))

function harness(path = 'components/PostureLandmarkEditor.tsx', extra = {}, initialProps = {}) {
  const slots = [];let cursor = 0, pending = [], props = initialProps, tree, refreshes = 0
  const changed = (left, right) => !left || left.length !== right?.length || left.some((item, index) => !Object.is(item, right[index]))
  const hooks = {
    useState(initial) { const index = cursor++;if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value }] },
    useRef(initial) { const index = cursor++;return slots[index] ||= { current: initial } },
    useMemo(fn, deps) { const index = cursor++;if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { deps, value: fn() };return slots[index].value },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps) },
    useEffect(fn, deps) { const index = cursor++;if (!slots[index] || changed(slots[index].deps, deps)) { const prior = slots[index];slots[index] = { deps };pending.push(() => { prior?.cleanup?.();slots[index].cleanup = fn() }) } },
  }
  const image = { width: 900, height: 1200, naturalWidth: 1000, naturalHeight: 2000, complete: false }
  const svg = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 200 }) }
  const requests = [], confirmations = []
  let transport = async (_url, options) => { const data = JSON.parse(options.body), summary = manual.manualLandmarkSummary(data.landmarks);return { ok: true, json: async () => ({ success: true, ...summary }) } }
  const mocks = {
    react: hooks,
    'next/image': { __esModule: true, default: 'img' },
    'next/navigation': { useRouter: () => ({ refresh() { refreshes++ } }) },
    '@/components/aos-ui/AOSButton': { AOSButton: 'button' }, '@/components/aos-ui/AOSChip': { AOSChip: 'button' },
    '@/components/PostureLandmarkEditor': { __esModule: true, default: 'posture-editor' },
    '@/lib/posture/landmarks': definitions, '@/lib/posture/geometry': geometry, '@/lib/posture/manualLandmarks': manual,
    ...extra,
  }
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, require: name => {
    assert.doesNotMatch(name, /poseDetection|tensorflow|blazepose/i, 'Member editor must not load a detector resource.')
    return mocks[name] || require(name)
  }, fetch: async (url, options) => { requests.push({ url, options });return transport(url, options) },
  FormData: class { entries = [];append(...entry) { this.entries.push(entry) } },
  URL: { createObjectURL: () => 'blob:synthetic-photo', revokeObjectURL() {} },
  alert() { throw new Error('Unexpected upload alert') }, console })
  const render = patch => {
    props = { ...props, ...patch };let cycles = 0
    do {
      cursor = 0;pending = []
      tree = module.exports.default(path.includes('PostureLandmarkEditor') ? { assessmentPhotoId: 'QA-PHOTO', view: 'front', imageUrl: '/synthetic.jpg', path: 'QA-OWN/front.jpg', onConfirmed: value => confirmations.push(value), ...props } : props)
      for (const item of nodes(tree, node => node.type === 'img')) if (item.ref) item.ref.current = image
      for (const item of nodes(tree, node => node.type === 'svg')) if (item.ref) item.ref.current = svg
      const effects = pending;pending = [];effects.forEach(effect => effect())
      if (!effects.length) break
    } while (++cycles < 5)
    return tree
  }
  const find = (predicate) => nodes(render(), predicate)[0]
  const button = label => find(node => node.type === 'button' && text(node) === label)
  const load = () => { find(node => node.type === 'img').props.onLoad();return render() }
  const select = label => { button(label).props.onClick();return render() }
  const place = (x = 35, y = 70) => { find(node => node.type === 'svg' && node.props.className === 'aos-landmark-overlay').props.onPointerDown({ target: { tagName: 'svg' }, clientX: x, clientY: y });return render() }
  return { render, find, button, load, select, place, image, requests, confirmations,
    setTransport(fn) { transport = fn }, get refreshes() { return refreshes } }
}

test('manual definitions begin empty, keep anatomical sides and never require invisible side-view points', () => {
  for (const [view, count] of [['front', 19], ['back', 19], ['left', 11], ['right', 11]]) {
    const points = manual.createManualLandmarks(view)
    assert.equal(points.filter(point => point.visible).length, count)
    assert.ok(points.every(point => point.automatic === null && point.confirmed === null && point.manuallyAdjusted === false && point.lowConfidence === undefined))
    let placed = points
    for (const point of points.filter(point => point.visible)) placed = manual.updateManualLandmark(placed, point.name, { x: .2, y: .4, confidence: .99 })
    assert.deepEqual(plain(manual.manualLandmarkSummary(placed)), { confirmedCount: count, visibleCount: count, complete: true })
    assert.ok(placed.filter(point => !point.visible).every(point => point.confirmed === null))
    assert.ok(placed.filter(point => point.visible).every(point => point.confirmed.confidence === undefined && point.automatic === null))
    if (view === 'left' || view === 'right') assert.ok(placed.filter(point => point.visible && point.side !== 'center').every(point => point.side === view))
  }
})

test('actual editor image load begins with zero manual points and no estimated/model controls or resources', () => {
  const view = harness();view.load()
  assert.match(text(view.render()), /Manual placement · 0 of 19/)
  assert.equal(nodes(view.render(), node => node.type === 'circle').length, 0)
  assert.equal(view.button('Save placed landmarks').props.disabled, true)
  assert.doesNotMatch(text(view.render()), /Estimating|Estimated|Reset to automatic|person detected|confidence/i)
  const source = readFileSync('components/PostureLandmarkEditor.tsx', 'utf8')
  assert.doesNotMatch(source, /poseDetection|estimatePostureLandmarks|tensorflow|BlazePose|runDetection|resetAutomatic/)
})

test('named manual placement, drag, undo, clear and reset preserve user coordinates without guessing points', () => {
  const view = harness();view.load();view.select('Left shoulder Unplaced · unknown');view.place()
  let point = view.find(node => node.type === 'circle')
  assert.deepEqual([point.props.cx, point.props.cy], [.25, .25])
  point.props.onPointerDown({ preventDefault() {}, stopPropagation() {}, pointerId: 1, currentTarget: { setPointerCapture() {} } });view.render()
  point = view.find(node => node.type === 'circle');point.props.onPointerMove({ clientX: 60, clientY: 120 });view.render()
  point = view.find(node => node.type === 'circle');point.props.onPointerUp({ pointerId: 1, currentTarget: { releasePointerCapture() {} } });view.render()
  assert.deepEqual([view.find(node => node.type === 'circle').props.cx, view.find(node => node.type === 'circle').props.cy], [.5, .5])
  view.button('Undo').props.onClick();view.render()
  assert.deepEqual([view.find(node => node.type === 'circle').props.cx, view.find(node => node.type === 'circle').props.cy], [.25, .25])
  view.button('Clear').props.onClick();view.render();assert.equal(nodes(view.render(), node => node.type === 'circle').length, 0)
  view.button('Undo').props.onClick();view.render();assert.equal(nodes(view.render(), node => node.type === 'circle').length, 1)
  view.button('Reset manual points').props.onClick();view.render()
  assert.equal(nodes(view.render(), node => node.type === 'circle').length, 0)
  assert.match(text(view.render()), /Unplaced points remain unknown/)
})

test('partial confirmation sends accurate manual provenance once and never claims all visible points complete', async () => {
  const view = harness();view.load();view.place()
  let release
  view.setTransport((_url, options) => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ success: true, ...manual.manualLandmarkSummary(JSON.parse(options.body).landmarks) }) }) }))
  const confirm = view.button('Save placed landmarks').props.onClick
  const pending = confirm();await confirm()
  assert.equal(view.requests.length, 1)
  const request = JSON.parse(view.requests[0].options.body)
  assert.equal(view.requests[0].url, '/api/assessment-photos/landmarks')
  assert.equal(request.detectionStatus, 'manual');assert.deepEqual(request.rawLandmarks, [])
  assert.deepEqual([request.imageWidth, request.imageHeight], [1000, 2000])
  assert.equal(request.landmarks.filter(point => point.confirmed !== null).length, 1)
  assert.ok(request.landmarks.every(point => point.automatic === null && point.confirmed?.confidence === undefined))
  release();await pending;view.render()
  assert.deepEqual(plain(view.confirmations), [{ complete: false, confirmedCount: 1, visibleCount: 19 }])
  assert.match(text(view.render()), /Saved 1 of 19 visible landmarks/)
})

test('save errors and inconsistent success retain manual points and permit a truthful retry', async () => {
  const view = harness();view.load();view.place()
  view.setTransport(async () => { throw new Error('Synthetic transport failure') })
  await view.button('Save placed landmarks').props.onClick();view.render()
  assert.match(text(view.render()), /Your placed points are still here/)
  assert.equal(nodes(view.render(), node => node.type === 'circle').length, 1)
  view.setTransport(async () => ({ ok: true, json: async () => ({ success: true, complete: true, confirmedCount: 1, visibleCount: 19 }) }))
  await view.button('Save placed landmarks').props.onClick();view.render()
  assert.equal(view.confirmations.length, 0)
  view.setTransport(async (_url, options) => ({ ok: true, json: async () => ({ success: true, ...manual.manualLandmarkSummary(JSON.parse(options.body).landmarks) }) }))
  await view.button('Save placed landmarks').props.onClick();view.render()
  assert.equal(view.confirmations.length, 1)
  assert.deepEqual(view.requests.map(request => request.options.body), Array(3).fill(view.requests[0].options.body))
})

test('changing photo or side starts empty and a late prior save cannot advance the new view', async () => {
  const view = harness();view.load();view.place()
  let release
  view.setTransport((_url, options) => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ success: true, ...manual.manualLandmarkSummary(JSON.parse(options.body).landmarks) }) }) }))
  const pending = view.button('Save placed landmarks').props.onClick()
  view.render({ view: 'right', path: 'QA-OWN/right.jpg', imageUrl: '/right.jpg' });view.load()
  release();await pending;view.render()
  assert.equal(view.confirmations.length, 0)
  assert.match(text(view.render()), /0 of 11 visible landmarks placed/)
  assert.equal(nodes(view.render(), node => node.type === 'circle').length, 0)
})

test('upload flow labels partial views and final saved state without changing the existing upload endpoint', async () => {
  const view = harness('components/AssessmentPhotoUpload.tsx', {}, { initialAssessmentType: 'posture' })
  view.setTransport(async () => ({ ok: true, json: async () => ({ record: { id: 'QA-RECORD' }, uploadedViews: [
    { view: 'front', path: 'QA-OWN/front.jpg', signedUrl: '/front.jpg' }, { view: 'left', path: 'QA-OWN/left.jpg', signedUrl: '/left.jpg' },
  ] }) }))
  await view.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });view.render()
  assert.equal(view.requests[0].url, '/api/assessment-photos/upload')
  assert.doesNotMatch(text(view.render()), /estimated/i)
  view.find(node => node.type === 'posture-editor').props.onConfirmed({ complete: false, confirmedCount: 1, visibleCount: 19 });view.render()
  assert.match(text(view.render()), /Front · partial/)
  const editor = view.find(node => node.type === 'posture-editor');assert.equal(editor.props.view, 'left')
  editor.props.onConfirmed({ complete: true, confirmedCount: 11, visibleCount: 11 });view.render()
  assert.match(text(view.render()), /Some points remain unplaced and unknown/)
  assert.doesNotMatch(text(view.render()), /confirmed for each uploaded view/)
  assert.equal(view.refreshes, 1)
})
