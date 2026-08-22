import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import type { ProgramTier, TierCapabilities } from '@/lib/entitlements'

export type WhatsNextType =
  | 'calendar_event'
  | 'workout'
  | 'nutrition'
  | 'hydration'
  | 'recovery'
  | 'assessment'
  | 'check_in'
  | 'none'

export type WhatsNextAction = {
  label: string
  href: string
  intent?: 'primary' | 'secondary'
}

export type WhatsNextState = {
  type: WhatsNextType
  title: string
  subtitle?: string
  startTime?: string
  endTime?: string
  priority: number
  data?: unknown
  primaryAction?: WhatsNextAction
  secondaryActions?: WhatsNextAction[]
}

type BuildWhatsNextInput = {
  tier: ProgramTier
  capabilities: TierCapabilities
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
  recipes?: PhoenixRecipe[]
}

function eventStart(event: ScheduleEvent) {
  return event.adjusted_start_at || event.start_at
}

function eventEnd(event: ScheduleEvent) {
  return event.adjusted_end_at || event.end_at
}

function eventIsActive(event: ScheduleEvent, now: string) {
  const current = new Date(now).getTime()
  return new Date(eventStart(event)).getTime() <= current && new Date(eventEnd(event)).getTime() >= current
}

function isCalendarCommitment(event: ScheduleEvent) {
  return !['workout', 'meal', 'hydration', 'recovery', 'assessment', 'check_in', 'sleep'].includes(event.event_type)
}

function durationText(duration: any) {
  if (!duration) return null
  if (typeof duration.minutes === 'number') return `${duration.minutes} minutes`
  if (typeof duration.minimumMinutes === 'number' && typeof duration.maximumMinutes === 'number') {
    return `${duration.minimumMinutes}-${duration.maximumMinutes} minutes`
  }
  return null
}

function workoutData(logic: ProgramLogicOutput) {
  const assigned = logic.workoutDecision.assignedWorkout || {}
  const exercises = Array.isArray(assigned.exercises) ? assigned.exercises : []
  return {
    name: logic.workout.title || assigned.day_name || 'Workout',
    durationMinutes: logic.workout.durationMinutes,
    exercises: exercises.slice(0, 3).map((exercise: any) => String(exercise.display_name || exercise.name || exercise.exercise || 'Exercise')),
    exerciseCount: exercises.length,
  }
}

function nutritionState({ tier, capabilities, logic, recipes }: BuildWhatsNextInput): WhatsNextState {
  if (capabilities.nutrition === 'recommended_meal') {
    const recipe = recipes?.[0] || null
    return {
      type: 'nutrition',
      title: recipe?.title || 'Recommended Meal',
      subtitle: recipe ? `${recipe.macros.protein}g protein · ${recipe.macros.carbs}g carbs · ${recipe.macros.fats}g fat` : logic.nutrition.mealSuggestions[0],
      priority: 70,
      data: { mode: 'recommended_meal', recipe },
      primaryAction: { label: recipe ? 'Log Meal' : 'Open Nutrition', href: '/dashboard/nutrition#phoenix-recipes' },
      secondaryActions: [{ label: 'Adjust', href: '/dashboard/nutrition' }],
    }
  }

  if (capabilities.nutrition === 'meal_logging') {
    return {
      type: 'nutrition',
      title: 'Add Meal',
      subtitle: logic.nutrition.mealSuggestions[0],
      priority: 60,
      data: { mode: 'meal_logging', tier },
      primaryAction: { label: 'Add Meal', href: '/dashboard/nutrition#aos-food-logger' },
    }
  }

  return {
    type: 'nutrition',
    title: 'Add Macros',
    subtitle: `${logic.nutrition.protein.remaining}g protein · ${logic.nutrition.carbs.remaining}g carbs · ${logic.nutrition.fats.remaining}g fat remaining`,
    priority: 50,
    data: { mode: 'macro_entry', tier },
    primaryAction: { label: 'Add Macros', href: '/dashboard/nutrition#aos-macro-entry' },
  }
}

