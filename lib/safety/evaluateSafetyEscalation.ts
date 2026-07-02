export type SafetyFlag = {
  code: string
  label: string
  urgency: 'emergency' | 'urgent'
}

const rules: Array<SafetyFlag & { patterns: RegExp[] }> = [
  { code: 'chest_pain', label: 'Chest pain', urgency: 'emergency', patterns: [/chest pain/i, /chest pressure/i] },
  { code: 'fainting', label: 'Fainting or loss of consciousness', urgency: 'emergency', patterns: [/faint(?:ed|ing)?/i, /loss of consciousness/i, /passed out/i] },
  { code: 'severe_shortness_of_breath', label: 'Severe shortness of breath', urgency: 'emergency', patterns: [/severe shortness of breath/i, /can(?:not|'t) breathe/i, /difficulty breathing/i] },
  { code: 'suicidal_thoughts', label: 'Suicidal thoughts or self-harm risk', urgency: 'emergency', patterns: [/suicid/i, /kill myself/i, /self[- ]?harm/i, /do not want to live/i] },
  { code: 'pregnancy_complication', label: 'Possible pregnancy complication', urgency: 'emergency', patterns: [/pregnan.{0,30}(bleed|pain|cramp|complication)/i, /ectopic/i] },
  { code: 'severe_bleeding', label: 'Severe bleeding', urgency: 'emergency', patterns: [/severe bleeding/i, /heavy bleeding/i, /hemorrhag/i] },
  { code: 'eating_disorder_behavior', label: 'Possible eating-disorder behavior', urgency: 'urgent', patterns: [/purging/i, /self[- ]?induced vomit/i, /binge and purge/i, /starving myself/i, /eating disorder/i] },
  { code: 'acute_injury', label: 'Acute injury', urgency: 'urgent', patterns: [/acute injury/i, /possible fracture/i, /heard a pop/i, /cannot bear weight/i] },
  { code: 'severe_dizziness', label: 'Severe dizziness', urgency: 'urgent', patterns: [/severe dizziness/i, /room is spinning/i, /near faint/i] },
]

export function evaluateSafetyEscalation(input: unknown): SafetyFlag[] {
  const text = flatten(input).join(' ')
  return rules.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map(({ patterns: _patterns, ...flag }) => flag)
}

function flatten(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(flatten)
  if (value && typeof value === 'object') return Object.values(value).flatMap(flatten)
  return []
}
