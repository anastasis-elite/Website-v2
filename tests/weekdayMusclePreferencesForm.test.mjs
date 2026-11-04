import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const treeChildren = node => typeof node?.type === 'function' ? node.type(node.props) : node?.props?.children
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(treeChildren(node) ?? '')
const nodes = (tree, match) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, match))
  : [...(match(tree) ? [tree] : []), ...nodes(treeChildren(tree), match)]
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const json = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload })
const plain = value => JSON.parse(JSON.stringify(value))
const unset = () => ({ revision: 0, status: 'unset', today: '2026-11-03', timezone: 'America/Chicago', nextEffectiveDate: '2026-11-09', current: null, pending: null, lastOperationId: null })
const days = () => Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => [day, []]))
const saved = (operationId, choice, effectiveDate = '2026-11-09') => ({ choice, effectiveDate, savedAt: '2026-11-03T13:00:00Z', operationId })
const planSummary = (entry, overrides = {}) => ({ status: 'available', mode: entry?.choice.mode ?? 'program_default',
  ...(entry ? { effectiveDate: entry.effectiveDate } : {}), preferredDays: [], workDays: ['Monday', 'Thursday', 'Saturday'],
  fixedExtraDays: [], unspecifiedDays: ['Sunday'], ...overrides })
const receipt = call => ({ success: true, replayed: false, view: { ...unset(), revision: call.body.expectedRevision + 1, status: 'pending',
  lastOperationId: call.body.operationId, pending: saved(call.body.operationId, call.body.choice) } })

// Every authentication result and request is synthetic. This harness does not
// instantiate a browser, use storage, or make any member/provider/network call.
function harness(overrides = {}, { authFailure = false, pendingAuth = false } = {}) {
  const state = [], refs = [], effects = [], calls = [], modules = new Map(), authChecks = []
  let stateIndex = 0, refIndex = 0, effectIndex = 0, dirty = false, queue = [], tree, listener, unsubscribed = 0, refreshes = 0
  let props = { clientId: 'synthetic-client', userId: 'synthetic-user', initialView: unset(), sourceStatus: { status: 'available' }, ...overrides }
  let send = async call => json(receipt(call))
  const react = {
    useId: () => 'weekday-preferences',
    useState(initial) { const index = stateIndex++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], value => { const next = typeof value === 'function' ? value(state[index]) : value; if (!Object.is(next, state[index])) { state[index] = next; dirty = true } }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    useEffect(callback, dependencies) { const index = effectIndex++, prior = effects[index]
      if (!prior || dependencies.some((value, i) => !Object.is(value, prior.dependencies[i]))) queue.push(() => {
        prior?.cleanup?.(); effects[index] = { dependencies, cleanup: callback() }
      })
    },
  }
  function load(file) {
    file = resolve(file)
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }; modules.set(file, module)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date, Intl, Object, Array, Set, Map, JSON, Number, Error, AbortController,
      crypto: { randomUUID }, fetch(url, options) { const call = { url, options, body: JSON.parse(options.body) }; calls.push(call); return send(call) },
      require(name) {
        if (name === 'react') return react
        if (name === 'next/navigation') return { useRouter: () => ({ refresh() { refreshes++ } }) }
        if (name === '@/lib/supabase/client') return { createClient: () => ({ auth: {
          onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { unsubscribed++ } } } } },
          getUser() { const pending = deferred(); authChecks.push(pending)
            if (!pendingAuth) pending.resolve({ data: { user: { id: props.userId } }, error: authFailure ? { message: 'synthetic unavailable' } : null })
            return pending.promise },
        } }) }
        if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
        if (name.startsWith('@/') || name.startsWith('.')) {
          let target = name.startsWith('@/') ? resolve(name.slice(2)) : resolve(dirname(file), name)
          if (!existsSync(target)) target += existsSync(target + '.ts') ? '.ts' : '.tsx'
          return load(target)
        }
        return require(name)
      },
    }, { filename: file })
    return module.exports
  }
  const Component = load('components/workout-dashboard/WeekdayMusclePreferencesForm.tsx').default
  function render() {
    let loops = 0
    do {
      if (++loops > 10) throw new Error('Synthetic render did not settle')
      dirty = false; stateIndex = refIndex = effectIndex = 0; queue = []
      tree = Component(props)
      const current = queue; queue = []; current.forEach(run => run())
    } while (dirty)
    return tree
  }
  return {
    render, calls, authChecks,
    get refreshes() { return refreshes }, get unsubscribed() { return unsubscribed }, get props() { return props },
    async ready() { render(); await new Promise(setImmediate); return render() },
    async settle() { await new Promise(setImmediate); return render() },
    setSend(callback) { send = callback },
    setProps(next) { props = { ...props, ...next }; return render() },
    radio(mode) { const node = nodes(render(), item => item.type === 'input' && item.props.type === 'radio' && item.props.value === mode)[0]; node.props.onChange(); return render() },
    check(day, label, checked = true) { const node = nodes(render(), item => item.type === 'input' && item.props['aria-label'] === `${day}: ${label}`)[0];
      assert.ok(node, `${day}: ${label} exists`); node.props.onChange({ target: { checked } }); return render() },
    submit() { const form = nodes(render(), item => item.type === 'form')[0]; assert.ok(form); return form.props.onSubmit({ preventDefault() {} }) },
    button(label) { return nodes(render(), item => item.type === 'button' && text(item) === label)[0] },
    auth(id) { listener('SIGNED_OUT', id ? { user: { id } } : null); return render() },
    unmount() { effects.forEach(effect => effect?.cleanup?.()) },
  }
}

