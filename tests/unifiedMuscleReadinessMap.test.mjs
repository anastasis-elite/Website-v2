import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'

const require = createRequire(import.meta.url)
const nodes = (node, match) => Array.isArray(node) ? node.flatMap(child => nodes(child, match))
  : !node || typeof node !== 'object' ? [] : [...(match(node) ? [node] : []), ...nodes(node.props?.children, match)]
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : ''

function harness(extra = {}) {
  const states = [], modules = new Map(), choices = []
  let cursor = 0, props = { readiness: [], bilateralSelection: true, ...extra }
  const react = { ...React, useMemo: callback => callback(), useState(initial) {
    const index = cursor++
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
    return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
  } }
  props.onChooseExercises = id => { choices.push(id); props = { ...props, selectedMuscleId: id } }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    if (extname(path) === '.json') return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date, Map, Set,
      require(name) {
        if (name === 'react') return react
        if (name === 'next/image') return { __esModule: true, default: 'img' }
        if (name === 'server-only') return {}
        const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        return target ? load(extname(target) ? target : target + '.ts') : require(name)
      },
    }, { filename: path })
    return module.exports
  }
  const Component = load('components/workout-dashboard/MuscleReadinessMap.tsx').default
  const render = () => { cursor = 0; return Component(props) }
  const region = id => nodes(render(), node => node.props?.['data-muscle-id'] === id)[0]
  const detail = () => nodes(render(), node => node.props?.className === 'workout-muscle-detail')[0]
  const choose = () => nodes(render(), node => node.type === 'button' && text(node).startsWith('Choose exercises for'))[0]
  return { render, region, detail, choose, choices, setProps(next) { props = { ...props, ...next } },
    view(label) { nodes(render(), node => node.type === 'button' && text(node) === label)[0].props.onClick() } }
}

const readiness = [
  { muscleId: 'left_pectoralis_major', state: 'ready', readinessScore: 94, lastTrainedAt: '2026-10-28T12:00:00Z',
    reasons: ['Left first reason.', 'Left second reason.'], exercisesToday: ['Left one', 'Left two', 'Left three'] },
  { muscleId: 'right_pectoralis_major', state: 'rest', readinessScore: 0, lastTrainedAt: '2026-11-01T12:00:00Z',
    reasons: ['Right first reason.', 'Right second reason.'], exercisesToday: ['Right one'] },
]

test('per-side inspection preserves zero scores, dates, every reason and today exercise without selecting equipment', () => {
  const view = harness({ readiness })
  view.region('left_pectoralis_major').props.onClick()
  let detail = text(view.detail())
  assert.match(detail, /Left pectoralis major/)
  assert.match(detail, /94% readiness estimate/)
  assert.match(detail, /Last trained:/)
  for (const value of ['Left first reason.', 'Left second reason.', 'Left one, Left two, Left three']) assert.ok(detail.includes(value))
  assert.doesNotMatch(detail, /Right first|0% readiness/)
  assert.equal(view.choices.length, 0)
  let prevented = 0
  view.region('right_pectoralis_major').props.onKeyDown({ key: 'Enter', preventDefault() { prevented++ } })
  detail = text(view.detail())
  assert.match(detail, /Right pectoralis major/)
  assert.match(detail, /0% readiness estimate/)
  assert.match(detail, /Recovery still accumulating/)
  assert.match(detail, /Right first reason.*Right second reason/)
  assert.doesNotMatch(detail, /Left first|94% readiness/)
  assert.equal(prevented, 1)
  assert.equal(view.choices.length, 0)
  assert.equal(view.detail().props['aria-live'], 'polite')
})

test('the separate native exercise button selects both regions while per-side inspection remains distinct', () => {
  const view = harness({ readiness })
  assert.equal(view.choose(), undefined)
  view.region('right_pectoralis_major').props.onClick()
  assert.match(text(view.choose()), /Choose exercises for\s+pectoralis major\s+· both sides/)
  assert.equal(view.choose().props.type, 'button')
  view.choose().props.onClick()
  assert.deepEqual(view.choices, ['right_pectoralis_major'])
  for (const id of ['left_pectoralis_major', 'right_pectoralis_major']) {
    assert.equal(view.region(id).props['data-exercise-selected'], 'true')
    assert.match(view.region(id).props.className, /is-selected/)
  }
  assert.equal(view.region('left_pectoralis_major').props['aria-pressed'], false)
  assert.equal(view.region('right_pectoralis_major').props['aria-pressed'], true)
  view.region('left_pectoralis_major').props.onClick()
  assert.match(text(view.detail()), /94% readiness estimate/)
  assert.equal(view.choices.length, 1, 'Inspecting the other side cannot reopen equipment selection.')
})

test('an active exercise disables new exercise choice while keyboard inspection, Back view and recorded reasons stay reachable', () => {
  const view = harness({ readiness, selectedMuscleId: 'left_pectoralis_major', exerciseSelectionDisabled: true })
  let prevented = 0
  const right = view.region('right_pectoralis_major')
  assert.equal(right.props.role, 'button')
  assert.equal(right.props.tabIndex, 0)
  right.props.onKeyDown({ key: ' ', preventDefault() { prevented++ } })
  assert.equal(prevented, 1)
  assert.equal(view.choose().props.disabled, true)
  assert.match(text(view.detail()), /Right pectoralis major.*0% readiness estimate/)
  assert.match(text(view.render()), /Your active exercise stays open/)
  assert.equal(view.choices.length, 0)
  view.view('Back')
  assert.ok(view.region('right_posterior_deltoid'))
  view.region('right_posterior_deltoid').props.onClick()
  assert.match(text(view.detail()), /Right posterior deltoid.*Not enough data/)
  assert.equal(view.choose().props.disabled, true)
  view.setProps({ exerciseSelectionDisabled: false })
  assert.equal(view.choose().props.disabled, false)
  view.choose().props.onClick()
  assert.deepEqual(view.choices, ['right_posterior_deltoid'])
})

test('missing readiness rows name the inspected side with an honest unknown state and no invented measurements', () => {
  const view = harness()
  view.region('left_biceps').props.onFocus()
  assert.match(text(view.detail()), /Left biceps.*Not enough data/)
  view.region('left_biceps').props.onBlur()
  view.region('left_biceps').props.onClick()
  const detail = text(view.detail())
  assert.match(detail, /Left biceps.*Not enough data/)
  assert.doesNotMatch(detail, /% readiness|Last trained:|Today:/)
  assert.equal(view.choices.length, 0)
  view.region('left_biceps').props.onClick()
  assert.equal(view.choose(), undefined)
  assert.match(text(view.detail()), /Select a muscle/)
})
