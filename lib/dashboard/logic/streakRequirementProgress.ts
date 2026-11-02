import { isDayBlockDate } from '@/lib/day/dayBlockRoutes'
import { getLocalDaypart } from '@/lib/timezone'
import { getStreakRequirementDestinations } from './streakRequirementDestinations'
import type { ProgramTier, StreakItem, StreakRequirementDestination } from './types'

export const STREAK_REQUIREMENT_ITEMS: readonly StreakItem[] = ['dailyCheckIn', 'nutrition', 'hydration', 'workoutOrMovement', 'recovery', 'sleep', 'customTasks']

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

const content: Record<StreakItem, { label: string; description: string }> = {
  dailyCheckIn: { label: 'Daily check-in', description: 'Complete today’s daily check-in.' },
  nutrition: { label: 'Food logged', description: 'Record today’s nutrition.' },
  hydration: { label: 'Water logged', description: 'Record at least 80% of your existing daily water target.' },
  workoutOrMovement: { label: 'Workout or recovery', description: 'Meet your existing workout checkoff or save a recovery activity. Either one counts.' },
  recovery: { label: 'Recovery action', description: 'Save a recovery activity.' },
  sleep: { label: 'Sleep log', description: 'Save sleep duration or quality.' },
  customTasks: { label: 'Day-block tasks', description: 'Complete one existing day-block checklist. The existing daily task checkoff also counts.' },
}

const unavailable = (): StreakRequirementProgress => ({ available: false, requiredCount: null, completedCount: null, secured: false, entries: [], resetMessage: null })
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** Read existing engine evidence without recalculating any streak rule.
 * Optional score/activities never become required work or a secured claim. */
export function getStreakRequirementProgress(flame: unknown, expectedDate?: string, context: {
  programTier?: ProgramTier; now?: string; timezone?: string
} = {}): StreakRequirementProgress {
  if (!record(flame) || !record(flame.requirements)) return unavailable()
  const requirements = flame.requirements
  if (!isDayBlockDate(requirements.date) || expectedDate !== undefined && requirements.date !== expectedDate ||
    !['ember', 'ignite', 'phoenix'].includes(String(requirements.programTier)) ||
    context.programTier !== undefined && requirements.programTier !== context.programTier ||
    !record(requirements.requiredItems) || !record(requirements.completedItems) ||
    typeof flame.streakEligible !== 'boolean' || typeof requirements.streakEligible !== 'boolean') return unavailable()
  const required = requirements.requiredItems, completed = requirements.completedItems
  if (Object.keys(required).some(key => !STREAK_REQUIREMENT_ITEMS.includes(key as StreakItem)) ||
    Object.keys(completed).some(key => !STREAK_REQUIREMENT_ITEMS.includes(key as StreakItem)) ||
    STREAK_REQUIREMENT_ITEMS.some(key => typeof required[key] !== 'boolean' || typeof completed[key] !== 'boolean') || required.dailyCheckIn !== true) return unavailable()
  const items = STREAK_REQUIREMENT_ITEMS.filter(key => required[key] === true)
  const completedCount = items.filter(key => completed[key] === true).length
  const allComplete = completedCount === items.length
  if (flame.streakEligible !== requirements.streakEligible || requirements.streakEligible !== allComplete) return unavailable()
  let block: 'morning' | 'midday' | 'evening' = 'morning'
  if (context.now !== undefined || context.timezone !== undefined) {
    const now = new Date(context.now || '')
    if (!Number.isFinite(now.getTime()) || !context.timezone) return unavailable()
    try { block = getLocalDaypart(now, context.timezone) } catch { return unavailable() }
  }
  const destinations = getStreakRequirementDestinations(requirements.programTier as ProgramTier, { date: requirements.date, block })
  return { available: true, requiredCount: items.length, completedCount, secured: allComplete && flame.streakEligible,
    entries: items.map(id => ({ id, ...content[id], complete: completed[id] === true, destination: destinations[id],
      ...(id === 'workoutOrMovement' && destinations.recovery ? { alternativeDestinations: [destinations.recovery] } : {}) })),
    resetMessage: typeof requirements.resetMessage === 'string' ? requirements.resetMessage : null }
}
