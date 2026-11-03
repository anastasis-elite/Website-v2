'use client'

import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import SharedTodayDashboard from './SharedTodayDashboard'

export default function EmberDashboard({ logic, schedule }: { logic: ProgramLogicOutput; schedule: DailyScheduleState }) {
  return <SharedTodayDashboard tier="ember" logic={logic} schedule={schedule} />
}
