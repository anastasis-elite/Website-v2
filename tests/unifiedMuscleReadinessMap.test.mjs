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
  const states = [], modules = new Map(), choices = [], triggers = []
  let cursor = 0, props = { readiness: [], bilateralSelection: true, ...extra }
  const react = { ...React, useMemo: callback => callback(), useState(initial) {
    const index = cursor++
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
    return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next }]
  } }
  props.onChooseExercises = (id, trigger) => { choices.push(id); triggers.push(trigger); props = { ...props, selectedMuscleId: id } }
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
  return { render, region, detail, choose, choices, triggers, setProps(next) { props = { ...props, ...next } },
    view(label) { nodes(render(), node => node.type === 'button' && text(node) === label)[0].props.onClick() } }
}

const readiness = [
  { muscleId: 'left_pectoralis_major', state: 'ready', readinessScore: 94, lastTrainedAt: '2026-10-28T12:00:00Z',
    reasons: ['Left first reason.', 'Left second reason.'], exercisesToday: ['Left one', 'Left two', 'Left three'] },
  { muscleId: 'right_pectoralis_major', state: 'rest', readinessScore: 0, lastTrainedAt: '2026-11-01T12:00:00Z',
    reasons: ['Right first reason.', 'Right second reason.'], exercisesToday: ['Right one'] },
]

test('per-side focus inspection preserves zero scores, dates, every reason and today exercise without opening equipment', () => {
  const view = harness({ readiness })
  view.region('left_pectoralis_major').props.onFocus()
  let detail = text(view.detail())
  assert.match(detail, /Left pectoralis major/)
  assert.match(detail, /94% readiness estimate/)
  assert.match(detail, /Last trained:/)
  for (const value of ['Left first reason.', 'Left second reason.', 'Left one, Left two, Left three']) assert.ok(detail.includes(value))
  assert.doesNotMatch(detail, /Right first|0% readiness/)
  assert.equal(view.choices.length, 0)
  view.region('left_pectoralis_major').props.onBlur()
  view.region('right_pectoralis_major').props.onFocus()
  detail = text(view.detail())
  assert.match(detail, /Right pectoralis major/)
  assert.match(detail, /0% readiness estimate/)
  assert.match(detail, /Recovery still accumulating/)
  assert.match(detail, /Right first reason.*Right second reason/)
  assert.doesNotMatch(detail, /Left first|94% readiness/)
  assert.equal(view.choices.length, 0)
  assert.equal(view.detail().props['aria-live'], 'polite')
})

test('muscle activation immediately chooses the correct bilateral flow, including repeated and keyboard selections', () => {
  const view = harness({ readiness })
  assert.equal(view.choose(), undefined)
  const target = { focus() {} }
  view.region('right_pectoralis_major').props.onClick({ currentTarget: target })
  assert.equal(view.choose(), undefined, 'Direct activation does not add a duplicate choose button')
  assert.deepEqual(view.choices, ['right_pectoralis_major'])
  assert.equal(view.triggers[0], target)
  assert.equal(view.region('right_pectoralis_major').props['aria-haspopup'], 'dialog')
  for (const id of ['left_pectoralis_major', 'right_pectoralis_major']) {
    assert.equal(view.region(id).props['data-exercise-selected'], 'true')
    assert.match(view.region(id).props.className, /is-selected/)
  }
  assert.equal(view.region('left_pectoralis_major').props['aria-pressed'], false)
  assert.equal(view.region('right_pectoralis_major').props['aria-pressed'], true)
  view.region('left_pectoralis_major').props.onFocus()
  assert.match(text(view.detail()), /94% readiness estimate/)
  assert.equal(view.choices.length, 1, 'Inspecting the other side cannot reopen equipment selection.')
  let prevented = 0
  for (const key of ['Enter', ' ']) view.region('left_pectoralis_major').props.onKeyDown({ key, currentTarget: target, preventDefault() { prevented++ } })
  assert.deepEqual(view.choices, ['right_pectoralis_major', 'left_pectoralis_major', 'left_pectoralis_major'])
  assert.equal(prevented, 2)
  view.region('left_pectoralis_major').props.onKeyDown({ key: 'Enter', repeat: true, preventDefault() { prevented++ } })
  assert.equal(view.choices.length, 3, 'A held key cannot duplicate activation')
  view.region('left_pectoralis_major').props.onClick({ currentTarget: target })
  assert.equal(view.choices.at(-1), 'left_pectoralis_major', 'The selected muscle can directly reopen its existing popup')
  assert.equal(view.triggers.at(-1), target)
  assert.equal(view.choose(), undefined)
})