test('unset, pending and explicitly reset state remain distinct with exact next-week dates and accessible native controls', async () => {
  const view = harness(); await view.ready()
  assert.match(text(view.render()), /No weekday preference has been saved/)
  assert.match(text(view.render()), /No upcoming change is saved/)
  assert.match(text(view.render()), /Monday, November 9, 2026 \(2026-11-09\)/)
  assert.match(text(view.render()), /Timing uses your saved timezone:\s+America\/Chicago/)
  assert.equal(nodes(view.render(), node => node.type === 'form').length, 1)
  assert.ok(nodes(view.render(), node => node.type === 'fieldset').every(node => nodes(node, item => item.type === 'legend').length > 0))
  view.radio('custom')
  assert.equal(nodes(view.render(), node => node.type === 'fieldset').length, 8)
  assert.match(text(view.render()), /This selection has not been saved/)
  assert.equal(view.button('Save weekday preferences for next week').props.disabled, true)
  const resetEntry = saved('00000000-0000-4000-8000-000000000001', { mode: 'program_default' })
  view.setProps({ initialView: { ...unset(), revision: 1, status: 'pending', pending: resetEntry, lastOperationId: resetEntry.operationId } })
  assert.match(text(view.render()), /Program default, explicitly saved/)
  assert.doesNotMatch(text(view.render()), /No weekday preference has been saved/)
  assert.equal(view.button('Save program default for next week').props.disabled, false)
})

