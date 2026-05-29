type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'smith'
  | 'band'
  | 'bodyweight'
  | string

type Category = 'compound' | 'isolation' | 'stability' | 'bodyweight' | string

type Args = {
  baseWeight: number
  fromEquipment?: Equipment
  toEquipment?: Equipment
  category?: Category
  equipmentModifier?: number
}

export function roundTrainingWeight(weight: number) {
  if (!weight || Number.isNaN(weight)) return 0

  if (weight < 5) {
    return Math.round(weight * 2) / 2
  }

  if (weight < 20) {
    return Math.round(weight)
  }

  return Math.round(weight / 5) * 5
}

export function getEquipmentAdjustedLoad({
  baseWeight,
  fromEquipment = 'barbell',
  toEquipment = 'barbell',
  category = 'compound',
  equipmentModifier,
}: Args) {
  if (!baseWeight || Number.isNaN(baseWeight)) return 0

  if (typeof equipmentModifier === 'number') {
    return roundTrainingWeight(baseWeight * equipmentModifier)
  }

  if (fromEquipment === toEquipment) {
    return roundTrainingWeight(baseWeight)
  }

  if (fromEquipment === 'barbell' && toEquipment === 'dumbbell') {
    return roundTrainingWeight(baseWeight * 0.42)
  }

  if (fromEquipment === 'dumbbell' && toEquipment === 'barbell') {
    return roundTrainingWeight(baseWeight * 2.25)
  }

  if (toEquipment === 'cable') {
    return roundTrainingWeight(
      baseWeight * (category === 'isolation' ? 0.75 : 0.85)
    )
  }

  if (toEquipment === 'machine') {
    return roundTrainingWeight(
      baseWeight * (category === 'isolation' ? 0.9 : 1.1)
    )
  }

  if (toEquipment === 'smith') {
    return roundTrainingWeight(baseWeight * 1.1)
  }

  if (toEquipment === 'band') {
    return roundTrainingWeight(baseWeight * 0.45)
  }

  return roundTrainingWeight(baseWeight)
}
