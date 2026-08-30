import type { AccountabilityMemory } from './accountabilityTypes'

export function compactAccountabilityMemory(memory?: AccountabilityMemory): AccountabilityMemory {
  const trimList = (items?: string[]) =>
    (items || []).map((item) => item.trim()).filter(Boolean).slice(0, 8)

  return {
    statedGoals: trimList(memory?.statedGoals),
    repeatedStruggles: trimList(memory?.repeatedStruggles),
    successfulPatterns: trimList(memory?.successfulPatterns),
    recentCommitments: trimList(memory?.recentCommitments),
    progressMilestones: trimList(memory?.progressMilestones),
    preferredToneNotes: trimList(memory?.preferredToneNotes),
    routinePatterns: trimList(memory?.routinePatterns),
  }
}

export function firstSupportedMemoryReference(memory?: AccountabilityMemory) {
  const compact = compactAccountabilityMemory(memory)
  return (
    compact.progressMilestones?.[0] ||
    compact.successfulPatterns?.[0] ||
    compact.recentCommitments?.[0] ||
    null
  )
}