function recoveryState({ capabilities, logic }: BuildWhatsNextInput): WhatsNextState {
  const action = logic.recoveryActions[0] || null
  const actionDuration = durationText(action?.duration)

  if (capabilities.recovery === 'directed') {
    return {
      type: 'recovery',
      title: action ? `Next: ${action.label}` : 'Next: Recovery',
      subtitle: actionDuration || logic.recoveryStatus.reasoning,
      priority: 75,
      data: { mode: 'directed', action },
      primaryAction: { label: 'Open Recovery', href: '/dashboard/recovery' },
      secondaryActions: [{ label: 'Defer', href: '/dashboard/schedule' }],
    }
  }

  if (capabilities.recovery === 'recommended') {
    return {
      type: 'recovery',
      title: action ? `Recommended: ${action.label}` : 'Recommended Recovery',
      subtitle: actionDuration || logic.recoveryStatus.reasoning,
      priority: 65,
      data: { mode: 'recommended', action },
      primaryAction: { label: 'Open Recovery', href: '/dashboard/recovery' },
    }
  }

  return {
    type: 'recovery',
    title: 'Recovery',
    subtitle: "It's time for recovery.",
    priority: 45,
    data: { mode: 'basic' },
    primaryAction: { label: 'Open Recovery', href: '/dashboard/recovery' },
  }
}

function calendarState(event: ScheduleEvent | null): WhatsNextState {
  if (!event) {
    return {
      type: 'none',
      title: 'Open window',
      subtitle: 'No Anastasis action needs priority right now.',
      priority: 0,
    }
  }

  return {
    type: 'calendar_event',
    title: event.title,
    subtitle: event.description || event.event_type.replaceAll('_', ' '),
    startTime: eventStart(event),
    endTime: eventEnd(event),
    priority: 10,
    data: { event },
    primaryAction: event.action_route ? { label: 'Open', href: event.action_route } : undefined,
  }
}

export function buildWhatsNextState(input: BuildWhatsNextInput): WhatsNextState {
  const { capabilities, logic, schedule } = input
  const activeEvent = schedule.events.find((event) => eventIsActive(event, schedule.now)) || null
  const activeCalendarEvent = activeEvent && isCalendarCommitment(activeEvent) ? activeEvent : null
  const next = schedule.nextAction

  if (activeCalendarEvent && !['critical', 'high'].includes(next.urgency)) {
    return calendarState(activeCalendarEvent)
  }

  if (next.category === 'workout' && capabilities.workoutDisplay) {
    const data = workoutData(logic)
    return {
      type: 'workout',
      title: data.name,
      subtitle: `${data.durationMinutes || 'Planned'} min · ${data.exerciseCount} exercise${data.exerciseCount === 1 ? '' : 's'}`,
      startTime: next.start_at || undefined,
      priority: 80,
      data,
      primaryAction: { label: 'Start Workout', href: next.action_route || `/dashboard/program/${input.tier}/workout` },
    }
  }

  if (next.category === 'meal') return nutritionState(input)
  if (next.category === 'hydration') {
    return {
      type: 'hydration',
      title: 'Hydration',
      subtitle: logic.hydration.prompt,
      startTime: next.start_at || undefined,
      priority: 55,
      data: { remaining: logic.hydration.remaining, target: logic.hydration.target },
      primaryAction: { label: 'Add Water', href: '/dashboard/nutrition#hydration' },
    }
  }
  if (next.category === 'recovery' || (logic.flameState.requirements.requiredItems.recovery && !logic.flameState.requirements.completedItems.recovery)) return recoveryState(input)
  if (next.category === 'assessment') {
    return {
      type: 'assessment',
      title: 'Assessment',
      subtitle: 'Complete the next assessment step.',
      startTime: next.start_at || undefined,
      priority: 60,
      primaryAction: { label: 'Open Assessment', href: next.action_route || '/dashboard/assessment' },
    }
  }
  if (next.category === 'check_in') {
    return {
      type: 'check_in',
      title: 'Daily Check-In',
      subtitle: 'Update sleep, energy, stress, soreness, and symptoms.',
      startTime: next.start_at || undefined,
      priority: 60,
      primaryAction: { label: 'Check In', href: next.action_route || '/dashboard/check-in' },
    }
  }

  return calendarState(activeEvent || schedule.nextEvent)
}
