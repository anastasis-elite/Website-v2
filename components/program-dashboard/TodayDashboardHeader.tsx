import { getGreeting } from '@/lib/timezone'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'

export default function TodayDashboardHeader({ logic, schedule }: { logic: ProgramLogicOutput; schedule: DailyScheduleState }) {
  const date = new Date(schedule.now)
  const greeting = getGreeting(date, schedule.timezone)
  return <header className="today-header">
    <div className="today-brand"><span>Anastasis</span><small>{logic.program.toUpperCase()}</small></div>
    <time dateTime={schedule.date}>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: schedule.timezone }).format(date)}</time>
    <h1>{greeting}{logic.client.name ? `, ${logic.client.name}` : ''}.</h1>
    <p>Your day, made lighter.</p>
  </header>
}
