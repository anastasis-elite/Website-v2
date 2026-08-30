import type {
  AccountabilityCommunicationProfile,
  AccountabilityPreferences,
  AccountabilitySupportPreference,
  NatalProfile,
} from './accountabilityTypes'

const DEFAULT_PROFILE: AccountabilityCommunicationProfile = {
  directness: 0.56,
  warmth: 0.68,
  challengeIntensity: 0.46,
  structurePreference: 0.56,
  reassuranceNeed: 0.52,
  humorLevel: 0.28,
  emotionalDepth: 0.52,
  actionBias: 0.58,
  reflectionBias: 0.42,
  autonomyPreference: 0.58,
  celebrationIntensity: 0.5,
}

type ProfileKey = keyof AccountabilityCommunicationProfile
type WeightedAdjustment = Partial<Record<ProfileKey, number>>

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))))
}

function applyWeighted(
  profile: AccountabilityCommunicationProfile,
  adjustment: WeightedAdjustment,
  weight: number,
) {
  const next = { ...profile }
  for (const [key, value] of Object.entries(adjustment) as Array<[ProfileKey, number]>) {
    next[key] = clamp(next[key] + value * weight)
  }
  return next
}

const signTone: Record<string, WeightedAdjustment> = {
  aries: { directness: 0.1, actionBias: 0.12, challengeIntensity: 0.08 },
  taurus: { structurePreference: 0.08, warmth: 0.06, reassuranceNeed: 0.04 },
  gemini: { humorLevel: 0.08, autonomyPreference: 0.08, reflectionBias: 0.05 },
  cancer: { warmth: 0.1, reassuranceNeed: 0.1, emotionalDepth: 0.08 },
  leo: { celebrationIntensity: 0.1, warmth: 0.06, challengeIntensity: 0.04 },
  virgo: { structurePreference: 0.12, directness: 0.06, actionBias: 0.06 },
  libra: { warmth: 0.08, autonomyPreference: 0.06, challengeIntensity: -0.04 },
  scorpio: { emotionalDepth: 0.12, directness: 0.04, reflectionBias: 0.06 },
  sagittarius: { humorLevel: 0.08, actionBias: 0.08, autonomyPreference: 0.08 },
  capricorn: { structurePreference: 0.12, directness: 0.08, challengeIntensity: 0.06 },
  aquarius: { autonomyPreference: 0.12, reflectionBias: 0.06, emotionalDepth: -0.02 },
  pisces: { warmth: 0.1, emotionalDepth: 0.1, reassuranceNeed: 0.08 },
}

const planetWeights: Record<string, number> = {
  mercury: 0.34,
  moon: 0.3,
  mars: 0.24,
  sun: 0.18,
  ascendant: 0.14,
  venus: 0.1,
  saturn: 0.08,
}

export function getDefaultCommunicationProfile() {
  return { ...DEFAULT_PROFILE }
}

export function deriveCommunicationProfileFromNatalProfile(natalProfile?: NatalProfile) {
  let profile = getDefaultCommunicationProfile()
  if (!natalProfile || natalProfile.confidence <= 0 || natalProfile.unavailableReason) {
    return profile
  }

  for (const [body, position] of Object.entries(natalProfile.placements)) {
    if (!position?.sign) continue
    const signAdjustment = signTone[position.sign]
    const bodyWeight = planetWeights[body] || 0.04
    const confidence = Math.max(0, Math.min(1, position.confidence * natalProfile.confidence))
    profile = applyWeighted(profile, signAdjustment, bodyWeight * confidence)
  }

  const elements = natalProfile.elementalBalance || {}
  if ((elements.fire || 0) > 0.35) profile = applyWeighted(profile, { actionBias: 0.06, challengeIntensity: 0.04 }, 1)
  if ((elements.earth || 0) > 0.35) profile = applyWeighted(profile, { structurePreference: 0.06, reassuranceNeed: 0.02 }, 1)
  if ((elements.air || 0) > 0.35) profile = applyWeighted(profile, { reflectionBias: 0.05, autonomyPreference: 0.04 }, 1)
  if ((elements.water || 0) > 0.35) profile = applyWeighted(profile, { warmth: 0.06, emotionalDepth: 0.06 }, 1)

  return profile
}

const preferenceAdjustments: Record<AccountabilitySupportPreference, WeightedAdjustment> = {
  call_me_out: { directness: 0.28, challengeIntensity: 0.24, warmth: -0.04, actionBias: 0.12 },
  remind_me_why: { emotionalDepth: 0.16, reflectionBias: 0.14, warmth: 0.08 },
  make_next_step_smaller: { structurePreference: 0.18, reassuranceNeed: 0.1, challengeIntensity: -0.16 },
  facts_and_direction: { directness: 0.22, structurePreference: 0.2, emotionalDepth: -0.08 },
  encourage_without_pressure: { warmth: 0.18, reassuranceNeed: 0.16, challengeIntensity: -0.24, autonomyPreference: 0.12 },
  push_when_ready: { challengeIntensity: 0.16, actionBias: 0.14, directness: 0.1 },
  help_me_stop: { structurePreference: 0.16, directness: 0.12, challengeIntensity: -0.08, reassuranceNeed: 0.08 },
}

export function applyExplicitPreferences(
  profile: AccountabilityCommunicationProfile,
  preferences?: AccountabilityPreferences,
) {
  let next = { ...profile }
  if (!preferences) return next

  if (preferences.supportPreference) {
    next = applyWeighted(next, preferenceAdjustments[preferences.supportPreference], 1)
  }

  const numericOverrides: Array<keyof AccountabilityPreferences & ProfileKey> = [
    'directness',
    'warmth',
    'challengeIntensity',
    'structurePreference',
    'reassuranceNeed',
    'humorLevel',
    'emotionalDepth',
    'autonomyPreference',
  ]

  for (const key of numericOverrides) {
    const value = preferences[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = clamp(value)
    }
  }

  return next
}

export function mergeCommunicationProfile(input: {
  natalProfile?: NatalProfile
  preferences?: AccountabilityPreferences
  behaviorProfile?: AccountabilityCommunicationProfile
}) {
  const natal = deriveCommunicationProfileFromNatalProfile(input.natalProfile)
  const withPreferences = applyExplicitPreferences(natal, input.preferences)
  return input.behaviorProfile
    ? blendProfiles(withPreferences, input.behaviorProfile, 0.38)
    : withPreferences
}

export function blendProfiles(
  base: AccountabilityCommunicationProfile,
  learned: AccountabilityCommunicationProfile,
  learnedWeight: number,
) {
  const weight = clamp(learnedWeight)
  const next = { ...base }
  for (const key of Object.keys(base) as ProfileKey[]) {
    next[key] = clamp(base[key] * (1 - weight) + learned[key] * weight)
  }
  return next
}
