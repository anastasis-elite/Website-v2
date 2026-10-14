export type WaterSubmission = {
  submissionId: string
  ounces: number
  logDate: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const storageKey = (clientId: string) => `anastasis:water-submission:v1:${clientId}`
const archivePrefix = (clientId: string) => `anastasis:water-unconfirmed:v1:${clientId}:`

function validSubmission(value: WaterSubmission): boolean {
  return typeof value?.submissionId === 'string' && uuidPattern.test(value.submissionId) &&
    typeof value.ounces === 'number' && Number.isFinite(value.ounces) && value.ounces > 0 &&
    typeof value.logDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.logDate)
}

const sameSubmission = (first: WaterSubmission, second: WaterSubmission) =>
  first.submissionId === second.submissionId && first.ounces === second.ounces && first.logDate === second.logDate

function storage() {
  try { return window.localStorage }
  catch { throw new Error('Water retry storage is unavailable. Enable browser storage before logging water.') }
}

export function pendingWaterSubmission(clientId: string): WaterSubmission | null {
  let saved: string | null
  try { saved = storage().getItem(storageKey(clientId)) }
  catch { throw new Error('Water retry storage is unavailable. Enable browser storage before logging water.') }
  if (!saved) return null
  try {
    const value = JSON.parse(saved)
    if (validSubmission(value)) return value
  } catch { /* Preserve unreadable attempts so they cannot silently become a second drink. */ }
  throw new Error('An earlier water save could not be confirmed. Review your saved hydration before logging again.')
}

// An open control can outlive another tab's confirmation. Its Retry action must
// keep the original identity even if that other tab has cleared active storage.
export function retainWaterSubmission(clientId: string, receipt: WaterSubmission, logDate: string): WaterSubmission {
  if (!validSubmission(receipt) || receipt.logDate !== logDate) {
    throw new Error('This earlier water save belongs to another day. Keep it for review before logging today’s water.')
  }
  const current = pendingWaterSubmission(clientId)
  if (current && !sameSubmission(current, receipt)) throw new Error('Another water save is pending. Confirm that save before retrying this drink.')
  try {
    const value = JSON.stringify(receipt)
    storage().setItem(storageKey(clientId), value)
    if (storage().getItem(storageKey(clientId)) !== value) throw new Error('Storage did not retain the submission')
  } catch { throw new Error('Water retry storage is unavailable. Enable browser storage before logging water.') }
  return receipt
}

// Explicit old-day recovery preserves the complete ambiguous receipt separately
// before freeing the active slot. It never retries or re-dates the old drink.
export function archiveWaterSubmission(clientId: string, receipt: WaterSubmission) {
  if (!validSubmission(receipt)) throw new Error('The earlier water save could not be retained.')
  const current = pendingWaterSubmission(clientId)
  if (current && !sameSubmission(current, receipt)) throw new Error('Another water save is pending. Confirm that save before changing days.')
  const archiveKey = `${archivePrefix(clientId)}${receipt.submissionId}`
  try {
    const value = JSON.stringify(receipt)
    storage().setItem(archiveKey, value)
    if (storage().getItem(archiveKey) !== value) throw new Error('Storage did not retain the earlier save')
    if (current) {
      storage().removeItem(storageKey(clientId))
      if (storage().getItem(storageKey(clientId))) throw new Error('Storage did not free the active submission')
    }
  } catch { throw new Error('The earlier save could not be safely retained. Enable browser storage before starting today’s water log.') }
}

export function archivedWaterSubmissions(clientId: string): WaterSubmission[] {
  const local = storage()
  const receipts: WaterSubmission[] = []
  try {
    for (let index = 0; index < local.length; index++) {
      const key = local.key(index)
      if (!key?.startsWith(archivePrefix(clientId))) continue
      const value = JSON.parse(local.getItem(key) || 'null')
      if (validSubmission(value)) receipts.push(value)
    }
  } catch { throw new Error('Earlier water saves could not be read. Your stored receipts have been kept.') }
  return receipts.sort((first, second) => second.logDate.localeCompare(first.logDate))
}

export function beginWaterSubmission(clientId: string, ounces: number, logDate: string): WaterSubmission {
  const pending = pendingWaterSubmission(clientId)
  if (pending) {
    if (pending.logDate !== logDate) {
      throw new Error(`The ${pending.ounces} oz water save for ${pending.logDate} could not be confirmed. Review that day’s hydration before logging again.`)
    }
    if (pending.ounces !== ounces) throw new Error(`Retry the pending ${pending.ounces} oz save before logging another drink.`)
    return pending
  }
  const next = { submissionId: crypto.randomUUID(), ounces, logDate }
  // Persist before sending: a lost response or PWA reload must retry the same drink.
  try {
    storage().setItem(storageKey(clientId), JSON.stringify(next))
    if (storage().getItem(storageKey(clientId)) !== JSON.stringify(next)) throw new Error('Storage did not retain the submission')
  } catch { throw new Error('Water retry storage is unavailable. Enable browser storage before logging water.') }
  return next
}

export function confirmWaterSubmission(clientId: string, submissionId: string) {
  const pending = pendingWaterSubmission(clientId)
  if (pending?.submissionId !== submissionId) return
  try {
    storage().removeItem(storageKey(clientId))
    if (storage().getItem(storageKey(clientId))) throw new Error('Storage did not clear the submission')
  } catch { throw new Error('Water was saved, but its confirmation could not be retained. Retry this same drink to confirm the saved total.') }
}
