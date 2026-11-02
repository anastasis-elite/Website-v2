export type SelectedExercisePrescription = {
  version: 'founder-selected-v1'
  exerciseId: string
  variantId: string
  sets: number
  reps: number
  weightLb: number
  loadType: string
}

export type SelectedPrescriptionResponse = {
  status: 'available'
  prescription: SelectedExercisePrescription
} | {
  status: 'unavailable' | 'tracking_only' | 'blocked'
  message: string
  setupHref?: string
}
