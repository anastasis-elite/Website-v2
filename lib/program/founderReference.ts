import { getEquipmentAdjustedLoad } from '@/lib/program/getEquipmentAdjustedLoad'
import masterKey from '@/data/reference/masterKey.json'
import exerciseVariants from '@/data/reference/exerciseVariants.json'

const normalizeName = (value: unknown) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')

/** The exercise names a coefficient; the assessment key names its measured input. */
export function resolveFounderExerciseReference(exerciseName: unknown, references: any[] = masterKey, variantGroups: any[] = exerciseVariants):
  | { status: 'resolved'; reference: any; group: any | null }
  | { status: 'unavailable'; reason: string } {
  const name = normalizeName(exerciseName)
  const matchingReferences = references.filter(row => normalizeName(row.exercise) === name)
  if (matchingReferences.length !== 1) return { status: 'unavailable', reason: matchingReferences.length ? 'Ambiguous exercise reference.' : 'No exact exercise reference.' }
  const groups = variantGroups.filter(group =>
    [group.display_name, ...(group.aliases || []), ...(group.variants || []).map((variant: any) => variant.name)]
      .some(value => normalizeName(value) === name))
  if (groups.length > 1) return { status: 'unavailable', reason: 'Ambiguous exercise variant reference.' }
  const group = groups[0] || null
  if (group?.assessment_key && group.assessment_key !== matchingReferences[0].assessment_key) {
    return { status: 'unavailable', reason: 'Conflicting exercise assessment reference.' }
  }
  if (group) {
    if (!Array.isArray(group.variants) || !group.variants.length || group.variants.some((variant: any) => typeof variant.id !== 'string' || !variant.id)) {
      return { status: 'unavailable', reason: 'Exercise variant identity is unavailable.' }
    }
    if (new Set(group.variants.map((variant: any) => variant.id)).size !== group.variants.length) {
      return { status: 'unavailable', reason: 'Ambiguous exercise variant identity.' }
    }
  }
  return { status: 'resolved', reference: matchingReferences[0], group }
}

export function getFounderIntensityKey(program: string) {
  switch (program) {
    case 'ember':
      return 'ember_if'
    case 'ignite':
      return 'ignite_if'
    case 'phoenixHypertrophy':
      return 'phoenix_hypertrophy_if'
    case 'phoenixStrength':
      return 'phoenix_strength_if'
    case 'phoenixBodybuilding':
      return 'phoenix_bodybuilding_if'
    case 'phoenixEndurance':
      return 'phoenix_endurance_if'
    case 'phoenixRecomposition':
      return 'phoenix_recomposition_if'
    case 'phoenixWaistCincher':
      return 'phoenix_waist_cincher_if'
    case 'phoenixGluteSculpt':
      return 'phoenix_glute_sculpt_if'
    default:
      return 'ember_if'
  }
}


function roundToNearest5(num: number) {
  if (!num || Number.isNaN(num)) return 0

  if (num < 20) {
    return Math.round(num)
  }

  return Math.round(num / 5) * 5
}

/** Reuse the established formula rounding and equipment conversion for a verified derived 1RM. */
export function calculateFounderLoadFromEstimated1RM({ estimated1RM, intensityFactor, repMultiplier, group, variant, bodyweight }: {
  estimated1RM: number; intensityFactor: number; repMultiplier: number; group: any; variant: any; bodyweight: boolean
}) {
  const baseCalculatedWeight = roundToNearest5(estimated1RM * intensityFactor * repMultiplier)
  const adjustedWeight = bodyweight ? 0 : getEquipmentAdjustedLoad({
    baseWeight: baseCalculatedWeight,
    fromEquipment: group?.base_equipment || variant?.equipment,
    toEquipment: variant?.equipment,
    category: group?.category || 'compound',
    equipmentModifier: variant?.equipment_modifier,
  })
  return { estimated1RM, baseCalculatedWeight, adjustedWeight }
}
