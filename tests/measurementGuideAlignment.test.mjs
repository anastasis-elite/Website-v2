import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const copper = '#c58b57'
const muted = 'rgba(215,199,182,0.34)'
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? []
  : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate))
    : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const expand = tree => !tree || typeof tree !== 'object' ? tree
  : Array.isArray(tree) ? tree.map(expand)
    : typeof tree.type === 'function' ? expand(tree.type(tree.props))
      : { ...tree, props: { ...tree.props, children: expand(tree.props?.children) } }
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''

// Exercises the actual component and its shared SVG helpers; the native dialog
// and hooks are small synthetic adapters, not a browser/accessibility emulator.
function harness() {
  let stateIndex = 0, previousEffectDeps, effect, dialog
  const states = [], calls = [], dialogCalls = { showModal: 0, close: 0 }
  const ref = { current: {
    showModal() { dialogCalls.showModal += 1 },
    close() { dialogCalls.close += 1; dialog.props.onClose() },
  } }
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync('components/MeasurementAssessment.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  })
  runInNewContext(outputText, {
    module, exports: module.exports,
    require(name) {
      if (name.endsWith('.css') || name === '@/app/styles/globalstyles') return {}
      if (name === 'react') return {
        useState(initial) {
          const i = stateIndex++
          if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
          return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }]
        },
        useRef: () => ref,
        useEffect(callback, deps) {
          if (!previousEffectDeps || deps.some((dep, i) => dep !== previousEffectDeps[i])) effect = callback
          previousEffectDeps = [...deps]
        },
      }
      return require(name)
    },
    fetch: async (url, options) => {
      calls.push({ url, method: options.method, headers: { ...options.headers }, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ success: true }) }
    },
  })
  return {
    calls, dialogCalls,
    render() {
      stateIndex = 0
      const tree = expand(module.exports.default({ clientId: 'synthetic-measurement-client' }))
      dialog = nodes(tree, node => node.type === 'dialog')[0]
      const pendingEffect = effect; effect = undefined; pendingEffect?.()
      return tree
    },
  }
}

const compact = tree => nodes(tree, node => node.props?.className === 'measurement-guide')[0]
const diagrams = tree => nodes(tree, node => node.type === 'svg')
const numberInputs = tree => nodes(tree, node => node.type === 'input' && node.props.type === 'number')
const input = (tree, key) => numberInputs(tree).find(node => node.props.id === `measurement-${key}`)
const enableAdvanced = view => {
  nodes(view.render(), node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } })
}
const lines = svg => nodes(svg, node => node.type === 'line')
const geometry = svg => lines(svg).map(node => ({ ...node.props, children: undefined }))
const longLine = (svg, label) => {
  const labelNode = nodes(svg, node => node.type === 'text' && text(node) === label)[0]
  assert.ok(labelNode, `Guide label ${label} remains visible`)
  return lines(svg).find(node => Number(node.props.x1) === 58 && Number(node.props.y1) === labelNode.props.y - 4)
}

test('the four short arm guides move upward without changing side identity, width, stroke or active binding', () => {
  const view = harness()
  const expected = [
    ['left_upper_arm', 72, 118, 230, 292], ['right_upper_arm', 242, 288, 230, 292],
    ['left_forearm', 68, 112, 300, 400], ['right_forearm', 248, 292, 300, 400],
  ]
  for (const [key, x1, x2, y, oldY] of expected) {
    input(view.render(), key).props.onFocus()
    const shortLines = lines(diagrams(view.render())[0]).filter(node => Number(node.props.x1) !== 58)
    assert.equal(shortLines.length, 4)
    const line = shortLines.find(node => Number(node.props.x1) === x1)
    assert.equal(Number(line.props.x2), x2)
    assert.equal(Number(line.props.y1), y)
    assert.equal(line.props.y1, line.props.y2)
    assert.ok(Number(line.props.y1) < oldY, `${key} moves above its former position`)
    assert.equal(line.props.stroke, copper)
    assert.equal(line.props.strokeWidth, '4')
    assert.equal(line.props.strokeLinecap, 'round')
    assert.equal(shortLines.filter(node => node.props.stroke === copper).length, 1)
  }
})

test('all existing long guide positions remain exact and lower abdomen uses the existing optional lower_waist key', () => {
  const view = harness()
  const positions = { Neck: 160, Shoulders: 195, Chest: 225, Underbust: 240, Waist: 275, 'High Hip': 325, Hips: 350, Thigh: 400, Calf: 525 }
  const initial = view.render()
  assert.equal(input(initial, 'lower_waist'), undefined)
  for (const [label, y] of Object.entries(positions)) {
    const line = longLine(diagrams(initial)[0], label)
    assert.ok(line)
    assert.equal(Number(line.props.y1), y); assert.equal(Number(line.props.y2), y)
    assert.equal(line.props.x1, '58'); assert.equal(line.props.x2, '284')
    assert.equal(line.props.strokeWidth, '4'); assert.equal(line.props.strokeLinecap, 'round')
  }
  enableAdvanced(view)
  const field = input(view.render(), 'lower_waist')
  assert.ok(field)
  field.props.onFocus()
  const svg = diagrams(view.render())[0]
  const added = lines(svg).filter(node => Number(node.props.x1) === 58 && !Object.values(positions).includes(Number(node.props.y1)))
  assert.equal(added.length, 1)
  assert.equal(Number(added[0].props.y1), 310)
  assert.ok(Number(added[0].props.y1) > 275 && Number(added[0].props.y1) < 325)
  assert.equal(added[0].props.y1, added[0].props.y2)
  assert.equal(added[0].props.stroke, copper)
  assert.equal(longLine(svg, 'Waist').props.stroke, muted)
  const label = nodes(svg, node => node.type === 'text' && node.props.y === Number(added[0].props.y1) + 4)[0]
  assert.equal(text(label), 'Lower Abd.')
})

