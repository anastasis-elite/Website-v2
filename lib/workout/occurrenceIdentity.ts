export type GeneratedWorkoutCompletionEvidence = {
  ownerUserId: string
  clientId: string
  date: string
  dayName: string | null
  planKeys: string[]
  sessionId: string | null
  completedAt: string | null
}

// Kept separate from server-only signature verification for client-safe Schedule adapters.
export function generatedWorkoutOccurrenceCompleted(evidence: GeneratedWorkoutCompletionEvidence | null | undefined, occurrence: { userId: string; clientId: string; date: string }): boolean {
  return Boolean(evidence?.sessionId && evidence.ownerUserId === occurrence.userId && evidence.clientId === occurrence.clientId &&
    evidence.date === occurrence.date && evidence.dayName && evidence.planKeys.length)
}