test('custom weekday checkbox combinations preserve chest plus biceps and separate prescribed core intent in the exact fenced request', async () => {
  const view = harness(); await view.ready(); view.radio('custom')
  view.check('Monday', 'Lats / back'); view.check('Tuesday', 'Chest'); view.check('Tuesday', 'Biceps'); view.check('Wednesday', 'Core')
  view.check('Thursday', 'Front lower legs / shins, feet & ankles'); view.check('Friday', 'Back lower legs / calves'); view.check('Friday', 'Glutes')
  await view.submit()
  assert.equal(view.calls.length, 1)
  const call = view.calls[0]
  assert.equal(call.url, '/api/workout/weekday-preferences'); assert.equal(call.options.method, 'POST')
  assert.equal(call.options.credentials, 'same-origin'); assert.equal(call.options.cache, 'no-store')
  assert.deepEqual(Object.keys(call.body).sort(), ['choice', 'expectedClientId', 'expectedDate', 'expectedRevision', 'expectedUserId', 'operationId'].sort())
  assert.equal(call.body.expectedClientId, 'synthetic-client'); assert.equal(call.body.expectedUserId, 'synthetic-user')
  assert.equal(call.body.expectedDate, '2026-11-03'); assert.equal(call.body.expectedRevision, 0)
  assert.deepEqual(call.body.choice.days.Tuesday, ['chest', 'biceps']); assert.deepEqual(call.body.choice.days.Wednesday, ['core'])
  assert.deepEqual(call.body.choice.days.Friday, ['glutes', 'calves'])
  assert.match(text(view.render()), /Saved\. Your weekday preferences start Monday, November 9, 2026/)
  assert.match(text(view.render()), /Your current week is unchanged/)
  assert.equal(view.props.initialView.status, 'unset', 'provided saved state is not mutated')
})

test('unsupported distributions retain prior saved state and draft while program-default reset remains available', async () => {
  const old = saved('00000000-0000-4000-8000-000000000001', { mode: 'custom', days: { ...days(), Tuesday: ['chest', 'biceps'] } }, '2026-11-02')
  const view = harness({ initialView: { ...unset(), status: 'saved', revision: 1, current: old, lastOperationId: old.operationId } })
  await view.ready(); view.check('Wednesday', 'Core')
  view.setSend(async () => json({ error: 'This distribution is unsupported.', code: 'UNSUPPORTED_DISTRIBUTION', issues: ['No prescribed core work is available.'] }, 422))
  await view.submit()
  assert.match(text(view.render()), /No prescribed core work is available/)
  assert.equal(nodes(view.render(), node => node.props?.['aria-label'] === 'Wednesday: Core')[0].props.checked, true)
  assert.equal(view.props.initialView.current, old)
  const unavailable = harness({ sourceStatus: { status: 'unsupported', message: 'Exercise muscle identities are unavailable.', issues: ['No supported mapping.'] } })
  await unavailable.ready(); unavailable.radio('custom'); unavailable.check('Tuesday', 'Chest')
  assert.equal(unavailable.button('Save weekday preferences for next week').props.disabled, true)
  await unavailable.submit(); assert.equal(unavailable.calls.length, 0)
  unavailable.radio('program_default'); assert.equal(unavailable.button('Save program default for next week').props.disabled, false)
  await unavailable.submit(); assert.equal(unavailable.calls.length, 1); assert.deepEqual(unavailable.calls[0].body.choice, { mode: 'program_default' })
})

