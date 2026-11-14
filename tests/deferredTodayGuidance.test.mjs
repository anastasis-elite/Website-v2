import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const nodes = (tree, predicate) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate))
  : !tree || typeof tree !== 'object' ? [] : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''

// Execute the real deferred loader. CommonJS transpilation keeps native import's
// Promise/microtask boundary while allowing the chunk transport to fail safely.
function harness({ commitInitially = true } = {}) {
  let stateIndex = 0, effectIndex = 0, changed = false, mounted = true, tree
  let importFailure = null, imports = 0, afterUnmountUpdates = 0
  const states = [], effects = []
  const props = { logic: { client: { id: 'SYNTHETIC-OWNER' }, program: 'ignite' },
    schedule: { date: '2026-11-14', timezone: 'UTC' }, presentation: 'section', hideDayCarousel: true, manageRefresh: false }
  const Guidance = function SyntheticLoadedGuidance() {}
  const react = {
    useState(initial) {
      const index = stateIndex++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], update => {
        if (!mounted) { afterUnmountUpdates++; return }
        const value = typeof update === 'function' ? update(states[index]) : update
        if (!Object.is(value, states[index])) { states[index] = value; changed = true }
      }]
    },
    useEffect(callback, deps) {
      const index = effectIndex++, previous = effects[index]
      if (!previous || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) {
        effects[index] = { callback, deps, pending: true, cleanup: previous?.cleanup }
      }
    },
  }
  const module = { exports: {} }
  const file = resolve('components/program-dashboard/DeferredTodayGuidance.tsx')
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'Fragment' }
    if (name === './GuidedToday') {
      imports++
      if (importFailure) throw importFailure
      return { __esModule: true, default: Guidance }
    }
    assert.fail('Unexpected deferred-loader dependency: ' + name)
  }, fetch() { assert.fail('Downloading display code cannot re-run member API work') } }, { filename: file })
  const DeferredGuidance = module.exports.default
  function render({ commit = true } = {}) {
    assert.ok(mounted, 'Cannot render an unmounted guidance section')
    let count = 0
    do {
      changed = false; stateIndex = effectIndex = 0
      tree = DeferredGuidance(props)
      if (commit) for (const effect of effects) if (effect.pending) {
        effect.pending = false; effect.cleanup?.(); effect.cleanup = effect.callback()
      }
      assert.ok(count++ < 10, 'The deferred loader settles without a render loop')
    } while (changed)
    return tree
  }
  async function flush() {
    for (let turn = 0; turn < 5; turn++) await Promise.resolve()
    if (mounted) render()
  }
  render({ commit: commitInitially })
  return {
    render, flush, props, Guidance,
    get tree() { return tree }, get imports() { return imports }, get afterUnmountUpdates() { return afterUnmountUpdates },
    fail(error = new Error('Synthetic guidance chunk could not be downloaded')) { importFailure = error },
    succeed() { importFailure = null },
    retry() {
      const button = nodes(tree, node => node.type === 'button' && text(node) === 'Retry guidance download')[0]
      assert.ok(button, 'The failed section exposes a local retry')
      button.props.onClick(); render()
    },
    unmount() { mounted = false; for (const effect of effects) effect.cleanup?.() },
  }
}

test('guidance code stays deferred until the enriched section commits, then receives current verified props', async () => {
  const view = harness({ commitInitially: false })
  assert.equal(view.imports, 0, 'Evaluating and rendering the light wrapper does not request guidance code')
  assert.match(text(view.tree), /Opening your current guidance/)
  view.render()
  await view.flush()
  assert.equal(view.imports, 1)
  assert.equal(view.tree.type, view.Guidance)
  assert.equal(view.tree.props.logic, view.props.logic)
  assert.equal(view.tree.props.schedule, view.props.schedule)
  assert.equal(view.tree.props.hideDayCarousel, true)
  assert.equal(view.tree.props.manageRefresh, false)
  view.unmount()
})

test('a failed guidance chunk offers a local retry and a later successful import mounts guidance', async () => {
  const view = harness({ commitInitially: false })
  view.fail(); view.render()
  await view.flush()
  assert.equal(view.imports, 1)
  assert.match(text(view.tree), /could not be downloaded/)
  assert.match(text(view.tree), /Your verified day is still available/)
  assert.ok(nodes(view.tree, node => node.type === 'button').length)
  view.succeed(); view.retry()
  assert.match(text(view.tree), /Opening your current guidance/)
  await view.flush()
  assert.equal(view.imports, 2, 'Retry performs a new import instead of reusing a cached rejection')
  assert.equal(view.tree.type, view.Guidance)
  assert.equal(view.tree.props.logic, view.props.logic)
  assert.equal(nodes(view.tree, node => node.type === 'button').length, 0)
  view.unmount()
})

test('late import success and failure cannot update an unmounted member section', async () => {
  for (const fail of [false, true]) {
    const view = harness({ commitInitially: false })
    if (fail) view.fail()
    view.render()
    view.unmount()
    await view.flush()
    assert.equal(view.imports, 1, 'The escaped transport microtask still settles')
    assert.equal(view.afterUnmountUpdates, 0, 'Neither success nor failure can set state after disposal')
  }
})
