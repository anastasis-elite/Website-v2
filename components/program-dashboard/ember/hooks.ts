'use client'

import { useMemo, useState } from 'react'
import type { EmberDashboardData, EmberMacro } from '@/lib/dashboard/ember/types'
import { calculateExecutionScore } from '@/lib/dashboard/logic/calculateExecutionScore'

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function useClientDashboardData(initialData: EmberDashboardData) {
  const [data, setData] = useState(initialData)
  return { data, setData }
}

export function useHydrationProgress(consumed: number, target: number) {
  const safeTarget = Math.max(1, target)
  return {
    percent: clamp((consumed / safeTarget) * 100),
    remaining: Math.max(0, Math.round(safeTarget - consumed)),
    complete: consumed >= safeTarget,
  }
}

export function useMacroProgress(macros: EmberMacro[]) {
  return useMemo(() => {
    const visible = macros.filter((macro) => macro.key !== 'calories')
    const rows = visible.map((macro) => ({
      ...macro,
      remaining: Math.max(0, Math.round(macro.target - macro.consumed)),
      percent: macro.target > 0 ? clamp((macro.consumed / macro.target) * 100) : 0,
    }))
    const percent = rows.length
      ? Math.round(rows.reduce((total, macro) => total + macro.percent, 0) / rows.length)
      : 0
    return { rows, percent, complete: rows.length > 0 && percent >= 90 }
  }, [macros])
}

export function useTodayWorkout(data: EmberDashboardData['workout']) {
  return {
    ...data,
    executionComplete: !data.assigned || data.completed,
  }
}

export function useAssessmentStatus(data: EmberDashboardData['assessment']) {
  return {
    ...data,
    executionComplete: !data.required || data.completed,
  }
}

export function useDailyExecutionScore({
  hydrationPercent,
  macroPercent,
  workoutComplete,
  assessmentComplete,
  recoveryRequired,
  recoveryComplete,
}: {
  hydrationPercent: number
  macroPercent: number
  workoutComplete: boolean
  assessmentComplete: boolean
  recoveryRequired: boolean
  recoveryComplete: boolean
}) {
  return calculateExecutionScore({hydration:hydrationPercent,nutrition:macroPercent,workout:workoutComplete,assessment:assessmentComplete,recovery:recoveryRequired?recoveryComplete:true})
}

export function useFlameState(score: number) {
  if (score < 25) return { key: 'spark', label: 'Ember', icon: '✦', intensity: 0.28 }
  if (score < 50) return { key: 'small', label: 'Small flame', icon: '🔥', intensity: 0.46 }
  if (score < 75) return { key: 'steady', label: 'Steady flame', icon: '🔥', intensity: 0.64 }
  if (score < 100) return { key: 'strong', label: 'Strong flame', icon: '🔥', intensity: 0.82 }
  return { key: 'roaring', label: 'Day complete', icon: '🔥', intensity: 1 }
}