test('retained prescribed items explain fixed non-strength and unclear circuit placement without changing original days or inferring doses', async () => {
  const retainedEntries = [
    { day: 'Monday', exercise: 'Walk / Yoga', reason: 'This non-strength entry stays on its original day.', requiresOwnerDecision: false },
    { day: 'Wednesday', exercise: 'Arm Circuit', reason: 'The prescribed circuit does not identify its individual exercises or intended muscle groups.', requiresOwnerDecision: true },
    { day: 'Friday', exercise: 'Core Finisher', reason: 'The prescribed finisher does not identify its individual exercises or dose structure.', requiresOwnerDecision: true },
  ]
  const original = plain(retainedEntries)
  for (const status of ['available', 'unsupported']) {
    const view = harness({ sourceStatus: { status, retainedEntries,
      ...(status === 'unsupported' ? { message: 'This requested arrangement conflicts with an unclear prescribed entry.' } : {}) } })
    await view.ready()
    const sections = nodes(view.render(), node => node.type === 'section' && node.props['aria-labelledby'] === 'weekday-preferences-retained')
    assert.equal(sections.length, 1, `retained items are visible for ${status} source`)
    const section = sections[0], heading = nodes(section, node => node.type === 'h3')[0]
    assert.equal(heading.props.id, section.props['aria-labelledby'])
    assert.equal(text(heading), 'Prescribed items staying in place')
    const rows = nodes(section, node => node.type === 'li').map(node => text(node).replace(/\s+/g, ' ').replace(/\s+([:.])/g, '$1').trim())
    assert.deepEqual(rows, [
      'Monday: Walk / Yoga. This non-strength entry stays on its original day.',
      'Wednesday: Arm Circuit. The prescribed circuit does not identify its individual exercises or intended muscle groups.',
      'Friday: Core Finisher. The prescribed finisher does not identify its individual exercises or dose structure.',
    ])
    const explanation = text(section).replace(/\s+/g, ' ')
    assert.match(explanation, /kept unchanged on their existing weekday, with their existing dose/)
    assert.match(explanation, /does not need to be defined to keep it in place/)
    assert.doesNotMatch(explanation, /needs to be confirmed|before regrouping|before a conflicting custom arrangement/)
    assert.match(text(view.render()), /preferred focus areas, not an exclusive list of workdays/)
    assert.match(text(view.render()), /Unchecked days and muscle groups can still contain prescribed work/)
    assert.doesNotMatch(explanation, /\b(?:rest day|rest workout|3\s*[×x]\s*10|sets? of|kg|lb|repetitions?|minutes?)\b/i)
    assert.deepEqual(retainedEntries, original, 'rendering preserves the supplied recorded identities and context')
    assert.equal(view.calls.length, 0)
  }
})

test('current and upcoming preferred-focus summaries disclose additional prescribed workdays and unspecified Sunday without inventing rest', async () => {
  const current = saved('00000000-0000-4000-8000-000000000001', { mode: 'custom', days: { ...days(), Monday: ['lats'] } }, '2026-11-02')
  const pending = saved('00000000-0000-4000-8000-000000000002', { mode: 'custom', days: { ...days(), Tuesday: ['chest', 'biceps'], Wednesday: ['core'] } })
  const initialView = { ...unset(), status: 'pending', revision: 2, current, pending, lastOperationId: pending.operationId }
  const initialFocusPlans = {
    current: planSummary(current, { preferredDays: [{ day: 'Monday', groups: ['Lats / back'] }],
      fixedExtraDays: [{ day: 'Thursday', exercises: ['Arm Circuit'] }, { day: 'Saturday', exercises: ['Walk / Yoga'] }] }),
    pending: planSummary(pending, { preferredDays: [{ day: 'Tuesday', groups: ['Chest', 'Biceps'] }, { day: 'Wednesday', groups: ['Core'] }],
      workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      fixedExtraDays: [{ day: 'Monday', exercises: ['Gentle Walk'] }, { day: 'Thursday', exercises: ['Arm Circuit'] },
        { day: 'Friday', exercises: ['Core Finisher'] }, { day: 'Saturday', exercises: ['Walk / Yoga'] }] }),
  }
  const view = harness({ initialView, initialFocusPlans }); await view.ready()
  const section = suffix => nodes(view.render(), node => node.type === 'section' && node.props['aria-labelledby'] === `weekday-preferences-${suffix}`)[0]
  const normalized = node => text(node).replace(/\s+/g, ' ').replace(/\s+([:.])/g, '$1')
  const currentText = normalized(section('current')), pendingText = normalized(section('pending'))
  assert.match(currentText, /Monday, November 2, 2026 \(2026-11-02\)/)
  assert.match(pendingText, /Monday, November 9, 2026 \(2026-11-09\)/)
  assert.match(pendingText, /Preferred focus days Tuesday: Chest, Biceps Wednesday: Core/)
  assert.match(pendingText, /Prescribed workdays: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday/)
  assert.match(pendingText, /Additional prescribed workdays Monday: Gentle Walk Thursday: Arm Circuit Friday: Core Finisher Saturday: Walk \/ Yoga/)
  assert.match(pendingText, /not an exclusive workday schedule/)
  assert.match(currentText, /Unspecified in saved source: Sunday/); assert.match(pendingText, /Unspecified in saved source: Sunday/)
  assert.doesNotMatch(currentText + pendingText, /\brest(?: day)?\b|\b3\s*[×x]\s*10\b|needs to be confirmed|before regrouping/i)
  assert.equal(nodes(view.render(), node => node.props?.['aria-label'] === 'Sunday: Chest')[0].props.checked, false)
  assert.equal(view.calls.length, 0)
  assert.deepEqual(initialFocusPlans.pending.preferredDays[0].groups, ['Chest', 'Biceps'])
  const reset = saved('00000000-0000-4000-8000-000000000003', { mode: 'program_default' }, '2026-11-02')
  const defaults = harness({ initialView: { ...unset(), status: 'saved', revision: 3, current: reset, lastOperationId: reset.operationId },
    initialFocusPlans: { current: planSummary(reset), pending: null } }); await defaults.ready()
  assert.match(text(defaults.render()), /Program default, explicitly saved/)
  assert.match(text(defaults.render()), /Original program arrangement/)
  assert.match(text(defaults.render()), /No upcoming change is saved/)
})

