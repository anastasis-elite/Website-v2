import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'

test('live strength acceptance fails closed before authentication or writes without a private synthetic fixture', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-strength-live-acceptance.mjs'], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  const receipt = JSON.parse(result.stdout.trim())
  assert.equal(receipt.status, 'NOT TESTED')
  assert.equal(receipt.productionPromotionAllowed, false)
  assert.deepEqual(receipt.checks, [])
})