test('an active exercise disables new exercise choice while keyboard inspection, Back view and recorded reasons stay reachable', () => {
  const view = harness({ readiness, selectedMuscleId: 'left_pectoralis_major', exerciseSelectionDisabled: true })
  let prevented = 0
  const right = view.region('right_pectoralis_major')
  assert.equal(right.props.role, 'button')
  assert.equal(right.props.tabIndex, 0)
  assert.equal(right.props['aria-haspopup'], undefined)
  right.props.onKeyDown({ key: ' ', preventDefault() { prevented++ } })
  assert.equal(prevented, 1)
  assert.equal(view.choose(), undefined)
  assert.match(text(view.detail()), /Right pectoralis major.*0% readiness estimate/)
  assert.match(text(view.render()), /Your active exercise stays open/)
  assert.equal(view.choices.length, 0)
  view.view('Back')
  assert.ok(view.region('right_posterior_deltoid'))
  view.region('right_posterior_deltoid').props.onClick()
  assert.match(text(view.detail()), /Right posterior deltoid.*Not enough data/)
  assert.equal(view.choose(), undefined)
  view.setProps({ exerciseSelectionDisabled: false })
  assert.equal(view.region('right_posterior_deltoid').props['aria-haspopup'], 'dialog')
  const target = { focus() {} }
  view.region('right_posterior_deltoid').props.onKeyDown({ key: 'Enter', currentTarget: target, preventDefault() {} })
  assert.deepEqual(view.choices, ['right_posterior_deltoid'])
  assert.equal(view.triggers[0], target)
  assert.equal(view.choose(), undefined)
})

test('unknown readiness remains honest and repeated activation reopens the same selection rather than clearing it', () => {
  const view = harness()
  view.region('left_biceps').props.onFocus()
  assert.match(text(view.detail()), /Left biceps.*Not enough data/)
  view.region('left_biceps').props.onBlur()
  view.region('left_biceps').props.onClick()
  const detail = text(view.detail())
  assert.match(detail, /Left biceps.*Not enough data/)
  assert.doesNotMatch(detail, /% readiness|Last trained:|Today:/)
  assert.deepEqual(view.choices, ['left_biceps'])
  view.region('left_biceps').props.onClick()
  assert.deepEqual(view.choices, ['left_biceps', 'left_biceps'])
  assert.equal(view.choose(), undefined)
  assert.match(text(view.detail()), /Left biceps/)
})

test('the responsive legend is a direct sibling above the complete Front and Back map, outside the artwork', () => {
  const view = harness()
  for (const side of ['Front', 'Back']) {
    view.view(side)
    const tree = view.render(), children = tree.props.children.flat().filter(Boolean)
    const legend = nodes(tree, node => node.props?.className === 'workout-readiness-legend')[0]
    const map = nodes(tree, node => node.props?.className === 'workout-body-map')[0]
    assert.equal(nodes(tree, node => node.props?.className === 'workout-readiness-legend').length, 1)
    assert.ok(children.includes(legend), 'The legend belongs to the complete map panel')
    assert.ok(children.includes(map), 'The entire map remains a sibling of the legend')
    assert.ok(children.indexOf(legend) < children.indexOf(map))
    assert.equal(legend.props['aria-label'], 'Readiness legend')
    assert.equal(nodes(legend, node => node.type === 'span').length, 4)
    assert.equal(nodes(map, node => node.props?.className === 'workout-readiness-legend').length, 0)
    const artwork = nodes(map, node => node.props?.className === 'workout-body-artwork')[0]
    assert.ok(artwork)
    assert.ok(nodes(artwork, node => node.props?.className === 'workout-muscle-overlay').length)
    assert.equal(nodes(artwork, node => node.props?.className === 'workout-readiness-legend').length, 0)
  }
  const css = readFileSync('app/globals.css', 'utf8')
  const legendRule = css.match(/\.workout-readiness-legend\{[^}]+\}/)?.[0]
  assert.ok(legendRule)
  for (const property of ['flex-wrap:wrap', 'max-width:100%', 'border:', 'padding:']) assert.ok(legendRule.includes(property))
  assert.doesNotMatch(legendRule, /position:\s*(absolute|fixed)/)
  assert.match(css, /@media\(max-width:560px\)\{[^\n]*\.workout-readiness-legend\{max-width:260px\}/)
})
