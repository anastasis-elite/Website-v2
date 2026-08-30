import type { DailyInsight } from '@/lib/dashboard/dailyInsight'
import type { ResilienceEvaluation } from '@/lib/dashboard/resilienceEngine'

export type AccountabilityPartnerMode =
  | 'encourage'
  | 'challenge'
  | 'ground'
  | 'protect'
  | 'celebrate'
  | 'redirect'
  | 'simplify'

export type AccountabilitySupportPreference =
  | 'call_me_out'
  | 'remind_me_why'
  | 'make_next_step_smaller'
  | 'facts_and_direction'
  | 'encourage_without_pressure'
  | 'push_when_ready'
  | 'help_me_stop'

export type AccountabilityPreferences = {
  supportPreference?: AccountabilitySupportPreference | null
  directness?: number | null
  warmth?: number | null
  challengeIntensity?: number | null
  structurePreference?: number | null
  reassuranceNeed?: number | null
  humorLevel?: number | null
  emotionalDepth?: number | null
  autonomyPreference?: number | null
}

export type AccountabilityCommunicationProfile = {
  directness: number
  warmth: number
  challengeIntensity: number
  structurePreference: number
  reassuranceNeed: number
  humorLevel: number
  emotionalDepth: number
  actionBias: number
  reflectionBias: number
  autonomyPreference: number
  celebrationIntensity: number
}

export type AstroSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces'

export type AstroPlanet =
  | 'sun'
  | 'moon'
  | 'ascendant'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'

export type AstroPosition = {
  body: AstroPlanet
  sign?: AstroSign
  degree?: number
  house?: number
  confidence: number
}

export type NatalAspect = {
  bodies: [AstroPlanet, AstroPlanet]
  aspect: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile'
  orb?: number
  confidence: number
}

export type NatalBirthData = {
  dateOfBirth?: string | null
  exactBirthTime?: string | null
  birthTimeKnown: boolean
  birthplace?: string | null
  timezone?: string | null
  coordinates?: { latitude: number; longitude: number } | null
  confidence: number
}

export type NatalProfile = {
  birthData?: NatalBirthData
  placements: Partial<Record<AstroPlanet, AstroPosition>>
  houses?: Array<{ house: number; sign?: AstroSign; degree?: number; confidence: number }>
  aspects?: NatalAspect[]
  elementalBalance?: Partial<Record<'fire' | 'earth' | 'air' | 'water', number>>
  modalityBalance?: Partial<Record<'cardinal' | 'fixed' | 'mutable', number>>
  confidence: number
  unavailableReason?: string
}

export type TransitAspect = {
  bodies: [AstroPlanet, AstroPlanet]
  aspect: NatalAspect['aspect']
  orb?: number
}

export type TransitContext = {
  date: string
  sun?: AstroPosition
  moon?: AstroPosition
  mercury?: AstroPosition
  venus?: AstroPosition
  mars?: AstroPosition
  majorAspects?: TransitAspect[]
  unavailableReason?: string
}

export type PartnerPersona = {
  id: string
  name: string
  voiceCharacteristics: string[]
  conversationalTraits: string[]
  defaultTone: string
  relationshipStyle: string
  createdAt?: string
  updatedAt?: string
  userRenamed?: boolean
}

export type AccountabilityMemory = {
  statedGoals?: string[]
  repeatedStruggles?: string[]
  successfulPatterns?: string[]
  recentCommitments?: string[]
  progressMilestones?: string[]
  preferredToneNotes?: string[]
  routinePatterns?: string[]
}

export type AccountabilityBehaviorSummary = {
  directPromptCompletionRate?: number
  gentlePromptCompletionRate?: number
  highChallengeDismissalRate?: number
  supportivePromptCompletionRate?: number
  concisePromptCompletionRate?: number
  ignoredMessageRate?: number
  recentCompletions?: string[]
  recentDismissals?: string[]
  sampleSize?: number
}

export type AccountabilityContext = {
  userId?: string | null
  clientId?: string | null
  resilienceState: ResilienceEvaluation
  dailyInsight: DailyInsight
  availableTime?: number
  scheduleLoad?: 'open' | 'steady' | 'packed' | string
  recentBehavior?: AccountabilityBehaviorSummary
  userPreferences?: AccountabilityPreferences
  natalProfile?: NatalProfile
  transitContext?: TransitContext
  persona?: PartnerPersona | null
  memory?: AccountabilityMemory
  currentTimeOfDay?: 'morning' | 'midday' | 'evening'
}

export type AccountabilityResponse = {
  message: string
  mode: AccountabilityPartnerMode
  intensity: number
  reasoningTags: string[]
  partner: PartnerPersona
  communicationProfile: AccountabilityCommunicationProfile
}

export type AccountabilityFeedbackEvent = {
  style: AccountabilityPartnerMode
  completedRecommendedAction?: boolean
  dismissed?: boolean
  helpful?: boolean
  tone?: 'too_soft' | 'right' | 'too_intense'
  createdAt?: string
}
