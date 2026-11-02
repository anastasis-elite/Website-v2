import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : ''
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
function harness() {
  const states = [], refs = [], effects = [], calls = []
  let cursor = 0, refIndex = 0, effectIndex = 0, pendingEffects = []
  let send = async () => ({ ok: true, json: async () => ({ success: true }) })
  const module = { exports: {} }
  const react = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    useEffect(fn, deps) { const index = effectIndex++; if (!effects[index] || deps.some((value, n) => value !== effects[index][n])) { effects[index] = deps; pendingEffects.push(fn) } },
  }
  const compiled = ts.transpileModule(readFileSync('components/tracker/TrackerIntake.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Error, crypto: { randomUUID }, require: name => name === 'react' ? react : require(name),
    fetch(url, options) {
      if (!options?.method) return Promise.resolve({ ok: true, json: async () => ({ nutritionLog: { tracking_only: true, calories: 0, water_oz: 0, water_consumed_oz: 12 }, entries: [{ id: 'saved', calories: 200, protein_g: 10, carbs_g: 20, fat_g: 8 }] }) })
      calls.push(JSON.parse(options.body)); return send()
    },
  })
  function render() { cursor = refIndex = effectIndex = 0; const tree = module.exports.default({ clientId: 'owned-tracker' }); pendingEffects.splice(0).forEach(fn => fn()); return tree }
  return { render, calls,
    field(label, value) { const input = nodes(nodes(render(), node => node.type === 'label' && text(node).startsWith(label))[0], node => node.type === 'input')[0]; if (value !== undefined) input.props.onChange({ target: { value } }); return input },
    submit() { return nodes(render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }) },
    setSend(fn) { send = fn }, async ready() { render(); await new Promise(resolve => setImmediate(resolve)); render() },
  }
}

test('Tracker shows saved actual intake without inventing targets and rejects empty or invalid submissions', async () => {
  const view = harness(); await view.ready()
  assert.match(text(view.render()), /Water recorded:\s+12\s+oz/)
  assert.match(text(view.render()), /200\s+calories/)
  assert.doesNotMatch(text(view.render()), /0 oz goal|target: 0|recommended intake/i)
  assert.equal(view.field('Calories').props.value, '')
  await view.submit(); assert.equal(view.calls.length, 0)
  view.field('Calories', '-1'); await view.submit(); assert.equal(view.calls.length, 0)
  view.field('Calories', '150'); view.field('Protein', '0')
  view.field('Water', '0'); await view.submit(); assert.equal(view.calls.length, 0)
  view.field('Water', '')
  await view.submit()
  assert.equal(view.calls.length, 1)
  assert.equal(view.calls[0].clientId, 'owned-tracker')
  assert.equal(view.calls[0].calories, 150); assert.equal(view.calls[0].protein, 0)
  assert.equal(Object.hasOwn(view.calls[0], 'waterOz'), false)
  assert.match(text(view.render()), /Intake saved/)
})

test('Tracker retries the exact entry after an unconfirmed save and never posts duplicate in-flight submissions', async () => {
  const view = harness(); await view.ready(); view.field('Water', '8')
  let finish
  view.setSend(() => new Promise(resolve => { finish = resolve }))
  const pending = view.submit(); await view.submit()
  assert.equal(view.calls.length, 1)
  finish({ ok: false, json: async () => ({ error: 'Temporary save failure' }) }); await pending
  assert.match(text(view.render()), /Temporary save failure/)
  assert.equal(nodes(view.render(), node => node.type === 'fieldset')[0].props.disabled, true)
  view.setSend(async () => ({ ok: true, json: async () => ({ success: true }) }))
  await view.submit()
  assert.deepEqual(view.calls[1], view.calls[0])
  assert.match(text(view.render()), /Intake saved/)
})