test('only confirmed saves adopt server focus summaries and missing or malformed summaries stay unavailable without undoing a verified receipt', async () => {
  const view = harness({ initialFocusPlans: { current: planSummary(null), pending: null } }); await view.ready()
  view.radio('custom'); view.check('Tuesday', 'Chest'); view.check('Tuesday', 'Biceps')
  const deferredSave = deferred(); view.setSend(() => deferredSave.promise); const saving = view.submit()
  assert.doesNotMatch(text(view.render()), /Additional prescribed workdays/)
  const payload = receipt(view.calls[0])
  payload.focusPlans = { current: planSummary(null), pending: planSummary(payload.view.pending, {
    preferredDays: [{ day: 'Tuesday', groups: ['Chest', 'Biceps'] }], workDays: ['Tuesday', 'Thursday', 'Saturday'],
    fixedExtraDays: [{ day: 'Thursday', exercises: ['Arm Circuit'] }, { day: 'Saturday', exercises: ['Walk / Yoga'] }],
  }) }
  deferredSave.resolve(json(payload)); await saving
  const confirmed = text(view.render()).replace(/\s+/g, ' ').replace(/\s+([:.])/g, '$1')
  assert.match(confirmed, /Saved\. Your weekday preferences start Monday, November 9, 2026/)
  assert.match(confirmed, /Additional prescribed workdays Thursday: Arm Circuit Saturday: Walk \/ Yoga/)
  assert.match(confirmed, /Prescribed workdays: Tuesday, Thursday, Saturday/)
  for (const invalid of [undefined, { current: planSummary(null), pending: { status: 'available' } },
    { current: planSummary(null), pending: planSummary(payload.view.pending, { effectiveDate: '2026-11-16' }) }]) {
    const fallback = harness(); await fallback.ready(); fallback.radio('custom'); fallback.check('Tuesday', 'Chest')
    fallback.setSend(async call => json({ ...receipt(call), focusPlans: invalid })); await fallback.submit()
    const upcoming = nodes(fallback.render(), node => node.type === 'section' && node.props['aria-labelledby'] === 'weekday-preferences-pending')[0]
    assert.match(text(upcoming), /workday summary is unavailable/)
    assert.doesNotMatch(text(upcoming), /Additional prescribed workdays|Prescribed workdays:/)
    assert.match(text(fallback.render()), /Saved\. Your weekday preferences start/)
    assert.equal(fallback.button('Retry same save'), undefined)
  }
})

