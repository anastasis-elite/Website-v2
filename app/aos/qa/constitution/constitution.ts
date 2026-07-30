import { behaviorRules } from './behavior.rules'
import { experienceRules } from './experience.rules'
import { nutritionRules } from './nutrition.rules'
import { recoveryRules } from './recovery.rules'
import { workoutRules } from './workout.rules'
import type { Constitution } from './constitution.types'

export const anastasisConstitution: Constitution = {
  version: '0.1.0-provisional',
  rules: [
    ...workoutRules,
    ...recoveryRules,
    ...nutritionRules,
    ...behaviorRules,
    ...experienceRules,
  ],
}

export function getEnabledConstitutionRules() {
  return anastasisConstitution.rules.filter((rule) => rule.enabled)
}
