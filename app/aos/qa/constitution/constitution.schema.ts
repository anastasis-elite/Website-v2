import { isQaSeverity } from '../reports/severity'
import type { Constitution, ConstitutionDomain, ConstitutionRule } from './constitution.types'

const domains: ConstitutionDomain[] = ['workout', 'recovery', 'nutrition', 'behavior', 'experience']

export function validateConstitutionRule(rule: ConstitutionRule): string[] {
  const errors: string[] = []

  if (!rule.id) errors.push('Rule id is required.')
  if (!domains.includes(rule.domain)) errors.push(`Rule ${rule.id} has invalid domain.`)
  if (!rule.title) errors.push(`Rule ${rule.id} title is required.`)
  if (!rule.description) errors.push(`Rule ${rule.id} description is required.`)
  if (!isQaSeverity(rule.severity)) errors.push(`Rule ${rule.id} has invalid severity.`)
  if (!Array.isArray(rule.inputs)) errors.push(`Rule ${rule.id} inputs must be an array.`)
  if (!rule.expectedBehavior) errors.push(`Rule ${rule.id} expectedBehavior is required.`)
  if (!rule.rationale) errors.push(`Rule ${rule.id} rationale is required.`)

  return errors
}

export function validateConstitution(constitution: Constitution): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  if (!constitution.version) errors.push('Constitution version is required.')

  for (const rule of constitution.rules) {
    errors.push(...validateConstitutionRule(rule))

    if (ids.has(rule.id)) {
      errors.push(`Duplicate Constitution rule id: ${rule.id}`)
    }

    ids.add(rule.id)
  }

  return errors
}
