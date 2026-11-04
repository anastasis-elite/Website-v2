export type LoadGuidanceStatus = 'not_calculated' | 'unverified'

export function hasNoCalculatedLoad(exercise: any): boolean {
  return exercise?.load_guidance_status === 'not_calculated' || exercise?.load_guidance_status === 'unverified'
}

/** Keep the prescribed movement and dose available for actual logging without
 * presenting an unknown external load as a calculated zero-load prescription. */
export function withoutCalculatedLoad(exercise: any, status: LoadGuidanceStatus, reason: string) {
  const projected = { ...exercise,
    baseline_weight: null, calculated_weight: null, cycle_adjusted_weight: null, recommended_weight: null,
    load_guidance_status: status, load_guidance_reason: reason,
  }
  for (const field of ['prescription_calculation', 'estimated_1rm', 'intensity_factor', 'rep_multiplier',
    'prescription_status', 'prescription_unavailable_reason']) delete projected[field]
  return projected
}
