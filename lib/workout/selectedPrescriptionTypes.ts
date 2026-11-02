export const SESSION_EQUIPMENT = ['cable', 'machine', 'dumbbell', 'barbell', 'kettlebell', 'bodyweight'] as const
export type SessionEquipmentContext = {
  source: 'session_override'
  equipment: typeof SESSION_EQUIPMENT[number]
  variantId: string
}

/** Explicit session inventory only; never a wildcard, modifier or owner claim. */
export function readSessionEquipmentContext(value: unknown, variantId?: string): Readonly<SessionEquipmentContext> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some(key => !['source', 'equipment', 'variantId'].includes(key)) || row.source !== 'session_override' ||
    typeof row.equipment !== 'string' || !(SESSION_EQUIPMENT as readonly string[]).includes(row.equipment) ||
    typeof row.variantId !== 'string' || !row.variantId || row.variantId.length > 200 || variantId !== undefined && row.variantId !== variantId) return null
  return Object.freeze({ source: 'session_override', equipment: row.equipment as SessionEquipmentContext['equipment'], variantId: row.variantId })
}

export function sameSessionEquipmentContext(left?: Readonly<SessionEquipmentContext> | null, right?: Readonly<SessionEquipmentContext> | null) {
  return !left && !right || Boolean(left && right && left.source === right.source && left.equipment === right.equipment && left.variantId === right.variantId)
}

export type SelectedExercisePrescription = {
  version: 'founder-selected-v1'
  exerciseId: string
  variantId: string
  sets: number
  reps: number
  weightLb: number
  loadType: string
  equipmentContext?: Readonly<SessionEquipmentContext>
}

export type SelectedPrescriptionResponse = {
  status: 'available'
  prescription: SelectedExercisePrescription
} | {
  status: 'unavailable' | 'tracking_only' | 'blocked'
  message: string
  setupHref?: string
}
