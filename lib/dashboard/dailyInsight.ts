import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { ProgramTier } from '@/lib/entitlements'
import {
  evaluateResilience,
  type ResilienceEngineInput,
  type ResilienceEvaluation,
} from './resilienceEngine'
import * as accountabilityEngine from '@/lib/accountability/accountabilityEngine'
import * as astrologyProfile from '@/lib/accountability/astrologyProfile'
import type {
  AccountabilityBehaviorSummary,
  AccountabilityMemory,
  AccountabilityPreferences,
  AccountabilityResponse,
  NatalProfile,
  PartnerPersona,
} from '@/lib/accountability/accountabilityTypes'

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
  accountability?: AccountabilityResponse
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
  resilienceInput: ResilienceEngineInput
  resilience: ResilienceEvaluation
  accountability?: {
    preferences?: AccountabilityPreferences
    persona?: PartnerPersona
    natalProfile?: NatalProfile
    memory?: AccountabilityMemory
    behaviorSummary?: AccountabilityBehaviorSummary
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
  const resilienceInput: ResilienceEngineInput = {
    sleepHours: logic.sleep?.hours ?? logic.passiveHealth?.sleepDurationHours ?? null,
    sleepQuality: logic.recoveryCheck?.sleepQuality ?? logic.sleep?.quality ?? null,
    hrv: logic.passiveHealth?.hrv ?? null,
    restingHeartRate: logic.passiveHealth?.restingHeartRate ?? null,
    respiratoryRate: logic.passiveHealth?.respiratoryRate ?? null,
    bodyTemperature: logic.passiveHealth?.bodyTemperature ?? null,
    energy: logic.recoveryCheck?.energy ?? null,
    stress: logic.recoveryCheck?.stress ?? null,
    soreness: logic.recoveryCheck?.soreness ?? null,
    symptomSeverity: logic.symptoms?.severity ?? null,
    symptomRedFlag: Boolean(logic.symptoms?.redFlag),
    recoveryRequired,
    recoveryStatus: logic.recoveryStatus?.status ?? null,
    fuelStatus: logic.fuelReadiness?.status ?? null,
    hydrationStatus: logic.hydration?.status ?? null,
    hydrationPercent: logic.hydration?.percent ?? null,
    calories: logic.nutrition?.calories,
    protein: logic.nutrition?.protein,
    carbs: logic.nutrition?.carbs,
    fats: logic.nutrition?.fats,
    workoutMinutes: logic.passiveHealth?.workoutMinutes ?? null,
    steps: logic.passiveHealth?.steps ?? null,
    activeEnergy: logic.passiveHealth?.activeEnergy ?? null,
    hasWorkoutToday: schedule.events.some((event) => event.event_type === 'workout'),
    workoutComplete,
    missedWorkoutYesterday: logic.flameState?.requirements?.missedDayCount === 1 && !logic.execution?.workoutComplete,
    missedDayCount: logic.flameState?.requirements?.missedDayCount ?? null,
    scheduleDensity: scheduleDensity(schedule),
    openWindowMinutes: firstOpenWindow(schedule)?.minutes || 0,
    nextActionCategory: schedule.nextAction.category,
    canTrain: logic.workoutDecision?.canTrain,
    workoutAdjustmentLevel: logic.workoutDecision?.adjustmentLevel ?? null,
    allowLoadProgression: logic.workoutDecision?.allowLoadProgression,
    allowEnduranceProgression: logic.workoutDecision?.allowEnduranceProgression,
  }
  const resilience = evaluateResilience(resilienceInput)

  return {
    tier,
    date: schedule.date,
    scheduleDensity: resilienceInput.scheduleDensity || scheduleDensity(schedule),
    openWindowMinutes: resilienceInput.openWindowMinutes || 0,
    nextActionCategory: schedule.nextAction.category,
    hasWorkoutToday: Boolean(resilienceInput.hasWorkoutToday),
    workoutComplete,
    recoveryRequired,
    lowEnergy: Number.isFinite(energy) && energy <= 3,
    highStress: Number.isFinite(stress) && stress >= 7,
    nutritionRemaining: {
      protein: Number(logic.nutrition?.protein?.remaining ?? NaN) || undefined,
      carbs: Number(logic.nutrition?.carbs?.remaining ?? NaN) || undefined,
      fats: Number(logic.nutrition?.fats?.remaining ?? NaN) || undefined,
    },
    resilienceInput,
    resilience,
    accountability: {
      preferences: logic.client?.accountability?.preferences as AccountabilityPreferences | undefined,
      persona: logic.client?.accountability?.persona as PartnerPersona | undefined,
      natalProfile: astrologyProfile.buildNatalProfile
        ? astrologyProfile.buildNatalProfile({
            storedProfile: logic.client?.accountability?.natalProfile as NatalProfile | undefined,
          })
        : undefined,
      memory: logic.client?.accountability?.memory as AccountabilityMemory | undefined,
      behaviorSummary: logic.client?.accountability?.behaviorSummary as AccountabilityBehaviorSummary | undefined,
    },
  }
}

