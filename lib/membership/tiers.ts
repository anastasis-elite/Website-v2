export type MembershipTier = 'free' | 'tracker' | 'ember' | 'ignite' | 'phoenix'

export function parseMembershipTier(value: unknown): MembershipTier | null {
  if (typeof value !== 'string') return null
  const tier = value.trim().toLowerCase()
  return ['free', 'tracker', 'ember', 'ignite', 'phoenix'].includes(tier) ? tier as MembershipTier : null
}
