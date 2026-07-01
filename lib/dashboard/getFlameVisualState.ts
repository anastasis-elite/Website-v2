export type FlameVisualState =
  | 'ember'
  | 'smolder'
  | 'single_flame'
  | 'strong_flame'
  | 'roaring_fire'

export function getFlameVisualState(flameScore: number): FlameVisualState {
  const score = Math.max(0, Math.min(100, Number(flameScore) || 0))

  if (score <= 20) return 'ember'
  if (score <= 40) return 'smolder'
  if (score <= 60) return 'single_flame'
  if (score <= 80) return 'strong_flame'

  return 'roaring_fire'
}
