'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import TierAwareDashboardWorkspace from '@/components/program-dashboard/TierAwareDashboardWorkspace'
import type { PhoenixRecipe } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'

function flameState(score: number) {
  if (score < 25) return { label: 'Start small', icon: '✦', intensity: .25 }
  if (score < 50) return { label: 'You are moving', icon: '🔥', intensity: .42 }
  if (score < 75) return { label: 'Momentum is building', icon: '🔥', intensity: .62 }
  if (score < 100) return { label: 'Almost complete', icon: '🔥', intensity: .82 }
  return { label: 'You did enough today', icon: '🔥', intensity: 1 }
}

export default function PhoenixDashboard({
  logic,
  schedule,
  recipes = [],
}: {
  logic: ProgramLogicOutput
  trackLabel: string
  schedule: DailyScheduleState
  recipes?: PhoenixRecipe[]
}) {
  const score = logic.flameState.dailyScore
  const flame = flameState(score)

  return (
    <main className="phoenix-dashboard" style={{ '--phoenix-intensity': flame.intensity } as CSSProperties}>
      <div className="phoenix-shell">
        <header className="phoenix-header">
          <div className="phoenix-brand">
            <span aria-hidden="true">🔥</span>
            <div>
              <strong>PHOENIX</strong>
              <small>Simplify. Support. Rise.</small>
            </div>
          </div>

          <div className="phoenix-greeting">
            <h1>Good Morning, {logic.client.name} <span aria-hidden="true">♥</span></h1>
            <p>We&apos;ve got your day. One step at a time.</p>
          </div>

          <div className="phoenix-streak">
            <span aria-hidden="true">{flame.icon}</span>
            <strong>{logic.flameState.streak}</strong>
            <small>Day streak</small>
          </div>
        </header>

        <TierAwareDashboardWorkspace tier="phoenix" logic={logic} schedule={schedule} recipes={recipes} />

        <nav className="phoenix-bottom-nav" aria-label="Phoenix dashboard navigation">
          <Link href="/dashboard/program/phoenix" className="active"><span>⌂</span>Dashboard</Link>
          <Link href="/dashboard/program/phoenix/workout"><span>↟</span>Workout</Link>
          <div className="phoenix-nav-flame" aria-label={`${score}% daily execution`}><span aria-hidden="true">{flame.icon}</span><small>{score}%</small></div>
          <Link href="/dashboard/recovery"><span>▥</span>Support</Link>
          <DashboardMoreMenu program="phoenix" />
        </nav>
      </div>
    </main>
  )
}