test('pending saves reject duplicate clicks and lock edits; failed or uncertain retries keep the identical UUID and payload', async () => {
  const view = harness(); await view.ready(); view.radio('custom'); view.check('Tuesday', 'Chest')
  const pending = deferred(); view.setSend(() => pending.promise)
  const first = view.submit(); const duplicate = view.submit()
  assert.equal(view.calls.length, 1)
  assert.equal(nodes(view.render(), node => node.type === 'form')[0].props['aria-busy'], true)
  assert.ok(nodes(view.render(), node => node.type === 'fieldset').every(node => node.props.disabled))
  view.check('Tuesday', 'Biceps'); assert.equal(nodes(view.render(), node => node.props?.['aria-label'] === 'Tuesday: Biceps')[0].props.checked, false)
  pending.reject(new Error('Synthetic connection interruption')); await Promise.all([first, duplicate])
  assert.equal(view.button('Retry same save').props.disabled, false)
  assert.match(text(view.render()), /save is not yet confirmed/)
  view.radio('program_default'); assert.equal(view.button('Retry same save').props.disabled, false)
  view.setSend(async call => json(receipt(call)))
  await view.submit(); assert.equal(view.calls.length, 2)
  assert.deepEqual(view.calls[1].body, view.calls[0].body)
  assert.match(text(view.render()), /Saved\./)
  view.radio('program_default'); await view.submit()
  assert.notEqual(view.calls[2].body.operationId, view.calls[1].body.operationId)
  assert.equal(view.calls[2].body.expectedRevision, 1)
})

test('server unavailability and malformed success never claim a save; known conflicts block until explicit saved-state reload', async () => {
  for (const send of [async () => json({ error: 'Saved preference source is unavailable.' }, 503), async () => json({ success: true, view: unset() }),
    async call => { const payload = receipt(call); payload.view.pending.effectiveDate = 'invalid'; return json(payload) }]) {
    const view = harness(); await view.ready(); view.setSend(send); await view.submit()
    assert.ok(view.button('Retry same save')); assert.doesNotMatch(text(view.render()), /Saved\. Program default resumes/)
  }
  for (const code of ['STALE_PREFERENCES', 'DAY_CHANGED', 'ACCOUNT_CHANGED']) {
    const view = harness(); await view.ready(); view.setSend(async () => json({ error: 'Reload or reselect your saved preferences.', code }, 409)); await view.submit()
    assert.equal(view.button('Save program default for next week').props.disabled, true)
    await view.submit(); assert.equal(view.calls.length, 1)
    view.button('Reload saved preferences').props.onClick(); assert.equal(view.refreshes, 1)
    view.setProps({ initialView: { ...unset(), today: '2026-11-04' } })
    assert.equal(view.button('Save program default for next week').props.disabled, false)
  }
  const invalid = harness({ initialView: { ...unset(), status: 'invalid', revision: null } }); await invalid.ready()
  await invalid.submit(); assert.equal(invalid.calls.length, 0); assert.match(text(invalid.render()), /could not be read/)
})

test('sign-out or account switching aborts pending writes, hides prior preferences and ignores late successes before navigation', async () => {
  for (const account of [null, 'another-user']) {
    const view = harness(); await view.ready(); const pending = deferred(); view.setSend(() => pending.promise)
    const saving = view.submit(); view.auth(account)
    assert.equal(view.calls[0].options.signal.aborted, true)
    assert.equal(nodes(view.render(), node => node.type === 'form').length, 0)
    assert.match(text(view.render()), /Your account changed/)
    pending.resolve(json(receipt(view.calls[0]))); await saving
    assert.doesNotMatch(text(view.render()), /Program default resumes|Current preferences/)
    view.unmount(); assert.equal(view.unsubscribed, 1)
  }
})

