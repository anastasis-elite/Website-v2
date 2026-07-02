'use client'

import { useMemo, useState } from 'react'
import type { PhoenixDashboardData, PhoenixPlanBlock } from '@/lib/dashboard/phoenix/types'

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function usePhoenixDashboardData(initialData: PhoenixDashboardData) {
  const [data, setData] = useState(initialData)
  return { data, setData }
}

export function useHydrationProgress(consumed: number, target: number) {
  return { percent: clamp((consumed / Math.max(1, target)) * 100), remaining: Math.max(0, Math.round(target - consumed)) }
}

export function useMacroProgress(macros: PhoenixDashboardData['macros']) {
  return useMemo(() => {
    const rows = macros.map((macro) => ({ ...macro, remaining: Math.max(0, Math.round(macro.target - macro.consumed)), percent: macro.target ? clamp((macro.consumed / macro.target) * 100) : 0 }))
    return { rows, percent: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / rows.length) : 0 }
  }, [macros])
}

export function useTodayPlanBlocks(clientId: string, initialBlocks: PhoenixPlanBlock[]) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const tasks = blocks.flatMap((block) => block.tasks)
  const percent = tasks.length ? clamp((tasks.filter((task) => task.complete).length / tasks.length) * 100) : 0

  async function persist(taskIds: string[], completed: boolean) {
    const response = await fetch('/api/phoenix/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, taskIds, completed }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'The task could not be saved.')
  }

  async function setTasks(taskIds: string[], completed: boolean) {
    const previous = blocks
    setError('')
    setSaving(true)
    setBlocks((current) => current.map((block) => ({ ...block, tasks: block.tasks.map((task) => taskIds.includes(task.id) ? { ...task, complete: completed } : task) })))
    try {
      await persist(taskIds, completed)
    } catch (saveError) {
      setBlocks(previous)
      setError(saveError instanceof Error ? saveError.message : 'The task could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  function toggleTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId)
    if (task) void setTasks([taskId], !task.complete)
  }

  function completeBlock(blockId: PhoenixPlanBlock['id']) {
    const block = blocks.find((item) => item.id === blockId)
    if (block) void setTasks(block.tasks.map((task) => task.id), true)
  }

  return { blocks, percent, saving, error, toggleTask, completeBlock }
}

export function useAssessmentStatus(value: PhoenixDashboardData['assessment']) { return value }
export function useRecoveryStatus(value: PhoenixDashboardData['recovery']) { return value }
export function useSleepStatus(value: PhoenixDashboardData['sleep']) { return value }

export function usePhoenixDailyProgress({ plan, hydration, nutrition, workout, assessment, recovery, sleep }: { plan: number; hydration: number; nutrition: number; workout: boolean; assessment: boolean; recovery: boolean; sleep: boolean }) {
  return clamp((plan + hydration + nutrition + (workout ? 100 : 0) + (assessment ? 100 : 0) + (recovery ? 100 : 0) + (sleep ? 100 : 0)) / 7)
}

export function useFlameState(score: number) {
  if (score < 25) return { label: 'Start small', icon: '✦', intensity: .25 }
  if (score < 50) return { label: 'You’re moving', icon: '🔥', intensity: .42 }
  if (score < 75) return { label: 'Momentum is building', icon: '🔥', intensity: .62 }
  if (score < 100) return { label: 'Almost complete', icon: '🔥', intensity: .82 }
  return { label: 'You did enough today', icon: '🔥', intensity: 1 }
}
