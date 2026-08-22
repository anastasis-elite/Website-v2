import type { NormalizedPoint } from './landmarks'

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function normalizePoint(
  point: { x: number; y: number; confidence?: number | null },
  imageWidth: number,
  imageHeight: number,
): NormalizedPoint {
  return {
    x: clamp01(point.x / imageWidth),
    y: clamp01(point.y / imageHeight),
    confidence: point.confidence ?? null,
  }
}

export function midpoint(
  a: NormalizedPoint | null | undefined,
  b: NormalizedPoint | null | undefined,
  confidence?: number | null,
): NormalizedPoint | null {
  if (!a || !b) return null
  return {
    x: clamp01((a.x + b.x) / 2),
    y: clamp01((a.y + b.y) / 2),
    confidence: confidence ?? averageConfidence(a, b),
  }
}

export function averageConfidence(
  ...points: Array<NormalizedPoint | null | undefined>
) {
  const values = points
    .map((point) => point?.confidence)
    .filter((value): value is number => typeof value === 'number')

  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function pointChanged(
  a: NormalizedPoint | null | undefined,
  b: NormalizedPoint | null | undefined,
) {
  if (!a && !b) return false
  if (!a || !b) return true
  return Math.abs(a.x - b.x) > 0.002 || Math.abs(a.y - b.y) > 0.002
}

export function angleDegrees(a: NormalizedPoint, b: NormalizedPoint) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

export function normalizedDistance(a: NormalizedPoint, b: NormalizedPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}