test('prop day/account changes and unmount fence late responses; reopened form restores current versus pending choices', async () => {
  const view = harness(); await view.ready(); const pending = deferred(); view.setSend(() => pending.promise)
  const saving = view.submit()
  view.setProps({ clientId: 'new-client', userId: 'new-user', initialView: { ...unset(), today: '2026-11-04' } }); await view.settle()
  assert.equal(view.calls[0].options.signal.aborted, true)
  pending.resolve(json(receipt(view.calls[0]))); await saving
  assert.doesNotMatch(text(view.render()), /Saved\. Program default resumes/)
  view.setSend(async call => json(receipt(call))); await view.submit()
  assert.equal(view.calls[1].body.expectedClientId, 'new-client'); assert.equal(view.calls[1].body.expectedUserId, 'new-user')
  assert.equal(view.calls[1].body.expectedDate, '2026-11-04')
  const detached = harness(); await detached.ready(); const late = deferred(); detached.setSend(() => late.promise)
  const leaving = detached.submit(); detached.unmount(); assert.equal(detached.calls[0].options.signal.aborted, true)
  late.resolve(json(receipt(detached.calls[0]))); await leaving
  const current = saved('00000000-0000-4000-8000-000000000001', { mode: 'custom', days: { ...days(), Tuesday: ['chest', 'biceps'] } }, '2026-11-02')
  const upcoming = saved('00000000-0000-4000-8000-000000000002', { mode: 'custom', days: { ...days(), Wednesday: ['core'] } })
  const reopened = harness({ initialView: { ...unset(), status: 'pending', revision: 2, current, pending: upcoming, lastOperationId: upcoming.operationId } })
  await reopened.ready()
  assert.match(text(reopened.render()), /Chest, Biceps/); assert.match(text(reopened.render()), /Core/)
  assert.equal(nodes(reopened.render(), node => node.props?.['aria-label'] === 'Wednesday: Core')[0].props.checked, true)
  assert.equal(nodes(reopened.render(), node => node.props?.['aria-label'] === 'Tuesday: Chest')[0].props.checked, false)
})

test('account verification failure is disabled and retryable, and a stale verification cannot undo sign-out', async () => {
  const failed = harness({}, { authFailure: true }); await failed.ready()
  assert.equal(failed.button('Save program default for next week').props.disabled, true)
  assert.match(text(failed.render()), /account could not be verified/)
  await failed.submit(); assert.equal(failed.calls.length, 0)
  failed.button('Retry account check').props.onClick(); failed.render(); assert.equal(failed.authChecks.length, 2)
  const slow = harness({}, { pendingAuth: true }); slow.render(); slow.auth(null)
  slow.authChecks[0].resolve({ data: { user: { id: 'synthetic-user' } }, error: null }); await slow.settle()
  assert.match(text(slow.render()), /Your account changed/); assert.equal(nodes(slow.render(), node => node.type === 'form').length, 0)
})

test('successful same-operation replay retains its original effective date after midnight without creating another request', async () => {
  const view = harness(); await view.ready()
  view.setSend(async () => json({ error: 'Uncertain saved response.' }, 503)); await view.submit()
  view.setSend(async call => {
    const payload = receipt(call); payload.replayed = true; payload.view.today = '2026-11-09'
    payload.view.status = 'saved'; payload.view.current = payload.view.pending; payload.view.pending = null; payload.view.nextEffectiveDate = '2026-11-16'
    return json(payload)
  })
  await view.submit()
  assert.deepEqual(view.calls[1].body, view.calls[0].body)
  assert.match(text(view.render()), /These preferences took effect Monday, November 9, 2026/)
  assert.match(text(view.render()), /Changes saved today start\s+Monday, November 16, 2026/)
  assert.deepEqual(plain(view.props.initialView), unset())
})

const policy = await importTs('lib/membership/policy.ts')
const member = overrides => ({ client_id: 'canonical-client', auth_user_id: 'canonical-user', program: 'ignite', access: true,
  active: true, membership_expires_at: '2099-01-01T00:00:00Z', ...overrides })
