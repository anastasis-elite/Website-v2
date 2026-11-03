'use client'

import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import SharedTodayDashboard from './SharedTodayDashboard'

export default function PhoenixDashboard({ logic, schedule, recipes = [] }: { logic: ProgramLogicOutput; schedule: DailyScheduleState; trackLabel: string; recipes?: PhoenixRecipe[] }) {
  return <SharedTodayDashboard tier="phoenix" logic={logic} schedule={schedule} recipes={recipes} />
}
