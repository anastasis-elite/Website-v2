import type { NatalBirthData, NatalProfile, TransitContext } from './accountabilityTypes'

export function buildNatalProfile(input?: {
  birthData?: Partial<NatalBirthData>
  storedProfile?: Partial<NatalProfile> | null
}): NatalProfile {
  const birthData = input?.birthData
  const stored = input?.storedProfile
  const birthTimeKnown = Boolean(birthData?.birthTimeKnown && birthData.exactBirthTime)
  const hasBirthDate = Boolean(birthData?.dateOfBirth)

  const placements = { ...(stored?.placements || {}) }
  if (!birthTimeKnown) {
    delete placements.ascendant
  }

  return {
    birthData: birthData
      ? {
          dateOfBirth: birthData.dateOfBirth || null,
          exactBirthTime: birthTimeKnown ? birthData.exactBirthTime || null : null,
          birthTimeKnown,
          birthplace: birthData.birthplace || null,
          timezone: birthData.timezone || null,
          coordinates: birthData.coordinates || null,
          confidence: hasBirthDate ? (birthTimeKnown ? 0.82 : 0.58) : 0,
        }
      : stored?.birthData,
    placements,
    houses: birthTimeKnown ? stored?.houses : undefined,
    aspects: stored?.aspects || [],
    elementalBalance: stored?.elementalBalance,
    modalityBalance: stored?.modalityBalance,
    confidence: stored?.confidence ?? (hasBirthDate ? (birthTimeKnown ? 0.72 : 0.42) : 0),
    unavailableReason: hasBirthDate || stored ? undefined : 'natal_profile_unavailable',
  }
}

export function emptyNatalProfile(reason = 'natal_profile_unavailable'): NatalProfile {
  return {
    placements: {},
    aspects: [],
    confidence: 0,
    unavailableReason: reason,
  }
}

export function normalizeTransitContext(transitContext?: TransitContext | null): TransitContext | undefined {
  if (!transitContext) return undefined
  return {
    ...transitContext,
    majorAspects: transitContext.majorAspects || [],
  }
}
