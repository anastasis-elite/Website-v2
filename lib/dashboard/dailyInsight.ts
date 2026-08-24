import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { ProgramTier } from '@/lib/entitlements'

export type DailyInsightCategory =
  | 'motivation'
  | 'recovery'
  | 'schedule'
  | 'workout'
  | 'nutrition'
  | 'progress'
  | 'stress'
  | 'consistency'
  | 'general'

export type DailyInsight = {
  id: string
  date: string
  category: DailyInsightCategory
  message: string
  reason?: string
  action?: {
    type: string
    label: string
    target: string
  }
}

export type DailyInsightContext = {
  tier: ProgramTier
  date: string
  scheduleDensity: 'open' | 'steady' | 'packed'
  openWindowMinutes: number
  nextActionCategory: string
  hasWorkoutToday: boolean
  workoutComplete: boolean
  recoveryRequired: boolean
  lowEnergy: boolean
  highStress: boolean
  nutritionRemaining?: {
    protein?: number
    carbs?: number
    fats?: number
  }
}

function firstOpenWindow(schedule: DailyScheduleState, minimumMinutes = 25) {
  return schedule.openWindows.find((window) => window.minutes >= minimumMinutes) || null
}

function scheduleDensity(schedule: DailyScheduleState): DailyInsightContext['scheduleDensity'] {
  const committedMinutes = schedule.events.reduce((total, event) => {
    if (['cancelled', 'skipped'].includes(event.status)) return total
    return total + Math.max(0, (new Date(event.adjusted_end_at || event.end_at).getTime() - new Date(event.adjusted_start_at || event.start_at).getTime()) / 60000)
  }, 0)
  if (committedMinutes >= 8 * 60 || schedule.events.length >= 8) return 'packed'
  if (committedMinutes >= 4 * 60 || schedule.events.length >= 4) return 'steady'
  return 'open'
}

export function gatherDailyInsightContext({
  tier,
  logic,
  schedule,
}: {
  tier: ProgramTier
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
}): DailyInsightContext {
  const recoveryRequired = Boolean(
    logic.flameState?.requirements?.requiredItems?.recovery &&
      !logic.flameState?.requirements?.completedItems?.recovery,
  )
  const workoutComplete = Boolean(logic.workout?.completed)
  const energy = Number(logic.recoveryCheck?.energy ?? NaN)
  const stress = Number(logic.recoveryCheck?.stress ?? NaN)

  return {
    tier,
    date: schedule.date,
    scheduleDensity: scheduleDensity(schedule),
    openWindowMinutes: firstOpenWindow(schedule)?.minutes || 0,
    nextActionCategory: schedule.nextAction.category,
    hasWorkoutToday: schedule.events.some((event) => event.event_type === 'workout'),
    workoutComplete,
    recoveryRequired,
    lowEnergy: Number.isFinite(energy) && energy <= 3,
    highStress: Number.isFinite(stress) && stress >= 7,
    nutritionRemaining: {
      protein: Number(logic.nutrition?.protein?.remaining ?? NaN) || undefined,
      carbs: Number(logic.nutrition?.carbs?.remaining ?? NaN) || undefined,
      fats: Number(logic.nutrition?.fats?.remaining ?? NaN) || undefined,
    },
  }
}

export function selectDailyInsight(context: DailyInsightContext): DailyInsight {
  const base = { id: `${context.date}-${context.tier}`, date: context.date }

  if (context.lowEnergy || context.recoveryRequired) {
    return {
      ...base,
      category: 'recovery',
      message:
        context.tier === 'phoenix'
          ? 'You do not need to prove anything with intensity today. Follow the recovery signal first, then let the next action be smaller and cleaner.'
          : 'Your body is asking for a steadier pace today. Keep the next action doable instead of forcing intensity.',
      reason: 'Recovery or low-energy context is available.',
      action: { type: 'open_recovery', label: 'Open recovery', target: '/dashboard/recovery' },
    }
  }

  if (context.scheduleDensity === 'packed') {
    return {
      ...base,
      category: 'schedule',
      message:
        context.openWindowMinutes >= 25
          ? `Today is crowded, so protect the clearest ${context.openWindowMinutes}-minute opening instead of negotiating with the whole day.`
          : 'Today is already asking a lot from you. Focus on the next useful action, not the entire list.',
      reason: 'Calendar density is high.',
      action: { type: 'view_day', label: 'View day', target: '/dashboard/schedule' },
    }
  }

  if (context.nextActionCategory === 'workout' && context.openWindowMinutes >= 25) {
    return {
      ...base,
      category: 'workout',
      message: `The time is already there: you have a ${context.openWindowMinutes}-minute opening. Starting is the highest-value part of this block.`,
      reason: 'Workout is next and an open window exists.',
      action: { type: 'start_workout', label: 'Start workout', target: `/dashboard/program/${context.tier}/workout` },
    }
  }

  if (context.nextActionCategory === 'meal' || (context.nutritionRemaining?.protein || 0) > 30) {
    return {
      ...base,
      category: 'nutrition',
      message:
        context.tier === 'ember'
          ? 'Use macros as information today, not pressure. One protein-forward choice is enough to make the next log easier.'
          : 'Make the next meal simple and protein-forward. The goal is less decision weight, not a perfect plate.',
      reason: 'Nutrition is the next relevant system.',
      action: { type: 'open_nutrition', label: context.tier === 'ember' ? 'Add macros' : 'Log meal', target: '/dashboard/nutrition' },
    }
  }

  if (context.workoutComplete) {
    return {
      ...base,
      category: 'progress',
      message: 'You have already followed through on a meaningful piece of today. Do not add more just because momentum feels available.',
      reason: 'Workout completion is available.',
      action: { type: 'view_progress', label: 'View progress', target: '/dashboard/assessment' },
    }
  }

  return {
    ...base,
    category: 'general',
    message: 'Keep today narrow. Choose the next clear action and let Anastasis handle the order.',
    reason: 'Fallback used because limited contextual inputs are available.',
    action: { type: 'view_day', label: 'View day', target: '/dashboard/schedule' },
  }
}

export function buildDailyInsight(input: {
  tier: ProgramTier
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
}) {
  return selectDailyInsight(gatherDailyInsightContext(input))
}
