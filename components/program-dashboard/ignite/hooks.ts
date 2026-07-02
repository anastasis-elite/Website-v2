'use client'

import { useEffect, useMemo, useState } from 'react'
import type { IgniteDashboardData, IgnitePlanBlock } from '@/lib/dashboard/ignite/types'

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function useClientDashboardData(data: IgniteDashboardData) {
  return data
}

export function useMacroProgress(macros: IgniteDashboardData['macros']) {
  return useMemo(() => {
    const rows = macros.map((macro) => ({
      ...macro,
      remaining: Math.max(0, Math.round(macro.target - macro.consumed)),
      percent: macro.target ? clamp((macro.consumed / macro.target) * 100) : 0,
    }))
    const scored = rows.filter((row) => row.key !== 'calories')
    return {
      rows,
      percent: scored.length ? Math.round(scored.reduce((sum, row) => sum + row.percent, 0) / scored.length) : 0,
    }
  }, [macros])
}

export function useTodayPlan(clientId: string, initialPlan: IgnitePlanBlock[]) {
  const storageKey = `ignite-plan:${clientId}:${new Date().toISOString().slice(0, 10)}`
  const [manualTasks, setManualTasks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // TODO: Replace this client-scoped adapter when daily_plan_task_completions exists.
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return
    try {
      setManualTasks(JSON.parse(stored))
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  const blocks = initialPlan.map((block) => ({
    ...block,
    tasks: block.tasks.map((task) => ({
      ...task,
      complete: task.autoTracked ? task.complete : Boolean(manualTasks[task.id]),
    })),
  }))
  const tasks = blocks.flatMap((block) => block.tasks)
  const percent = tasks.length ? clamp((tasks.filter((task) => task.complete).length / tasks.length) * 100) : 0

  function toggleTask(taskId: string) {
    const next = { ...manualTasks, [taskId]: !manualTasks[taskId] }
    setManualTasks(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  return { blocks, percent, toggleTask }
}

export function useTodayWorkout(workout: IgniteDashboardData['workout']) {
  return { ...workout, executionComplete: !workout.assigned || workout.completed }
}

export function useAssessmentStatus(assessment: IgniteDashboardData['assessment']) {
  return assessment
}

export function useRecoveryCheck(recovery: IgniteDashboardData['recovery']) {
  const readinessValues = [recovery.energy, recovery.sleep]
    .filter((value): value is number => value !== null)
  const strainValues = [recovery.stress, recovery.soreness]
    .filter((value): value is number => value !== null)
    .map((value) => 11 - value)
  const values = [...readinessValues, ...strainValues]
  return {
    ...recovery,
    readiness: values.length ? clamp((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) : null,
  }
}

export function useCyclePhase(cycle: IgniteDashboardData['cycle']) {
  return cycle
}

export function useWeeklyTrends(trends: IgniteDashboardData['trends']) {
  return trends
}

export function useProgressSnapshot(progress: IgniteDashboardData['progress']) {
  return progress
}

export function useDailyProgress({
  hydration,
  nutrition,
  workout,
  plan,
  assessment,
  recovery,
}: {
  hydration: number
  nutrition: number
  workout: boolean
  plan: number
  assessment: boolean
  recovery: boolean
}) {
  return clamp((hydration + nutrition + (workout ? 100 : 0) + plan + (assessment ? 100 : 0) + (recovery ? 100 : 0)) / 6)
}

export function useFlameState(score: number) {
  if (score < 25) return { key: 'spark', label: 'Spark', icon: '✦', intensity: .28 }
  if (score < 50) return { key: 'small', label: 'Small flame', icon: '🔥', intensity: .45 }
  if (score < 75) return { key: 'steady', label: 'Steady flame', icon: '🔥', intensity: .64 }
  if (score < 100) return { key: 'strong', label: 'Strong flame', icon: '🔥', intensity: .84 }
  return { key: 'roaring', label: 'Roaring flame', icon: '🔥', intensity: 1 }
}

export function useIgniteInsight({
  baseInsight,
  hydration,
  nutrition,
  workoutComplete,
  recoveryComplete,
  cyclePhase,
  weeklyTrend,
}: {
  baseInsight: string | null
  hydration: number
  nutrition: number
  workoutComplete: boolean
  recoveryComplete: boolean
  cyclePhase: string | null
  weeklyTrend: { label: string; comparisonPercent: number } | null
}) {
  if (hydration < 45) return 'Hydration is the clearest opportunity today. Build it steadily before asking for more output.'
  if (nutrition < 45) return 'Your training support needs attention. Log the next meal and protect protein first.'
  if (!workoutComplete) return cyclePhase
    ? `Your ${cyclePhase.replace('_', ' ')} phase is part of today’s context. Execute the assigned session, then recover.`
    : 'Your assigned workout is still open. Complete the session, then let the work count.'
  if (!recoveryComplete) return 'Training is complete. A fast recovery check will close the loop and improve tomorrow’s direction.'
  if (weeklyTrend && weeklyTrend.comparisonPercent > 0) return `${weeklyTrend.label} is trending up ${weeklyTrend.comparisonPercent}% from last week. Keep the pattern simple and repeatable.`
  if (weeklyTrend && weeklyTrend.comparisonPercent < 0) return `${weeklyTrend.label} is down ${Math.abs(weeklyTrend.comparisonPercent)}% from last week. Use today’s remaining actions to stabilize the trend.`
  return baseInsight || 'Your core actions are building momentum. Finish the remaining plan without adding unnecessary complexity.'
}
