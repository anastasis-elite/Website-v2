'use client'

import GuidedToday from './GuidedToday'
import type { ProgramTier, ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'

export default function TierAwareDashboardWorkspace({
  tier,
  logic,
  schedule,
}: {
  tier: ProgramTier
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
  recipes?: PhoenixRecipe[]
}) {
  const quiet = schedule.preferences?.carouselStyle === 'step'
  return (
    <section className="tier-dashboard-workspace daily-home" data-tier={tier} data-quiet={quiet}>
      <GuidedToday key={`${logic.client.id}:${schedule.date}`} logic={logic} schedule={schedule} />
    </section>
  )
}
