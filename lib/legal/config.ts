export const TERMS_VERSION = 'v1.1'
export const PRIVACY_VERSION = 'v1.1'
export const HEALTH_DISCLAIMER_VERSION = 'v1.0'
export const RESEARCH_CONSENT_VERSION = 'v1.0'
export const FEATURE_CONSENT_VERSION = 'v1.0'
export const EFFECTIVE_DATE = 'July 1, 2026'
export const TERMS_EFFECTIVE_DATE = 'November 2, 2026'
export const PRIVACY_EFFECTIVE_DATE = 'November 2, 2026'
export const LEGAL_CONTACT_EMAIL = 'Anastasis.elite@gmail.com'

export const REQUIRED_LEGAL_VERSIONS = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
  healthDisclaimer: HEALTH_DISCLAIMER_VERSION,
} as const

export const FEATURE_CONSENT_TYPES = [
  'progress_photos',
  'posture_assessment_photos',
  'symptom_tracking',
  'cycle_tracking',
  'nutrition_tracking',
  'wearable_integrations',
  'ai_recommendations',
  'anonymized_research_use',
  'marketing_emails',
] as const

export type FeatureConsentType = (typeof FEATURE_CONSENT_TYPES)[number]

// Historical purpose values remain readable; retired purposes cannot be newly granted.
export const ACTIVE_FEATURE_CONSENT_TYPES = FEATURE_CONSENT_TYPES.filter(type => type !== 'ai_recommendations')
