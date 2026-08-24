'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import TierAwareDashboardWorkspace from '@/components/program-dashboard/TierAwareDashboardWorkspace'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'

function flameState(score: number) {
  if (score < 25) return { label: 'Spark', icon: '✦', intensity: .28 }
  if (score < 50) return { label: 'Small flame', icon: '🔥', intensity: .45 }
  if (score < 75) return { label: 'Steady flame', icon: '🔥', intensity: .64 }
  if (score < 100) return { label: 'Strong flame', icon: '🔥', intensity: .84 }
  return { label: 'Roaring flame', icon: '🔥', intensity: 1 }
}

export default function IgniteDashboard({
  logic,
  schedule,
}: {
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
}) {
  const score = logic.flameState.dailyScore
  const flame = flameState(score)

  return (
    <main className="ignite-dashboard" style={{ '--ignite-intensity': flame.intensity } as CSSProperties}>
      <div className="ignite-shell">
        <header className="ignite-header">
          <div className="ignite-brand">
            <span aria-hidden="true">🔥</span>
            <div>
              <strong>IGNITE</strong>
              <small>Focused. Intentional. Progressing.</small>
            </div>
          </div>

          <div className="ignite-greeting">
            <h1>Good Morning, {logic.client.name} {flame.icon}</h1>
            <p>One choice at a time.</p>
          </div>

          <div className="ignite-streak">
            <span>{flame.icon}</span>
            <strong>{logic.flameState.streak}</strong>
            <small>Day streak</small>
          </div>
        </header>

        <TierAwareDashboardWorkspace tier="ignite" logic={logic} schedule={schedule} />

        <nav className="ignite-bottom-nav" aria-label="Ignite dashboard navigation">
          <Link href="/dashboard/program/ignite" className="active"><span>⌂</span>Today</Link>
          <Link href="/dashboard/program/ignite/workout"><span>↟</span>Workout</Link>
          <Link href="/dashboard/nutrition"><span>Ψ</span>Nutrition</Link>
          <div className="ignite-nav-flame" aria-label={`${score}% daily execution`}><span>{flame.icon}</span><small>{score}%</small></div>
          <Link href="/dashboard/recovery"><span>♥</span>Recovery</Link>
          <Link href="/dashboard/assessment"><span>✓</span>Assess</Link>
          <DashboardMoreMenu program="ignite" />
        </nav>
      </div>
    </main>
  )
}
