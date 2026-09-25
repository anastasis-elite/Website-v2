export const NUTRIENT_INTELLIGENCE_VERSION = 'nutrient_intelligence_v1.0.0'

export type NutrientConfidenceCategory =
  | 'low_information'
  | 'moderate_pattern'
  | 'stronger_pattern'
  | 'confirmed_clinical_data'

export type NutrientAction =
  | 'no_action'
  | 'food_first_recommendation'
  | 'monitor_pattern'
  | 'review_supplement_intake'
  | 'discuss_labs_with_clinician'
  | 'safety_warning_clinician_recommendation'

export type NutrientPatternState =
  | 'possible_inadequate_intake'
  | 'symptom_pattern_possibly_associated_with_inadequacy'
  | 'confirmed_deficiency'
  | 'possible_excessive_intake'
  | 'intake_above_established_ul'
  | 'possible_toxicity_pattern'
  | 'confirmed_toxicity'
  | 'none'

export type NutrientRelationshipType =
  | 'inadequate_intake_association'
  | 'deficiency_association'
  | 'excessive_intake_association'
  | 'toxicity_association'

export type NutrientRelationship = {
  nutrientKey: string
  symptomKey: string
  relationshipType: NutrientRelationshipType
  evidenceStrength: 'low' | 'moderate' | 'high' | 'authoritative'
  sourceKey: string
  notes?: string | null
  applicableContext?: Record<string, unknown> | null
}

export type NutrientInteraction = {
  nutrientKey: string
  relatedNutrientKey: string
  interactionType:
    | 'enhances_absorption'
    | 'reduces_absorption'
    | 'competes_for_absorption'
    | 'excessive_intake_may_affect'
    | 'metabolic_dependency'
    | 'timing_consideration'
  evidenceStrength: 'low' | 'moderate' | 'high' | 'authoritative'
  sourceKey: string
  notes?: string | null
}

export type NutrientReferenceValue = {
  nutrientKey: string
  referenceType: 'rda' | 'ai' | 'ul' | 'ear'
  amount: number
  unit: string
  appliesToIntakeSource: 'total' | 'supplemental' | 'food' | 'specific_form'
  minAgeYears?: number | null
  maxAgeYears?: number | null
  sex?: 'female' | 'male' | 'any' | null
  pregnancyStatus?: 'not_applicable' | 'not_pregnant' | 'pregnant' | 'lactating' | 'any' | null
  nutrientForm?: string | null
  sourceKey: string
}

export type NutrientSignalInput = {
  nutrientKey: string
  nutrientName?: string
  foodAmount?: number | null
  supplementAmount?: number | null
  totalAmount?: number | null
  unit?: string | null
  targetAmount?: number | null
  symptomKeys?: string[]
  symptomDays?: number
  symptomSeverityMax?: number | null
  energyValues?: Array<number | null | undefined>
  sleepHours?: Array<number | null | undefined>
  readinessValues?: Array<number | null | undefined>
  menstrualBurdenBand?: 'none' | 'light' | 'moderate' | 'high' | 'very_high' | null
  menstrualBurdenChangedFromBaseline?: boolean
  trainingLoadElevated?: boolean
  confirmedClinicalState?: 'confirmed_deficiency' | 'confirmed_toxicity' | null
  referenceValues?: NutrientReferenceValue[]
  symptomRelationships?: NutrientRelationship[]
  interactions?: NutrientInteraction[]
}

export type NutrientInsight = {
  nutrientKey: string
  nutrientName: string
  action: NutrientAction
  confidenceCategory: NutrientConfidenceCategory
  patternState: NutrientPatternState
  message: string
  why: string[]
  foodFirst: boolean
  clinicianEscalation: boolean
  safetyEscalationReason: string | null
  evidenceRelationshipsUsed: NutrientRelationship[]
  interactionsConsidered: NutrientInteraction[]
  algorithmVersion: string
}

const forbiddenDiagnosticTerms = [
  /\byou have\b/i,
  /\byou are deficient\b/i,
  /\banemic\b/i,
  /\bdeficiency is causing\b/i,
  /\bcaused by\b/i,
  /\bdiagnos/i,
]

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function average(values: Array<number | null | undefined>) {
  const nums = values.map(numeric).filter((value): value is number => value !== null)
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null
}

function lowAverage(values: Array<number | null | undefined>, threshold: number) {
  const avg = average(values)
  return avg !== null && avg < threshold
}

function isRecentIntakeLow(input: NutrientSignalInput) {
  const total = numeric(input.totalAmount)
  const target = numeric(input.targetAmount)
  if (total === null || target === null || target <= 0) return false
  return total < target * 0.65
}