function pageFixture({ auth, override = {}, contextStatus } = {}) {
  const reads = [], canonical = { supabase: { synthetic: true }, user: { id: 'canonical-user' }, client: member(override) }
  const context = contextStatus ?? { ok: true, ...canonical, view: unset(), focusPlans: { current: planSummary(null), pending: null }, sourceStatus: { status: 'available' } }
  const file = resolve('app/dashboard/workout/preferences/page.tsx'), module = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const mocks = {
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { notFound() { throw new Error('SYNTHETIC_NOT_FOUND') } },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: 'phone-frame' },
    '@/components/workout-dashboard/WeekdayMusclePreferencesForm': { __esModule: true, default: 'weekday-form' },
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: () => auth ?? Promise.resolve(canonical) },
    '@/lib/membership/policy': policy,
    '@/lib/entitlements': { normalizeProgramTier: value => value },
    '@/lib/program/saveWeekdayMusclePreferences': { readWeekdayMusclePreferenceContext: async input => { reads.push(input); return context } },
  }
  runInNewContext(code, { module, exports: module.exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name) }, { filename: file })
  return { page: module.exports.default, reads, canonical, context }
}

test('preferences page waits for authoritative authentication/capabilities and passes canonical saved state with the existing workout back link', async () => {
  const auth = deferred(), fixture = pageFixture({ auth: auth.promise }), pending = fixture.page()
  await new Promise(setImmediate); assert.equal(fixture.reads.length, 0)
  auth.resolve(fixture.canonical); const tree = await pending
  assert.equal(tree.props.backHref, '/dashboard/program/ignite/workout'); assert.equal(tree.props.backLabel, 'Workout')
  const [form] = nodes(tree, node => node.type === 'weekday-form')
  assert.equal(form.props.clientId, fixture.canonical.client.client_id); assert.equal(form.props.userId, fixture.canonical.user.id)
  assert.equal(form.props.initialView, fixture.context.view); assert.equal(form.props.sourceStatus, fixture.context.sourceStatus)
  assert.equal(form.props.initialFocusPlans, fixture.context.focusPlans)
  assert.equal(fixture.reads[0].supabase, fixture.canonical.supabase); assert.equal(fixture.reads[0].user, fixture.canonical.user)
  for (const override of [{ auth_user_id: 'another-user' }, { program: 'tracker' }, { program: 'free' }, { active: false }, { access: false }]) {
    const denied = pageFixture({ override }); await assert.rejects(denied.page(), /SYNTHETIC_NOT_FOUND/); assert.equal(denied.reads.length, 0)
  }
  const failed = pageFixture({ auth: Promise.reject(new Error('SYNTHETIC_AUTH_FAILURE')) })
  await assert.rejects(failed.page(), /SYNTHETIC_AUTH_FAILURE/); assert.equal(failed.reads.length, 0)
  const unavailable = pageFixture({ contextStatus: { ok: false, status: 503 } }), errorTree = await unavailable.page()
  assert.equal(nodes(errorTree, node => node.type === 'weekday-form').length, 0)
  assert.match(text(errorTree), /could not be loaded/)
  assert.equal(nodes(errorTree, node => node.type === 'a')[0].props.href, '/dashboard/workout/preferences')
})

test('weekday save endpoint is explicitly protected and mapped to generated coaching in middleware and canonical membership policy', () => {
  const path = '/api/workout/weekday-preferences'
  assert.equal(policy.isProtectedApiPath(path), true)
  assert.equal(policy.capabilityForPath(path, 'POST'), 'generatedCoaching')
  for (const program of ['ember', 'ignite', 'phoenix']) assert.equal(policy.membershipCan(member({ program }), policy.capabilityForPath(path, 'POST')), true)
  for (const program of ['free', 'tracker']) assert.equal(policy.membershipCan(member({ program }), policy.capabilityForPath(path, 'POST')), false)
  const file = resolve('middleware.ts'), module = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === '@/lib/membership/policy') return policy
    return {}
  } }, { filename: file })
  assert.ok(module.exports.config.matcher.includes(path), 'explicit Next middleware matcher covers this API')
})
