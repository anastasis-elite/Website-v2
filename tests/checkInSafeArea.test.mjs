import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/dashboard/check-in/page.tsx', 'utf8')
const css = readFileSync('app/dashboard/check-in/check-in-safe-area.css', 'utf8')

test('check-in alone mounts a noninteractive cover outside the phone surface stacking context', () => {
  assert.match(page, /import '\.\/check-in-safe-area\.css'/)
  assert.match(page, /return <>[\s\S]*<div className="check-in-safe-area" aria-hidden="true" \/><PhoneAppFrame/)
  assert.doesNotMatch(readFileSync('components/phone-app/PhoneAppFrame.tsx', 'utf8'), /check-in-safe-area/)
  assert.doesNotMatch(readFileSync('app/layout.tsx', 'utf8'), /check-in-safe-area/)
})

test('installed check-in keeps the status-bar cover fixed without adding another inset', () => {
  assert.match(css, /\.check-in-safe-area\s*\{ display: none; \}/)
  assert.match(css, /@media \(display-mode: standalone\)/)
  assert.match(css, /position: fixed/)
  assert.match(css, /inset: 0 0 auto/)
  assert.match(css, /height: env\(safe-area-inset-top, 0px\)/)
  assert.match(css, /z-index: 10000/)
  assert.match(css, /background: #21150e/)
  assert.match(css, /pointer-events: none/)
  assert.doesNotMatch(css, /padding(?:-top)?:|margin(?:-top)?:/)
  assert.match(readFileSync('app/globals.css', 'utf8'), /body\s*\{[^}]*padding-top: env\(safe-area-inset-top\)/)
})
