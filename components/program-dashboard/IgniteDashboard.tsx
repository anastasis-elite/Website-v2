'use client'

import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import TierAwareDashboardWorkspace from '@/components/program-dashboard/TierAwareDashboardWorkspace'
import TodayDashboardHeader from '@/components/program-dashboard/TodayDashboardHeader'

export default function IgniteDashboard({ logic, schedule }: { logic: ProgramLogicOutput; schedule: DailyScheduleState }) {
  return <div className="today-dashboard" data-tier="ignite">
    <div className="today-shell">
      <TodayDashboardHeader logic={logic} schedule={schedule} />
      <TierAwareDashboardWorkspace tier="ignite" logic={logic} schedule={schedule} />
    </div>
  </div>
}
