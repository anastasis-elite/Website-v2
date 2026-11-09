import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate)) : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''
const tick = () => new Promise(setImmediate)
const pending = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

// Disposable hook/event surfaces exercise member-free browser behavior without installing anything.
function hooks() {
  const slots = []
  let cursor = 0, effects = [], writes = 0, dirty = false
  const same = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
  const react = {
    createContext(value) { return { Provider: 'provider', value } },
    useContext(context) { return context.value },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; writes++; dirty = true }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useId() { const index = cursor++; return slots[index] ||= `install-dialog-${index}` },
    useCallback(callback, deps) {
      const index = cursor++
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, callback }
      return slots[index].callback
    },
    useEffect(effect, deps) {
      const index = cursor++
      if (!same(slots[index]?.deps, deps)) {
        const previous = slots[index]
        slots[index] = { deps, cleanup: previous?.cleanup }
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect() })
      }
    },
  }
  return {
    react,
    render(component, attach = () => {}) {
      let tree, attempts = 0
      do {
        dirty = false; cursor = 0
        tree = component(); attach(tree)
        const ready = effects; effects = []
        ready.forEach(effect => effect())
        assert.ok(++attempts < 10, 'synthetic render settles')
      } while (dirty)
      return tree
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()) },
    get writes() { return writes },
  }
}

function load(path, react, mocks = {}, globals = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const jsx = (type, props) => ({ type, props, ref: props.ref })
  runInNewContext(compiled, {
    module, exports: module.exports, ...globals,
    require(name) {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
      if (name in mocks) return mocks[name]
      return require(name)
    },
  })
  return module.exports.default
}

function surface() {
  const listeners = new Map()
  return {
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback) },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback) },
    emit(type, event = {}) { for (const callback of listeners.get(type) || []) callback(event) },
    count() { return [...listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0) },
  }
}

function providerHarness(navigatorPatch = {}, installedMode = null) {
  const lifecycle = hooks(), media = new Map()
  const navigator = { userAgent: 'Mozilla Android', platform: 'Linux', maxTouchPoints: 1, ...navigatorPatch }
  const window = {
    ...surface(),
    matchMedia(query) {
      if (!media.has(query)) media.set(query, { ...surface(), matches: query === `(display-mode: ${installedMode})` })
      return media.get(query)
    },
  }
  const Provider = load('components/pwa/PwaInstallProvider.tsx', lifecycle.react, {}, { window, navigator })
  const render = () => lifecycle.render(() => Provider({ children: 'route content' }))
  render()
  return {
    window, navigator,
    get value() { return render().props.value },
    capture(event) { window.emit('beforeinstallprompt', event); return this.value },
    mode(name, matches) { const query = window.matchMedia(`(display-mode: ${name})`); query.matches = matches; query.emit('change') },
    unmount() { lifecycle.unmount() },
    get listenerCount() { return window.count() + [...media.values()].reduce((sum, query) => sum + query.count(), 0) },
    get writes() { return lifecycle.writes },
  }
}

function promptEvent({ choice = Promise.resolve({ outcome: 'accepted' }), prompt = () => Promise.resolve() } = {}) {
  let calls = 0, prevented = 0
  return {
    prompt() { calls++; return prompt() }, userChoice: choice,
    preventDefault() { prevented++ },
    get calls() { return calls }, get prevented() { return prevented },
  }
}

test('root provider retains a valid prompt before Today mounts and ignores unavailable/malformed events', t => {
  const app = providerHarness(); t.after(() => app.unmount())
  assert.equal(app.value.ready, true); assert.equal(app.value.installed, false); assert.equal(app.value.canPrompt, false)
  for (const event of [{}, { prompt() {} }, { prompt: true, userChoice: Promise.resolve({ outcome: 'accepted' }) }]) {
    app.capture({ ...event, preventDefault() { assert.fail('malformed events must not be captured') } })
    assert.equal(app.value.canPrompt, false)
  }
  const event = promptEvent(); app.capture(event)
  assert.equal(event.prevented, 1); assert.equal(event.calls, 0)
  assert.equal(app.value.canPrompt, true, 'captured event remains available across subsequent route renders')
  assert.equal(app.value.canPrompt, true)
})

