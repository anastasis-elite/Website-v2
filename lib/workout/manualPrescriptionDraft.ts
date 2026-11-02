import type { SelectedExercisePrescription } from './selectedPrescriptionTypes'
import { readSessionEquipmentContext } from './selectedPrescriptionTypes'
export type ManualPrescriptionSnapshot = SelectedExercisePrescription

export function prescriptionSnapshot(value: unknown): Readonly<ManualPrescriptionSnapshot> | null {
  if (!value || typeof value !== 'object') return null
  const row = value as ManualPrescriptionSnapshot
  if (typeof row.exerciseId !== 'string' || !row.exerciseId || typeof row.variantId !== 'string' || !row.variantId ||
    row.version !== 'founder-selected-v1' || typeof row.loadType !== 'string' || !row.loadType ||
    !Number.isInteger(row.sets) || row.sets < 1 || row.sets > 100 || !Number.isInteger(row.reps) || row.reps < 1 ||
    !Number.isFinite(row.weightLb) || row.weightLb < 0 || row.weightLb === 0 && row.loadType !== 'bodyweight') return null
  const equipmentContext = row.equipmentContext === undefined ? null : readSessionEquipmentContext(row.equipmentContext, row.variantId)
  if (row.equipmentContext !== undefined && !equipmentContext) return null
  return Object.freeze({ exerciseId: row.exerciseId, variantId: row.variantId, sets: row.sets, reps: row.reps,
    weightLb: row.weightLb, loadType: row.loadType, version: row.version, ...(equipmentContext ? { equipmentContext } : {}) })
}

export function manualDesiredSets(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number' || typeof value === 'string' && !value.trim()) return null
  const count = Number(value)
  return Number.isInteger(count) && count >= 1 && count <= 100 ? count : null
}

export function readManualPrescriptionDraft(value: unknown) {
  const empty = { sets: [] as any[], weight: undefined as string | undefined, reps: undefined as string | undefined,
    weightUnit: undefined as 'lb' | 'kg' | undefined, desiredSetCount: undefined as string | undefined, originalPlannedSets: 0, prescription: null as Readonly<ManualPrescriptionSnapshot> | null,
    equipmentContext: null as ReturnType<typeof readSessionEquipmentContext> }
  // Retain the existing v2 set-array storage format while restoring richer drafts.
  if (Array.isArray(value)) return { ...empty, sets: value.filter(set => set && typeof set === 'object') }
  if (!value || typeof value !== 'object' || (value as any).version !== 3) return empty
  const row = value as any
  return { sets: Array.isArray(row.sets) ? row.sets.filter((set: any) => set && typeof set === 'object') : [],
    weight: typeof row.weight === 'string' ? row.weight : undefined,
    weightUnit: row.weightUnit === 'lb' || row.weightUnit === 'kg' ? row.weightUnit : undefined,
    reps: typeof row.reps === 'string' ? row.reps : undefined,
    desiredSetCount: typeof row.desiredSetCount === 'string' ? row.desiredSetCount : undefined,
    originalPlannedSets: manualDesiredSets(row.originalPlannedSets) || 0,
    prescription: prescriptionSnapshot(row.prescription), equipmentContext: readSessionEquipmentContext(row.equipmentContext) }
}