test('compact and expanded guide share corrected SVG geometry, active highlight and unchanged front-image sizing', () => {
  const view = harness()
  enableAdvanced(view)
  input(view.render(), 'lower_waist').props.onFocus()
  compact(view.render()).props.onClick()
  const tree = view.render(), svgs = diagrams(tree)
  assert.equal(svgs.length, 2)
  assert.deepEqual(geometry(svgs[0]), geometry(svgs[1]))
  for (const svg of svgs) {
    assert.equal(svg.props.viewBox, '0 0 360 720')
    assert.equal(svg.props.preserveAspectRatio, 'xMidYMid meet')
    assert.equal(svg.props.style.pointerEvents, 'none')
  }
  const images = nodes(tree, node => node.type === 'img')
  assert.equal(images.length, 2)
  for (const image of images) {
    assert.equal(image.props.src, '/woman-silhouette.png')
    assert.equal(image.props.alt, 'Woman measurement guide silhouette')
    assert.deepEqual({ ...image.props.style }, { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', opacity: 0.92, objectFit: 'contain' })
  }
  assert.equal(nodes(tree, node => node.props?.style?.aspectRatio === '360 / 720').length, 2)
})

test('lower abdomen retains its existing field, units, input value, notes and numeric save payload', async () => {
  const view = harness()
  assert.equal(numberInputs(view.render()).length, 15)
  input(view.render(), 'waist').props.onChange({ target: { value: '31.25' } })
  enableAdvanced(view)
  const tree = view.render()
  assert.equal(numberInputs(tree).length, 43)
  const field = input(tree, 'lower_waist')
  assert.equal(field.props['aria-labelledby'], 'lower_waist-label')
  assert.equal(field.props.min, '0'); assert.equal(field.props.step, '0.25')
  const row = nodes(tree, node => node.props?.className === 'measurement-row' && nodes(node, candidate => candidate.props?.id === field.props.id).length)[0]
  assert.ok(text(row).includes('Lower Waist / Lower Abdomen'))
  assert.equal(nodes(row, node => node.type === 'span')[0].props.children, 'in')
  field.props.onChange({ target: { value: '33.5' } })
  nodes(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Synthetic note' } })
  nodes(view.render(), node => node.props?.id === 'lower_waist-label')[0].props.onClick()
  assert.equal(input(view.render(), 'lower_waist').props.value, '33.5')
  assert.equal(nodes(view.render(), node => node.props?.id === 'lower_waist-label')[0].props['aria-pressed'], true)
  await nodes(view.render(), node => node.type === 'button' && node.props.className === 'assessment-action')[0].props.onClick()
  assert.equal(view.calls.length, 1)
  assert.deepEqual(view.calls[0], {
    url: '/api/measurements', method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: { client_id: 'synthetic-measurement-client', advanced_enabled: true, measurements: { waist: 31.25, lower_waist: 33.5 }, notes: 'Synthetic note' },
  })
  assert.equal(nodes(view.render(), node => node.props?.role === 'status')[0].props.children, 'Your measurements were saved.')
})

test('the existing compact guide keyboard activation and native dialog close, cancel and reopen wiring remain intact', () => {
  const view = harness()
  const guide = compact(view.render())
  assert.equal(guide.props.role, 'button'); assert.equal(guide.props.tabIndex, 0)
  assert.equal(guide.props['aria-label'], 'Open full measurement guide')
  guide.props.onKeyDown({ key: 'Tab', preventDefault() { assert.fail('Unrelated keys must not be intercepted') } })
  assert.equal(nodes(view.render(), node => node.type === 'dialog').length, 0)
  let prevented = 0
  guide.props.onKeyDown({ key: 'Enter', preventDefault() { prevented += 1 } })
  let dialog = nodes(view.render(), node => node.type === 'dialog')[0]
  assert.equal(prevented, 1); assert.equal(view.dialogCalls.showModal, 1)
  assert.equal(dialog.props['aria-label'], 'Full measurement guide')
  nodes(dialog, node => node.type === 'button' && text(node) === 'Close guide')[0].props.onClick()
  assert.equal(view.dialogCalls.close, 1)
  assert.equal(nodes(view.render(), node => node.type === 'dialog').length, 0)
  compact(view.render()).props.onKeyDown({ key: ' ', preventDefault() { prevented += 1 } })
  dialog = nodes(view.render(), node => node.type === 'dialog')[0]
  assert.equal(prevented, 2); assert.equal(view.dialogCalls.showModal, 2)
  dialog.props.onCancel()
  assert.equal(nodes(view.render(), node => node.type === 'dialog').length, 0)
  compact(view.render()).props.onClick()
  assert.equal(nodes(view.render(), node => node.type === 'dialog').length, 1)
  assert.equal(view.calls.length, 0, 'Opening and closing the guide never saves measurements')
})
