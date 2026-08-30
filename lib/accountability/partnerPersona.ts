import type { AccountabilityCommunicationProfile, PartnerPersona } from './accountabilityTypes'

const names = ['Mara', 'Sela', 'Nora', 'Vera', 'Elian', 'Rhea', 'Maeve', 'Lena']

function hash(value: string) {
  let result = 0
  for (let index = 0; index < value.length; index++) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

export function createPartnerPersona(input: {
  userId?: string | null
  clientId?: string | null
  profile: AccountabilityCommunicationProfile
  existing?: PartnerPersona | null
}): PartnerPersona {
  if (input.existing?.id && input.existing.name) return input.existing

  const seed = `${input.userId || 'user'}:${input.clientId || 'client'}`
  const index = hash(seed) % names.length
  const profile = input.profile
  const now = new Date().toISOString()

  return {
    id: `accountability-partner-${hash(seed).toString(36)}`,
    name: names[index],
    voiceCharacteristics: [
      profile.directness > 0.68 ? 'direct' : 'clear',
      profile.warmth > 0.68 ? 'warm' : 'steady',
      profile.structurePreference > 0.65 ? 'structured' : 'adaptive',
    ],
    conversationalTraits: [
      profile.actionBias >= profile.reflectionBias ? 'action-oriented' : 'reflective',
      profile.challengeIntensity > 0.62 ? 'comfortable challenging when appropriate' : 'low-pressure',
      profile.reassuranceNeed > 0.62 ? 'stabilizing' : 'concise',
    ],
    defaultTone: profile.warmth > 0.65 ? 'warm and grounded' : 'clear and grounded',
    relationshipStyle: profile.challengeIntensity > 0.6 ? 'respectful accountability' : 'supportive accountability',
    createdAt: now,
    updatedAt: now,
  }
}
