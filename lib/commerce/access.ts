export function hasMemberAccess(client: { program?: unknown; access?: unknown; active?: unknown; verified_purchase?: unknown; subscription_ends_at?: unknown } | null | undefined, now = new Date()) {
  if (!client || !['ember','ignite','phoenix'].includes(String(client.program).toLowerCase())) return false
  if (client.access !== true || client.active === false) return false
  if (client.subscription_ends_at !== null && client.subscription_ends_at !== undefined && client.subscription_ends_at !== '') {
    const end = typeof client.subscription_ends_at === 'string' ? Date.parse(client.subscription_ends_at) : NaN
    if (!Number.isFinite(end) || end <= now.getTime()) return false
  }
  if (client.verified_purchase === true) {
    const end = typeof client.subscription_ends_at === 'string' ? Date.parse(client.subscription_ends_at) : NaN
    return Number.isFinite(end) && end > now.getTime()
  }
  // Administrator-issued gifted access is explicit, independent of Stripe.
  return true
}
