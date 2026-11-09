'use client'

import styles from './TodayPlanTheme.module.css'
import type { ProgramLogicOutput, ProgramTier } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import TierAwareDashboardWorkspace from '@/components/program-dashboard/TierAwareDashboardWorkspace'
import TodayDashboardHeader from '@/components/program-dashboard/TodayDashboardHeader'
import TodayInstallButton from '@/components/pwa/TodayInstallButton'

export default function SharedTodayDashboard({ tier, logic, schedule, recipes }: {
  tier: ProgramTier
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
  recipes?: PhoenixRecipe[]
}) {
  return <div className={`today-dashboard ${styles.surface}`} data-tier={tier}>
    <div className="today-shell">
      <TodayDashboardHeader logic={logic} schedule={schedule} />
      <TodayInstallButton />
      <TierAwareDashboardWorkspace tier={tier} logic={logic} schedule={schedule} {...(recipes === undefined ? {} : { recipes })} />
    </div>
  </div>
}
