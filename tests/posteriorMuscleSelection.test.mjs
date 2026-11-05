import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'

const require = createRequire(import.meta.url)
function loader(react = React) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (extname(path) === '.json') return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} };cache.set(path, module)
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    runInNewContext(source, { module, exports: module.exports, Date, Map, Set,
      require(name) {
        if (name === 'react') return react
        if (name === 'next/image') return { __esModule: true, default: 'img' }
        if (name === 'server-only') return {}
        const file = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        return file ? load(extname(file) ? file : file + '.ts') : require(name)
      },
    }, { filename: path })
    return module.exports
  }
  return load
}
const actual = loader()
const muscles = actual('lib/workout/muscleReadiness.ts')
const manual = actual('lib/workout/manualWorkout.ts')
const plain = value => JSON.parse(JSON.stringify(value))
function walk(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate))
  if (!node || typeof node !== 'object') return []
  const children = typeof node.type === 'function' ? node.type(node.props) : node.props?.children
  return [...(predicate(node) ? [node] : []), ...walk(children, predicate)]
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  return node && typeof node === 'object' ? text(node.props?.children) : ''
}
function harness(extra = {}) {
  const state = [];let cursor = 0
  const react = { ...React, useMemo: fn => fn(), useState(initial) {
    const index = cursor++
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
    return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next }]
  } }
  const exports = loader(react)('components/workout-dashboard/MuscleReadinessMap.tsx')
  let props = { readiness: [], ...extra }
  const selected = []
  if (extra.onSelectMuscle === true) props.onSelectMuscle = id => { selected.push(id);props = { ...props, selectedMuscleId: id } }
  const render = () => { cursor = 0;return exports.default(props) }
  const regions = tree => walk(tree, element => Boolean(element.props?.['data-muscle-id']))
  const region = (tree, id) => regions(tree).find(element => element.props['data-muscle-id'] === id)
  const back = tree => walk(tree, element => element.type === 'button' && element.props.children === 'Back')[0]
  return { exports, render, region, regions, back, selected }
}

test('Back uses the supplied decorative artwork with aligned shoulder, trap and lumbar hit areas while the front asset stays intact', () => {
  const app = harness(), front = app.render()
  assert.equal(walk(front, element => element.props?.src === '/woman-silhouette.png').length, 1)
  assert.ok(app.region(front, 'left_upper_traps'))
  assert.ok(app.region(front, 'left_pectoralis_major'))
  assert.equal(app.region(front, 'left_posterior_deltoid'), undefined)
  const frontFrame = walk(front, element => element.props?.className === 'workout-body-map')[0]
  assert.equal(frontFrame.props.style.aspectRatio, '862 / 1825')
  assert.equal(walk(front, element => element.props?.className === 'workout-body-artwork')[0].props.style, undefined, 'Front keeps its original full-frame registration.')
  app.back(front).props.onClick()
  const back = app.render()
  const overlay = walk(back, element => element.props?.className === 'workout-muscle-overlay')[0]
  assert.equal(overlay.props.role, 'group', 'The interactive layer exposes its child button semantics.')
  assert.equal(walk(back, element => element.props?.src === '/woman-silhouette.png').length, 0)
  const artwork = walk(back, element => element.props?.['data-testid'] === 'posterior-body-image')
  assert.equal(artwork.length, 1)
  assert.equal(artwork[0].props.src, '/images/muscle-map/posterior-body.webp')
  assert.equal(artwork[0].props.alt, '')
  assert.equal(artwork[0].props['aria-hidden'], 'true', 'Region buttons provide the accessible anatomy labels.')
  assert.equal(artwork[0].props.width, 932)
  assert.equal(artwork[0].props.height, 1687)
  assert.equal(overlay.props.viewBox, `0 0 ${artwork[0].props.width} ${artwork[0].props.height}`)
  assert.equal(walk(back, element => element.props?.className === 'workout-body-map')[0].props.style.aspectRatio, frontFrame.props.style.aspectRatio, 'Switching views cannot resize the map frame.')
  const layers = walk(back, element => element.props?.className === 'workout-body-artwork')
  assert.equal(layers.length, 1)
  assert.equal(layers[0].props.children.length, 2)
  assert.equal(layers[0].props.children[0], artwork[0], 'Artwork uses the common registration parent.')
  assert.equal(layers[0].props.children[1], overlay, 'The interactive overlay uses that same registration parent.')
  assert.equal(artwork[0].props.style, undefined)
  assert.equal(overlay.props.style, undefined)
  assert.equal(walk(back, element => element.type === 'svg').length, 1, 'Artwork and interactive overlay remain separate layers.')
  for (const id of ['left_upper_traps', 'right_upper_traps', 'left_posterior_deltoid', 'right_posterior_deltoid', 'erector_spinae_region']) {
    assert.ok(app.region(back, id), `${id} is keyboard-selectable on Back`)
  }
  assert.equal(app.region(back, 'left_pectoralis_major'), undefined)
  assert.equal(app.region(back, 'rectus_abdominis'), undefined)
  for (const id of ['left_upper_traps', 'right_upper_traps']) {
    assert.equal(muscles.MUSCLE_REGIONS.filter(region => region.id === id).length, 1, 'A back view does not create another trap history record.')
  }
})

