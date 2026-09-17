export const HEALTH_PROVENANCE_CATEGORIES = [
  'measured',
  'self_reported',
  'calculated',
  'algorithmic_wellness_observation',
  'clinician_provided',
  'user_provided_lab',
] as const

export type HealthProvenanceCategory = (typeof HEALTH_PROVENANCE_CATEGORIES)[number]

export type HealthDatumKind =
  | 'menstrual_product_log'
  | 'cycle_symptom'
  | 'flow_burden'
  | 'physiology_pattern'
  | 'lab_value'
  | 'medical_diagnosis'
  | 'medication_hrt_supplement'
  | 'body_measurement'
  | 'posture_assessment'
  | 'recovery_metric'

export type HealthDatumProvenance = {
  kind: HealthDatumKind
  provenanceCategory: HealthProvenanceCategory
  sourceLabel: string
  mayInfluenceWellnessRecommendations: boolean
  mayBeTreatedAsDiagnosis: boolean
}

export function classifyHealthDatumProvenance({
  kind,
  source,
}: {
  kind: HealthDatumKind
  source?: 'member' | 'device' | 'calculation' | 'algorithm' | 'clinician' | 'user_lab'
}): HealthDatumProvenance {
  if (kind === 'physiology_pattern') {
    return {
      kind,
      provenanceCategory: 'algorithmic_wellness_observation',
      sourceLabel: 'Anastasis algorithmic wellness observation',
      mayInfluenceWellnessRecommendations: true,
      mayBeTreatedAsDiagnosis: false,
    }
  }

  if (kind === 'flow_burden') {
    return {
      kind,
      provenanceCategory: 'calculated',
      sourceLabel: 'Anastasis calculated menstrual flow burden',
      mayInfluenceWellnessRecommendations: true,
      mayBeTreatedAsDiagnosis: false,
    }
  }

  if (kind === 'lab_value') {
    const provenanceCategory = source === 'clinician' ? 'clinician_provided' : 'user_provided_lab'
    return {
      kind,
      provenanceCategory,
      sourceLabel: provenanceCategory === 'clinician_provided' ? 'Clinician-provided lab' : 'User-provided lab',
      mayInfluenceWellnessRecommendations: false,
      mayBeTreatedAsDiagnosis: false,
    }
  }

  if (kind === 'medical_diagnosis') {
    return {
      kind,
      provenanceCategory: 'clinician_provided',
      sourceLabel: 'Clinician-provided diagnosis',
      mayInfluenceWellnessRecommendations: false,
      mayBeTreatedAsDiagnosis: true,
    }
  }

  if (source === 'device') {
    return {
      kind,
      provenanceCategory: 'measured',
      sourceLabel: 'Measured or device-synced data',
      mayInfluenceWellnessRecommendations: true,
      mayBeTreatedAsDiagnosis: false,
    }
  }

  if (source === 'calculation') {
    return {
      kind,
      provenanceCategory: 'calculated',
      sourceLabel: 'Calculated data',
      mayInfluenceWellnessRecommendations: true,
      mayBeTreatedAsDiagnosis: false,
    }
  }

  return {
    kind,
    provenanceCategory: 'self_reported',
    sourceLabel: 'Member-recorded data',
    mayInfluenceWellnessRecommendations: true,
    mayBeTreatedAsDiagnosis: false,
  }
}