test('native prompt starts synchronously once, consumes its event and does not equate acceptance with installation', async t => {
  const app = providerHarness(); t.after(() => app.unmount())
  const choice = pending(), event = promptEvent({ choice: choice.promise })
  app.capture(event)
  const click = app.value.install
  click(); click(); app.value.install()
  assert.equal(event.calls, 1, 'prompt runs during the user click and cannot run twice')
  assert.equal(app.value.busy, true); assert.equal(app.value.canPrompt, false)
  choice.resolve({ outcome: 'accepted' }); await tick()
  assert.equal(app.value.result, 'accepted'); assert.equal(app.value.busy, false)
  assert.equal(app.value.installed, false, 'only a real installed signal hides the promotion')
  app.value.install(); assert.equal(event.calls, 1)
})

test('dismissal, rejected presentation/choice and synchronous throws settle to usable one-use fallback', async t => {
  for (const [expected, options] of [
    ['dismissed', () => ({ choice: Promise.resolve({ outcome: 'dismissed' }) })],
    ['error', () => ({ prompt: () => Promise.reject(new Error('presentation rejected')) })],
    ['error', () => ({ choice: Promise.reject(new Error('choice rejected')) })],
    ['error', () => ({ prompt() { throw new Error('presentation threw') }, choice: Promise.reject(new Error('choice also rejected')) })],
  ]) {
    const app = providerHarness(); t.after(() => app.unmount())
    const event = promptEvent(options()); app.capture(event); app.value.install(); await tick()
    assert.equal(app.value.result, expected); assert.equal(app.value.busy, false); assert.equal(app.value.canPrompt, false)
    assert.equal(app.value.installed, false)
    app.value.install(); assert.equal(event.calls, 1)
    const fresh = promptEvent(); app.capture(fresh)
    assert.equal(app.value.canPrompt, true); assert.equal(app.value.result, 'idle')
    app.value.install(); await tick(); assert.equal(fresh.calls, 1); assert.equal(app.value.result, 'accepted')
  }
})

test('a fresh deferred event survives an active prompt without allowing overlapping confirmations', async t => {
  const app = providerHarness(); t.after(() => app.unmount())
  const choice = pending(), first = promptEvent({ choice: choice.promise }), fresh = promptEvent()
  app.capture(first); app.value.install(); app.capture(fresh); app.value.install()
  assert.equal(first.calls, 1); assert.equal(fresh.calls, 0); assert.equal(app.value.busy, true)
  choice.resolve({ outcome: 'dismissed' }); await tick()
  assert.equal(app.value.canPrompt, true); assert.equal(app.value.busy, false)
  app.value.install(); await tick(); assert.equal(fresh.calls, 1)
})