test('Back fills the front frame uniformly, shares its visible figure landmarks and keeps every hit area inside the clip', () => {
  const app = harness()
  app.back(app.render()).props.onClick()
  const back = app.render(), layer = walk(back, element => element.props?.className === 'workout-body-artwork')[0]
  const image = walk(layer, element => element.props?.['data-testid'] === 'posterior-body-image')[0]
  const translation = /^translate\(-([\d.]+)%, ([\d.]+)%\)$/.exec(layer.props.style.transform)
  assert.ok(translation, 'One common layer translates both artwork and hit areas.')
  assert.equal(Number(translation[2]), 2.8)
  assert.match(readFileSync('app/globals.css', 'utf8'), /\.workout-body-artwork\{position:absolute;inset:0\}/, 'The registration layer fills the fixed frame height.')
  for (const frameWidth of [260, 320, 390]) {
    const frameHeight = frameWidth * 1825 / 862
    const layerWidth = frameWidth * parseFloat(layer.props.style.width) / 100
    const left = frameWidth * parseFloat(layer.props.style.left) / 100 - layerWidth * Number(translation[1]) / 100
    const top = frameHeight * Number(translation[2]) / 100
    const scaleX = layerWidth / image.props.width, scaleY = frameHeight / image.props.height
    assert.ok(Math.abs(scaleX - scaleY) < 1e-12, 'The image and native-coordinate SVG scale equally on both axes.')
    assert.ok(Math.abs(left + 465 * scaleX - 425 * frameWidth / 862) < 1e-9, 'Back and Front share the torso axis.')
    for (const [backY, frontY] of [[90, 149], [1509, 1683]]) {
      assert.ok(Math.abs(top + backY * scaleY - frontY * frameWidth / 862) < 1, 'The supplied figures have matching visible bun and heel positions within one CSS pixel.')
    }
    const nativePoints = Object.values(app.exports.posteriorMuscleMapGeometry).flatMap(geometry => geometry.points)
    for (const [x, y] of [...nativePoints, [268, 90], [660, 1509]]) {
      assert.ok(left + x * scaleX > 0 && left + x * scaleX < frameWidth, 'Clipping preserves the complete silhouette and every interactive region horizontally.')
      assert.ok(top + y * scaleY > 0 && top + y * scaleY < frameHeight, 'Clipping preserves the visible bun, heels and every interactive region vertically.')
    }
  }
})

test('Every posterior region uses the supplied artwork coordinate system with lumbar-only lower-back coverage', () => {
  const { posteriorMuscleMapGeometry, muscleMapGeometry } = harness().exports
  assert.ok(posteriorMuscleMapGeometry)
  const lumbar = posteriorMuscleMapGeometry.erector_spinae_region.points
  assert.ok(Math.min(...lumbar.map(([, y]) => y)) >= 580, 'Lumbar selection starts below the thoracic/scapular area.')
  assert.ok(Math.max(...lumbar.map(([, y]) => y)) <= 715, 'Lumbar selection stays above the pelvis.')
  const posteriorIds = muscles.MUSCLE_REGIONS.filter(region => muscles.muscleRegionIsVisible(region, 'posterior')).map(region => region.id)
  assert.equal(posteriorIds.length, 15)
  assert.deepEqual(Object.keys(posteriorMuscleMapGeometry).sort(), [...posteriorIds].sort())
  for (const id of posteriorIds) {
    assert.notDeepEqual(plain(posteriorMuscleMapGeometry[id].points), plain(muscleMapGeometry[id].points), `${id} must be registered to the back artwork rather than reuse front coordinates.`)
    for (const [x, y] of posteriorMuscleMapGeometry[id].points) {
      assert.ok(Number.isFinite(x) && x > 0 && x < 932)
      assert.ok(Number.isFinite(y) && y > 0 && y < 1687)
    }
  }
  assert.ok(Math.max(...posteriorMuscleMapGeometry.left_posterior_deltoid.points.map(([x]) => x)) < 465)
  assert.ok(Math.min(...posteriorMuscleMapGeometry.right_posterior_deltoid.points.map(([x]) => x)) > 465)
})

