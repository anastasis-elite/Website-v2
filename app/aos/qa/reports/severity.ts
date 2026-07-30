export const qaSeverities = ['info', 'low', 'medium', 'high', 'critical'] as const

export type QaSeverity = (typeof qaSeverities)[number]

export function createSeverityTotals(): Record<QaSeverity, number> {
  return {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }
}

export function isQaSeverity(value: string): value is QaSeverity {
  return qaSeverities.includes(value as QaSeverity)
}
