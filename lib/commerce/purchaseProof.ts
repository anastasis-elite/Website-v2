import { createHash, timingSafeEqual, randomBytes } from 'crypto'

export function createPurchaseProof() { return randomBytes(32).toString('base64url') }
export function hashPurchaseProof(value: string) { return createHash('sha256').update(value).digest('hex') }
export function purchaseCookieName(sessionId: string) { return `anastasis_purchase_${sessionId}` }
export function verifyPurchaseProof(value: string | undefined, expected: string | undefined) {
  if (!value || !expected || !/^[a-f0-9]{64}$/.test(expected)) return false
  return timingSafeEqual(Buffer.from(hashPurchaseProof(value), 'hex'), Buffer.from(expected, 'hex'))
}