function matchingRelationship(input: NutrientSignalInput, types: NutrientRelationshipType[]) {
  const symptoms = new Set((input.symptomKeys || []).map((symptom) => symptom.toLowerCase()))
  return (input.symptomRelationships || []).filter((relationship) => {
    return (
      relationship.nutrientKey === input.nutrientKey &&
      symptoms.has(relationship.symptomKey.toLowerCase()) &&
      types.includes(relationship.relationshipType)
    )
  })
}

function matchingUl(input: NutrientSignalInput) {
  return (input.referenceValues || []).find((value) => {
    if (value.nutrientKey !== input.nutrientKey || value.referenceType !== 'ul') return false
    const supplementOnly = value.appliesToIntakeSource === 'supplemental'
    const amount = supplementOnly ? numeric(input.supplementAmount) : numeric(input.totalAmount)
    return amount !== null && amount > value.amount
  })
}

function safeMessage(message: string) {
  if (forbiddenDiagnosticTerms.some((pattern) => pattern.test(message))) {
    return 'Your recent inputs show a nutrient-related pattern worth reviewing. This does not establish a deficiency or diagnosis.'
  }

  return message
}

export function evaluateNutrientInsight(input: NutrientSignalInput): NutrientInsight {
  const nutrientName = input.nutrientName || input.nutrientKey.replaceAll('_', ' ')
  const relationshipsForInadequacy = matchingRelationship(input, [
    'inadequate_intake_association',
    'deficiency_association',
  ])
  const relationshipsForExcess = matchingRelationship(input, [
    'excessive_intake_association',
    'toxicity_association',
  ])
  const ulExceeded = matchingUl(input)
  const intakeLow = isRecentIntakeLow(input)
  const persistentSymptoms = (input.symptomDays || 0) >= 3
  const lowEnergy = lowAverage(input.energyValues || [], 5)
  const lowReadiness = lowAverage(input.readinessValues || [], 5)
  const poorSleep = lowAverage(input.sleepHours || [], 6.5)
  const highFlow =
    input.menstrualBurdenBand === 'high' ||
    input.menstrualBurdenBand === 'very_high' ||
    Boolean(input.menstrualBurdenChangedFromBaseline)
  const interactions = (input.interactions || []).filter(
    (interaction) => interaction.nutrientKey === input.nutrientKey,
  )

  const why: string[] = []
  if (intakeLow) why.push(`recent logged intake appears lower than the current ${nutrientName} target`)
  if (input.supplementAmount && input.supplementAmount > 0) why.push(`${nutrientName} supplement intake was included with food intake`)
  if (persistentSymptoms && relationshipsForInadequacy.length) why.push('logged symptoms have reviewed nutrient-association metadata')
  if (lowEnergy) why.push('reported energy has been below your recent normal range')
  if (lowReadiness) why.push('training readiness has been below your recent normal range')
  if (poorSleep) why.push('sleep has been lower than usual, which can affect energy and recovery signals')
  if (highFlow) why.push('menstrual bleeding burden is elevated or changed from baseline')
  if (ulExceeded) why.push(`estimated intake is above an established ${nutrientName} upper limit for the matched context`)

  if (input.confirmedClinicalState === 'confirmed_toxicity') {
    return {
      nutrientKey: input.nutrientKey,
      nutrientName,
      action: 'safety_warning_clinician_recommendation',
      confidenceCategory: 'confirmed_clinical_data',
      patternState: 'confirmed_toxicity',
      message: safeMessage(`Confirmed clinical information for ${nutrientName} is present. Follow your healthcare professional's guidance.`),
      why: why.length ? why : ['confirmed clinical information was entered explicitly'],
      foodFirst: false,
      clinicianEscalation: true,
      safetyEscalationReason: 'confirmed_clinical_toxicity_record',
      evidenceRelationshipsUsed: relationshipsForExcess,
      interactionsConsidered: interactions,
      algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
    }
  }

  if (input.confirmedClinicalState === 'confirmed_deficiency') {
    return {
      nutrientKey: input.nutrientKey,
      nutrientName,
      action: 'discuss_labs_with_clinician',
      confidenceCategory: 'confirmed_clinical_data',
      patternState: 'confirmed_deficiency',
      message: safeMessage(`Confirmed clinical information for ${nutrientName} is present. Use Anastasis for food, supplement, and symptom context while following clinician guidance.`),
      why: why.length ? why : ['confirmed laboratory or clinician-entered information was entered explicitly'],
      foodFirst: false,
      clinicianEscalation: true,
      safetyEscalationReason: 'confirmed_clinical_deficiency_record',
      evidenceRelationshipsUsed: relationshipsForInadequacy,
      interactionsConsidered: interactions,
      algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
    }
  }

  if (ulExceeded) {
    return {
      nutrientKey: input.nutrientKey,
      nutrientName,
      action: 'safety_warning_clinician_recommendation',
      confidenceCategory: 'stronger_pattern',
      patternState: 'intake_above_established_ul',
      message: safeMessage(`Your logged ${nutrientName} intake is above a reviewed upper-limit reference for this context. Consider reviewing supplement use and discussing this with a healthcare professional.`),
      why,
      foodFirst: false,
      clinicianEscalation: true,
      safetyEscalationReason: 'estimated_intake_above_established_ul',
      evidenceRelationshipsUsed: relationshipsForExcess,
      interactionsConsidered: interactions,
      algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
    }
  }

  if (relationshipsForExcess.length && persistentSymptoms && (input.supplementAmount || 0) > 0) {
    return {
      nutrientKey: input.nutrientKey,
      nutrientName,
      action: 'review_supplement_intake',
      confidenceCategory: 'moderate_pattern',
      patternState: 'possible_excessive_intake',
      message: safeMessage(`Your recent symptoms and ${nutrientName} supplement logs are worth reviewing together. This does not establish toxicity.`),
      why,
      foodFirst: false,
      clinicianEscalation: false,
      safetyEscalationReason: null,
      evidenceRelationshipsUsed: relationshipsForExcess,
      interactionsConsidered: interactions,
      algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
    }
  }

  const multisignalInadequacy =
    intakeLow &&
    (relationshipsForInadequacy.length > 0 || highFlow || lowEnergy || lowReadiness || input.trainingLoadElevated)
  const escalationContext =
    persistentSymptoms &&
    (highFlow || lowReadiness || (relationshipsForInadequacy.length > 0 && !intakeLow) || input.symptomSeverityMax === 10)

  if (multisignalInadequacy && escalationContext) {
    return {
      nutrientKey: input.nutrientKey,
      nutrientName,
      action: 'discuss_labs_with_clinician',
      confidenceCategory: 'stronger_pattern',
      patternState: 'symptom_pattern_possibly_associated_with_inadequacy',
      message: safeMessage(`Your recent inputs include several factors that can be associated with increased ${nutrientName} needs. This does not establish a deficiency. A clinician may determine whether laboratory testing is appropriate if symptoms persist.`),
      why,
      foodFirst: true,
      clinicianEscalation: true,
      safetyEscalationReason: 'persistent_multisignal_pattern',
      evidenceRelationshipsUsed: relationshipsForInadequacy,
      interactionsConsidered: interactions,
      algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
    }
  }

  if (multisignalInadequacy) {
    return {
      nutrientKey: input.nutrientKey,
      nutrientName,
      action: 'food_first_recommendation',
      confidenceCategory: 'moderate_pattern',
      patternState: 'possible_inadequate_intake',
      message: safeMessage(`We've noticed your recent nutrition pattern may be lower in foods rich in ${nutrientName}. Prioritize food sources first and keep logging symptoms, sleep, cycle, and recovery context.`),
      why,
      foodFirst: true,
      clinicianEscalation: false,
      safetyEscalationReason: null,
      evidenceRelationshipsUsed: relationshipsForInadequacy,
      interactionsConsidered: interactions,
      algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
    }
  }

  if (persistentSymptoms && relationshipsForInadequacy.length) {
    return {
      nutrientKey: input.nutrientKey,
      nutrientName,
      action: 'monitor_pattern',
      confidenceCategory: 'low_information',
      patternState: 'symptom_pattern_possibly_associated_with_inadequacy',
      message: safeMessage(`Some logged symptoms have reviewed associations with ${nutrientName}, but symptoms alone do not establish a deficiency. Continue tracking food, supplements, sleep, cycle, and recovery.`),
      why: why.length ? why : ['symptoms were present without enough intake or context data'],
      foodFirst: false,
      clinicianEscalation: false,
      safetyEscalationReason: null,
      evidenceRelationshipsUsed: relationshipsForInadequacy,
      interactionsConsidered: interactions,
      algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
    }
  }

  return {
    nutrientKey: input.nutrientKey,
    nutrientName,
    action: 'no_action',
    confidenceCategory: 'low_information',
    patternState: 'none',
    message: 'No nutrient-specific action is suggested from the currently available data.',
    why: why.length ? why : ['there is not enough converging nutrient-specific information yet'],
    foodFirst: false,
    clinicianEscalation: false,
    safetyEscalationReason: null,
    evidenceRelationshipsUsed: [],
    interactionsConsidered: interactions,
    algorithmVersion: NUTRIENT_INTELLIGENCE_VERSION,
  }
}

export function containsUnsafeSupplementDoseRecommendation(insight: NutrientInsight) {
  return /(?:take|start|use)\s+\d+(\.\d+)?\s*(mg|mcg|iu|g)\b/i.test(insight.message)
}
