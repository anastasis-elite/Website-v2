'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import TierAwareDashboardWorkspace from '@/components/program-dashboard/TierAwareDashboardWorkspace'
import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function flameState(score: number) {
  if (score < 25) return { label: 'Spark', icon: '✦', intensity: .28 }
  if (score < 50) return { label: 'Small flame', icon: '🔥', intensity: .45 }
  if (score < 75) return { label: 'Steady flame', icon: '🔥', intensity: .64 }
  if (score < 100) return { label: 'Strong flame', icon: '🔥', intensity: .84 }
  return { label: 'Roaring flame', icon: '🔥', intensity: 1 }
}

export default function EmberDashboard({
  logic,
  schedule,
}: {
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
}) {
  const score = logic.flameState.dailyScore
  const flame = flameState(score)

  return (
    <main className="ember-dashboard" style={{ '--ember-intensity': flame.intensity } as CSSProperties}>
      <div className="ember-dashboard-shell">
        <header className="ember-header">
          <div className="ember-brand">
            <span className="ember-brand-flame" aria-hidden="true">🔥</span>
            <div><strong>EMBER</strong><small>Strong. Focused. Unstoppable.</small></div>
          </div>
          <div className="ember-greeting">
            <h1>{greeting()}, {logic.client.name} <span aria-hidden="true">{flame.icon}</span></h1>
            <p>Let&apos;s execute today.</p>
          </div>
          <div className="ember-streak" data-flame-state={flame.label.toLowerCase().replaceAll(' ', '-')}>
            <span aria-hidden="true">{flame.icon}</span><strong>{logic.flameState.streak}</strong><small>Day streak</small>
          </div>
        </header>

        <TierAwareDashboardWorkspace tier="ember" logic={logic} schedule={schedule} />

        <nav className="ember-bottom-nav" aria-label="Ember dashboard navigation">
          <Link href="/dashboard/program/ember" className="active"><span>⌂</span>Today</Link>
          <Link href="/dashboard/program/ember/workout"><span>↟</span>Workout</Link>
          <Link href="/dashboard/nutrition"><span>Ψ</span>Nutrition</Link>
          <div className="ember-nav-flame" aria-label={`${score}% daily execution`}><span>{flame.icon}</span><small>{score}%</small></div>
          <Link href="/dashboard/recovery"><span>♥</span>Recovery</Link>
          <Link href="/dashboard/assessment"><span>✓</span>Assess</Link>
          <DashboardMoreMenu program="ember" />
        </nav>
      </div>
    </main>
  )
}
