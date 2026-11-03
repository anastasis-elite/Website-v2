import type { StreakItem, StreakRequirementDestination } from './types'

export type StreakRequirementEntry = {
  id: StreakItem
  label: string
  description: string
  complete: boolean
  destination?: StreakRequirementDestination
  alternativeDestinations?: StreakRequirementDestination[]
}
export type StreakRequirementProgress = ({
  available: true
  requiredCount: number
  completedCount: number
  secured: boolean
} | {
  available: false
  requiredCount: null
  completedCount: null
  secured: false
}) & {
  entries: StreakRequirementEntry[]
  resetMessage: string | null
}
