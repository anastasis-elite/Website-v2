'use client'

import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import TierAwareDashboardWorkspace from '@/components/program-dashboard/TierAwareDashboardWorkspace'
import TodayDashboardHeader from '@/components/program-dashboard/TodayDashboardHeader'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'

export default function PhoenixDashboard({ logic, schedule, recipes = [] }: { logic: ProgramLogicOutput; schedule: DailyScheduleState; trackLabel: string; recipes?: PhoenixRecipe[] }) {
  return <div className="today-dashboard" data-tier="phoenix">
    <div className="today-shell">
      <TodayDashboardHeader logic={logic} schedule={schedule} />
      <TierAwareDashboardWorkspace tier="phoenix" logic={logic} schedule={schedule} recipes={recipes} />
    </div>
  </div>
}