test('standalone and applicable display modes hide only the current installed experience', t => {
  for (const mode of ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']) {
    const app = providerHarness({}, mode); t.after(() => app.unmount())
    assert.equal(app.value.installed, true)
    const event = promptEvent(); app.capture(event); assert.equal(event.prevented, 0); assert.equal(app.value.canPrompt, false)
    app.mode(mode, false); assert.equal(app.value.installed, false)
    app.mode(mode, true); assert.equal(app.value.installed, true)
  }
  const ios = providerHarness({ userAgent: 'iPhone', standalone: true }); t.after(() => ios.unmount())
  assert.equal(ios.value.installed, true); assert.equal(ios.value.device, 'ios')
  ios.navigator.standalone = false; ios.window.emit('pageshow'); assert.equal(ios.value.installed, false)
  const ipad = providerHarness({ userAgent: 'Mozilla Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }); t.after(() => ipad.unmount())
  assert.equal(ipad.value.device, 'ios'); assert.equal(ipad.value.installed, false)
})

test('appinstalled and unmount invalidate stale prompt results and clean up every listener', async () => {
  const app = providerHarness(), choice = pending(), event = promptEvent({ choice: choice.promise })
  app.capture(event); app.value.install(); app.window.emit('appinstalled')
  assert.equal(app.value.installed, true); assert.equal(app.value.busy, false); assert.equal(app.value.canPrompt, false)
  choice.resolve({ outcome: 'accepted' }); await tick()
  assert.equal(app.value.result, 'idle', 'outdated acceptance cannot overwrite installed transition')
  assert.ok(app.listenerCount > 0); app.unmount(); assert.equal(app.listenerCount, 0)
  const later = providerHarness(), laterChoice = pending(), laterEvent = promptEvent({ choice: laterChoice.promise })
  later.capture(laterEvent); const staleClick = later.value.install; staleClick(); later.unmount()
  const writes = later.writes
  laterChoice.resolve({ outcome: 'dismissed' }); await tick(); staleClick()
  assert.equal(later.writes, writes, 'unmounted provider receives no async state updates')
  assert.equal(later.listenerCount, 0); assert.equal(laterEvent.calls, 1)
})

function dialogHarness(patch = {}) {
  const lifecycle = hooks(), state = { ready: true, installed: false, device: 'android', canPrompt: false, busy: false, result: 'idle', ...patch }
  let installs = 0, focusEntry = 0, focusReturns = 0, stepsFocus = 0, dialogNode, tree
  const native = { open: false, showModal() { this.open = true }, close() { if (!this.open) return; this.open = false; dialogNode.props.onClose() } }
  const Button = load('components/pwa/TodayInstallButton.tsx', lifecycle.react, {
    './PwaInstallProvider': { usePwaInstall: () => ({ ...state, install() { installs++ } }) },
    './TodayInstallButton.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  })
  function render() {
    tree = lifecycle.render(() => Button(), current => {
      dialogNode = nodes(current, node => node.type === 'dialog')[0]
      dialogNode.ref.current = native
      const trigger = nodes(current, node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog')[0]
      if (trigger) trigger.ref.current = { focus() { focusReturns++ } }
      nodes(dialogNode, node => node.type === 'h2')[0].ref.current = { focus() { focusEntry++ } }
      const instructions = nodes(dialogNode, node => node.type === 'div' && node.props.className === 'instructions')[0]
      if (instructions) instructions.ref.current = { focus() { stepsFocus++ } }
    })
    return tree
  }
  render()
  return {
    state, render, native,
    open() { this.trigger.props.onClick(); return render() },
    get trigger() { return nodes(render(), node => node.type === 'button' && node.props['aria-haspopup'] === 'dialog')[0] },
    get dialog() { render(); return dialogNode },
    get primary() { return nodes(this.dialog, node => node.type === 'footer')[0].props.children },
    get installs() { return installs }, get focusEntry() { return focusEntry }, get focusReturns() { return focusReturns },
    get stepsFocus() { return stepsFocus },
    unmount() { lifecycle.unmount() },
  }
}

test('Today explainer opens a labeled native dialog, focuses its heading and closes by Close/Escape with focus return and reopening', t => {
  const app = dialogHarness(); t.after(() => app.unmount())
  assert.equal(text(app.trigger).trim(), 'Add Anastasis to your Home Screen')
  assert.equal(app.trigger.props.type, 'button'); assert.equal(app.trigger.props['aria-controls'], app.dialog.props.id)
  app.open(); assert.equal(app.native.open, true); assert.equal(app.focusEntry, 1)
  const title = nodes(app.dialog, node => node.type === 'h2')[0]
  assert.equal(app.dialog.props['aria-labelledby'], title.props.id); assert.equal(title.props.tabIndex, -1)
  assert.ok(nodes(app.dialog, node => node.props?.id === app.dialog.props['aria-describedby']).length)
  assert.match(text(app.dialog), /icon that opens it like an app/); assert.match(text(app.dialog), /No app-store download needed/)
  nodes(app.dialog, node => node.type === 'button' && node.props['aria-label'] === 'Close installation instructions')[0].props.onClick()
  assert.equal(app.native.open, false); assert.equal(app.focusReturns, 1)
  app.open(); let prevented = false
  app.dialog.props.onCancel({ preventDefault() { prevented = true } })
  assert.equal(prevented, true); assert.equal(app.native.open, false); assert.equal(app.focusReturns, 2)
  app.open(); assert.equal(app.native.open, true); assert.equal(app.focusEntry, 3)
})

test('iPhone/iPad bottom action reveals manual Share steps, supports Done/reopen and never invokes a supplied native prompt', t => {
  const app = dialogHarness({ device: 'ios', canPrompt: true }); t.after(() => app.unmount())
  app.open(); assert.equal(text(app.primary), 'Show Home Screen steps')
  app.primary.props.onClick(); app.render()
  assert.equal(app.stepsFocus, 1)
  const instructions = text(app.dialog)
  assert.match(instructions, /Share/); assert.match(instructions, /Add to Home Screen/); assert.match(instructions, /Open as Web App/)
  assert.match(instructions, /Tap Add/); assert.match(instructions, /If Add to Home Screen is missing, try opening this website in Safari/)
  assert.equal(app.installs, 0); assert.equal(text(app.primary), 'Done')
  app.primary.props.onClick(); assert.equal(app.native.open, false)
  app.open(); assert.equal(text(app.primary), 'Show Home Screen steps')
})

test('unsupported phone and desktop browsers provide actionable menu guidance from the bottom control', t => {
  for (const device of ['android', 'mobile', 'desktop']) {
    const app = dialogHarness({ device }); t.after(() => app.unmount())
    app.open(); assert.equal(text(app.primary), 'Show Home Screen steps')
    app.primary.props.onClick(); app.render()
    const instructions = text(app.dialog)
    assert.match(instructions, /browser’s menu/)
    assert.match(instructions, device === 'desktop' ? /Install Anastasis/ : /Add to Home Screen/)
    if (device === 'desktop') {
      assert.match(instructions, /Installing here adds Anastasis to this computer/)
      assert.match(instructions, /open this website in a browser on that phone/)
    } else assert.match(instructions, /three dots/)
    assert.equal(app.installs, 0); assert.equal(text(app.primary), 'Done')
  }
})

test('native bottom action, busy state, result fallback and installed transition remain usable', t => {
  const app = dialogHarness({ canPrompt: true }); t.after(() => app.unmount())
  app.open(); assert.equal(text(app.primary), 'Add to Home Screen'); app.primary.props.onClick(); assert.equal(app.installs, 1)
  app.state.canPrompt = false; app.state.busy = true
  assert.equal(app.primary.props.disabled, true); assert.equal(text(app.primary), 'Waiting for browser…')
  for (const result of ['accepted', 'dismissed', 'error']) {
    app.state.busy = false; app.state.result = result; app.render()
    assert.equal(app.primary.props.disabled, false); assert.equal(text(app.primary), 'Done')
    assert.match(text(app.dialog), /How to add Anastasis/)
    const status = nodes(app.dialog, node => node.props?.role === 'status')[0]
    assert.equal(status.props['aria-live'], 'polite')
    assert.match(text(status), result === 'accepted' ? /When installation finishes/ : result === 'dismissed' ? /dismissed/ : /could not open or finish/)
  }
  app.state.installed = true; app.render()
  assert.equal(app.trigger, undefined); assert.equal(app.native.open, false)
  const desktop = dialogHarness({ device: 'desktop', canPrompt: true }); t.after(() => desktop.unmount())
  desktop.open(); assert.equal(text(desktop.primary), 'Install on this computer')
  desktop.unmount(); assert.equal(desktop.native.open, false)
  const waiting = dialogHarness({ ready: false }); t.after(() => waiting.unmount()); assert.equal(waiting.trigger, undefined)
})