export function selectDailyInsight(context: DailyInsightContext): DailyInsight {
  const base = { id: `${context.date}-${context.tier}`, date: context.date }
  const { resilience } = context

  if (resilience.priority === 'safety') {
    return {
      ...base,
      category: 'recovery',
      message:
        'Your current signals call for the existing recovery guidance first. Do not add training stress until those signals settle.',
      reason: resilience.recommendations[0],
      action: { type: 'open_recovery', label: 'Open recovery', target: '/dashboard/recovery' },
    }
  }

  if (resilience.priority === 'recovery') {
    return {
      ...base,
      category: 'recovery',
      message:
        context.resilienceInput.workoutMinutes || context.resilienceInput.activeEnergy
          ? 'Your recovery signals are lower while your recent output is still high. Today will benefit more from recovery than another hard session.'
          : context.tier === 'phoenix'
            ? 'You do not need to prove anything with intensity today. Follow the recovery signal first, then let the next action be smaller and cleaner.'
            : 'Your body is asking for a steadier pace today. Keep the next action doable instead of forcing intensity.',
      reason: resilience.recommendations[0],
      action: { type: 'open_recovery', label: 'Open recovery', target: '/dashboard/recovery' },
    }
  }

  if (resilience.priority === 'fueling') {
    return {
      ...base,
      category: 'nutrition',
      message:
        'Your activity and recovery signals point to fueling as the priority. Eat enough to support adaptation before adding more intensity.',
      reason: resilience.recommendations[0],
      action: { type: 'open_nutrition', label: context.tier === 'ember' ? 'Add macros' : 'Log meal', target: '/dashboard/nutrition' },
    }
  }

  if (resilience.priority === 'hydration') {
    return {
      ...base,
      category: 'nutrition',
      message:
        'Hydration is the clearest support signal today. Stabilize water and electrolytes before asking your body for more output.',
      reason: resilience.recommendations[0],
      action: { type: 'open_nutrition', label: context.tier === 'ember' ? 'Add macros' : 'Log meal', target: '/dashboard/nutrition' },
    }
  }

  if (resilience.priority === 'schedule_protection') {
    return {
      ...base,
      category: 'schedule',
      message:
        'Your schedule is packed while stress or recovery is already strained. Protect capacity today instead of adding another optional task.',
      reason: resilience.recommendations[0],
      action: { type: 'view_day', label: 'View day', target: '/dashboard/schedule' },
    }
  }

  if (resilience.priority === 'normal_return') {
    return {
      ...base,
      category: 'consistency',
      message:
        'Yesterday does not need to be compensated for. Your current signals support returning to today’s plan at the normal dose.',
      reason: resilience.recommendations[0],
      action: { type: 'view_day', label: 'View day', target: '/dashboard/schedule' },
    }
  }

  if (resilience.priority === 'training' && context.nextActionCategory === 'workout' && context.openWindowMinutes >= 25) {
    return {
      ...base,
      category: 'workout',
      message:
        'Your recovery is strong, but movement has been below your normal range. Your body is ready for more stimulus today.',
      reason: resilience.recommendations[0],
      action: { type: 'start_workout', label: 'Start workout', target: `/dashboard/program/${context.tier}/workout` },
    }
  }

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
  const context = gatherDailyInsightContext(input)
  const insight = selectDailyInsight(context)
  if (!accountabilityEngine.runAccountabilityPartnerEngine) return insight

  return {
    ...insight,
    accountability: accountabilityEngine.runAccountabilityPartnerEngine({
      clientId: input.logic.client?.id,
      resilienceState: context.resilience,
      dailyInsight: insight,
      availableTime: context.openWindowMinutes,
      scheduleLoad: context.scheduleDensity,
      recentBehavior: context.accountability?.behaviorSummary,
      userPreferences: context.accountability?.preferences,
      natalProfile: context.accountability?.natalProfile,
      persona: context.accountability?.persona || null,
      memory: context.accountability?.memory,
    }),
  }
}
