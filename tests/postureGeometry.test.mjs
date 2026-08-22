import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function importTypescriptModule(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const { angleDegrees, midpoint, normalizePoint, normalizedDistance, pointChanged } =
  await importTypescriptModule('lib/posture/geometry.ts')

test('normalizePoint stores image-relative coordinates', () => {
  assert.deepEqual(normalizePoint({ x: 250, y: 500, confidence: 0.82 }, 1000, 2000), {
    x: 0.25,
    y: 0.25,
    confidence: 0.82,
  })
})

test('normalizePoint clamps out-of-bounds landmarks into image space', () => {
  assert.deepEqual(normalizePoint({ x: -10, y: 2200 }, 1000, 2000), {
    x: 0,
    y: 1,
    confidence: null,
  })
})

test('midpoint and geometry helpers support future posture comparisons', () => {
  const a = { x: 0.2, y: 0.4, confidence: 0.8 }
  const b = { x: 0.6, y: 0.4, confidence: 0.6 }

  assert.deepEqual(midpoint(a, b), { x: 0.4, y: 0.4, confidence: 0.7 })
  assert.equal(angleDegrees(a, b), 0)
  assert.equal(Math.round(normalizedDistance(a, b) * 100), 40)
  assert.equal(pointChanged(a, { x: 0.201, y: 0.401 }), false)
  assert.equal(pointChanged(a, { x: 0.21, y: 0.4 }), true)
})
