import { mealEntryHref, WATER_ENTRY_HREF } from '@/lib/nutrition/loggingRoutes'
import { dayBlockHref, isDayBlockDate, type DayBlock } from '@/lib/day/dayBlockRoutes'
import type {
  ProgramTier,
  StreakItem,
  StreakRequirementDestination,
} from '@/lib/dashboard/logic/types'

export function getProgramWorkoutHref(programTier: ProgramTier) {
  return `/dashboard/program/${programTier}/workout`
}

export function getProgramDashboardHref(programTier: ProgramTier) {
  return `/dashboard/program/${programTier}`
}

export function getStreakRequirementDestinations(
  programTier: ProgramTier,
  context: { date?: string; block?: DayBlock } = {},
): Partial<Record<StreakItem, StreakRequirementDestination>> {
  return {
    nutrition: {
      href: mealEntryHref(programTier),
      ariaLabel:
        programTier === 'ember' ? "Open Nutrition Guidance" : "Open Meal Entry to complete today's food logging streak requirement",
    },
    hydration: {
      href: WATER_ENTRY_HREF,
      ariaLabel:
        "Log Water to complete today's hydration streak requirement",
    },
    workoutOrMovement: {
      href: getProgramWorkoutHref(programTier),
      ariaLabel:
        "Open Workout to complete today's workout or movement streak requirement",
    },
    dailyCheckIn: {
      href: '/dashboard/check-in',
      ariaLabel:
        "Open Daily Check-In to complete today's streak requirement",
    },
    recovery: {
      href: '/dashboard/recovery',
      ariaLabel:
        "Open Recovery to complete today's recovery streak requirement",
    },
    sleep: {
      href: '/dashboard/sleep',
      ariaLabel:
        "Open Sleep to complete today's sleep logging streak requirement",
    },
    customTasks: {
      href: isDayBlockDate(context.date) ? dayBlockHref(context.block || 'morning', context.date) : `/dashboard/day/${context.block || 'morning'}`,
      ariaLabel:
        "Open the day-block checklist to complete today's task streak requirement",
    },
  }
}
