const sensitivePropertyPatterns = [
  /cycle/i,
  /menstrual/i,
  /period/i,
  /bleed/i,
  /flow/i,
  /symptom/i,
  /pain/i,
  /cramp/i,
  /migraine/i,
  /dizziness/i,
  /lightheaded/i,
  /weakness/i,
  /shortness/i,
  /reproductive/i,
  /pregnan/i,
  /postpartum/i,
  /contraception/i,
  /\bhrt\b/i,
  /hormone/i,
  /lab/i,
  /ferritin/i,
  /hemoglobin/i,
  /estradiol/i,
  /progesterone/i,
  /testosterone/i,
  /medication/i,
  /clinician/i,
]

export function sanitizeAnalyticsProperties<T extends Record<string, unknown>>(properties?: T | null) {
  if (!properties) return undefined

  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => {
      return !sensitivePropertyPatterns.some((pattern) => pattern.test(key))
    }),
  ) as Partial<T>
}

export function analyticsPayloadHasSensitiveHealthData(properties?: Record<string, unknown> | null) {
  if (!properties) return false
  return Object.keys(properties).some((key) =>
    sensitivePropertyPatterns.some((pattern) => pattern.test(key)),
  )
}
