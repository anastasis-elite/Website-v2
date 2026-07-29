export const SORENESS_REGIONS = [
  { key: 'neck', label: 'Neck' },
  { key: 'upper_traps', label: 'Upper traps' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'upper_back', label: 'Upper back' },
  { key: 'lats', label: 'Lats' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'forearms', label: 'Forearms' },
  { key: 'lower_back', label: 'Lower back' },
  { key: 'core', label: 'Core' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'hip_flexors', label: 'Hip flexors' },
  { key: 'quads', label: 'Quads' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'adductors', label: 'Adductors' },
  { key: 'calves', label: 'Calves' },
  { key: 'feet_ankles', label: 'Feet and ankles' },
] as const

export type SorenessRegionKey = (typeof SORENESS_REGIONS)[number]['key']

const SORENESS_REGION_KEYS = new Set<string>(
  SORENESS_REGIONS.map((region) => region.key)
)

export function isSorenessRegionKey(value: unknown): value is SorenessRegionKey {
  return typeof value === 'string' && SORENESS_REGION_KEYS.has(value)
}