test('Measured back-anatomy anchors target each of the fifteen posterior regions without competing polygon coverage', () => {
  const app = harness()
  app.back(app.render()).props.onClick()
  const polygons = app.regions(app.render())
  const leftAnchors = {
    upper_traps: [440, 380], posterior_deltoid: [342, 440], triceps: [334, 554],
    lat_region: [413, 538], glute_max: [395, 776], hamstrings: [400, 951], calves: [410, 1200],
  }
  const anchors = { erector_spinae_region: [465, 655] }
  for (const [name, [x, y]] of Object.entries(leftAnchors)) {
    anchors[`left_${name}`] = [x, y]
    anchors[`right_${name}`] = [930 - x, y]
  }
  function contains(polygon, [x, y]) {
    const points = polygon.props.points.split(' ').map(pair => pair.split(',').map(Number))
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [currentX, currentY] = points[i], [previousX, previousY] = points[j]
      if ((currentY > y) !== (previousY > y) && x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX) inside = !inside
    }
    return inside
  }
  assert.equal(polygons.length, 15)
  for (const [id, point] of Object.entries(anchors)) {
    assert.deepEqual(polygons.filter(polygon => contains(polygon, point)).map(polygon => polygon.props['data-muscle-id']), [id], `${id} anatomy anchor must remain its sole pointer target.`)
  }
})

test('Manual click and Enter/Space selection highlight matching bilateral regions without emitting duplicate selections', () => {
  const app = harness({ bilateralSelection: true, onSelectMuscle: true })
  let tree = app.render()
  app.region(tree, 'left_biceps').props.onClick()
  tree = app.render()
  assert.deepEqual(app.selected, ['left_biceps'])
  for (const id of ['left_biceps', 'right_biceps']) {
    assert.equal(app.region(tree, id).props['aria-pressed'], true)
    assert.match(app.region(tree, id).props.className, /is-selected/)
  }
  let prevented = 0
  app.region(tree, 'right_biceps').props.onKeyDown({ key: 'Enter', preventDefault() { prevented++ } })
  tree = app.render()
  app.region(tree, 'left_biceps').props.onKeyDown({ key: ' ', preventDefault() { prevented++ } })
  assert.equal(prevented, 2)
  assert.deepEqual(app.selected, ['left_biceps', 'right_biceps', 'left_biceps'])
  app.region(tree, 'left_upper_traps').props.onClick()
  tree = app.render()
  app.back(tree).props.onClick()
  tree = app.render()
  for (const id of ['left_upper_traps', 'right_upper_traps']) assert.equal(app.region(tree, id).props['aria-pressed'], true)
  assert.deepEqual(plain(muscles.getBilateralMuscleIds('right_biceps')).sort(), ['left_biceps', 'right_biceps'])
  assert.deepEqual(plain(muscles.getBilateralMuscleIds('erector_spinae_region')), ['erector_spinae_region'])
})

test('Readiness inspection retains individual selection when bilateral manual mode is not enabled', () => {
  const app = harness()
  let tree = app.render()
  app.region(tree, 'left_biceps').props.onClick()
  tree = app.render()
  assert.equal(app.region(tree, 'left_biceps').props['aria-pressed'], true)
  assert.equal(app.region(tree, 'right_biceps').props['aria-pressed'], false)
  app.region(tree, 'left_biceps').props.onClick()
  assert.equal(app.region(app.render(), 'left_biceps').props['aria-pressed'], false)
})

test('Canonical readiness still takes the worse side and posterior regions do not multiply logged training loads', () => {
  const readiness = [
    { muscleId: 'left_anterior_deltoid', state: 'ready', readinessScore: 82 },
    { muscleId: 'right_anterior_deltoid', state: 'rest', readinessScore: 20 },
    { muscleId: 'left_posterior_deltoid', state: 'available', readinessScore: 64 },
  ]
  assert.equal(manual.getReadinessForCanonicalMuscle(readiness, 'shoulders'), 'rest')
  assert.equal(manual.getReadinessForCanonicalMuscle([...readiness].reverse(), 'shoulders'), 'rest')
  const app = harness({ readiness, bilateralSelection: true, onSelectMuscle: true })
  app.region(app.render(), 'left_anterior_deltoid').props.onClick()
  const selected = app.render()
  const detail = walk(selected, node => node.props?.className === 'workout-muscle-detail')[0]
  assert.match(text(detail), /20% readiness estimate/)
  assert.match(text(detail), /Recovery still accumulating/)
  assert.doesNotMatch(text(detail), /82%|High readiness/)
  assert.match(app.region(selected, 'left_anterior_deltoid').props.className, /readiness-ready/)
  assert.match(app.region(selected, 'right_anterior_deltoid').props.className, /readiness-rest/)
  const workoutHistory = [{ workout_date: '2026-11-01T12:00:00Z', completed: true,
    exercise_logs: [{ exercise: 'Shoulder Press', sets: 1, actual_reps: 2, actual_weight: 0, completed: true }] }]
  const before = structuredClone(workoutHistory)
  const result = muscles.buildMuscleReadiness({ tier: 'phoenix', todaysExercises: [], workoutHistory, recoverySignals: [], now: new Date('2026-11-02T12:00:00Z') })
  for (const id of ['left_anterior_deltoid', 'right_anterior_deltoid', 'left_posterior_deltoid', 'right_posterior_deltoid']) {
    assert.equal(result.find(item => item.muscleId === id).recentTrainingLoad, 2)
  }
  assert.deepEqual(workoutHistory, before)
})
