export type WaterSubmission = {
  submissionId: string
  ounces: number
  logDate: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const storageKey = (clientId: string) => `anastasis:water-submission:v1:${clientId}`

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
    if (typeof value.submissionId === 'string' && uuidPattern.test(value.submissionId) &&
        typeof value.ounces === 'number' && Number.isFinite(value.ounces) && value.ounces > 0 &&
        typeof value.logDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.logDate)) return value
  } catch { /* Preserve unreadable attempts so they cannot silently become a second drink. */ }
  throw new Error('An earlier water save could not be confirmed. Review your saved hydration before logging again.')
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
