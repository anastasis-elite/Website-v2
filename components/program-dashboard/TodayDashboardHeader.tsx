import { getGreeting } from '@/lib/timezone'
import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { DailyScheduleState } from '@/lib/schedule/types'
import TodayStreakBadge from '@/components/program-dashboard/TodayStreakBadge'

export default function TodayDashboardHeader({ logic, schedule, plan = false }: { logic: ProgramLogicOutput; schedule: DailyScheduleState; plan?: boolean }) {
  const date = new Date(schedule.now)
  const greeting = getGreeting(date, schedule.timezone)
  const currentDay = new Date(`${schedule.date}T12:00:00Z`)
  const monday = new Date(currentDay)
  monday.setUTCDate(currentDay.getUTCDate() - (currentDay.getUTCDay() + 6) % 7)
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setUTCDate(monday.getUTCDate() + index)
    return day
  })
  const formatDay = (day: Date) => day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
  return <header className="today-header">
    <svg className="today-satin" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="today-satin-fold" x1="0" y1="0" x2=".2" y2="1"><stop stopColor="#24150d"/><stop offset=".44" stopColor="#815331"/><stop offset=".5" stopColor="#b28356"/><stop offset=".56" stopColor="#5a371f"/><stop offset="1" stopColor="#1d110a"/></linearGradient><filter id="today-satin-soft"><feGaussianBlur stdDeviation="7"/></filter></defs>
      <g filter="url(#today-satin-soft)"><path d="M-200-160C100 120 400 50 630 160S1000 250 1220-150L1250 300C1020 400 730 250 500 190S50 190-200-20Z" fill="url(#today-satin-fold)" opacity=".55"/><path d="M-200 10Q331 93 587 205T1200-173L1200 265Q864 260 654 230T-200 80Z" fill="url(#today-satin-fold)" opacity=".45"/></g>
    </svg>
    <div className="today-brand"><span>Anastasis</span><small>Elite</small></div>
    {!plan && <TodayStreakBadge count={logic.flameState?.streak} available={logic.streakAvailable === true} />}
    <p className="today-page-label">{plan ? 'Plan' : 'Today'}</p>
    <h1>{plan ? 'A week that fits you.' : 'Welcome back.'}</h1>
    <p className="today-subtitle">{plan ? 'Structure, with room for life.' : 'A little space for you.'}</p>
    <p className="today-personal-greeting">{greeting}{logic.client.name ? `, ${logic.client.name}` : ''}.</p>
    {plan ? <p className="today-week-range">{formatDay(week[0])} – {formatDay(week[6])}</p> : <time dateTime={schedule.date}>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: schedule.timezone }).format(date)}</time>}
    <ol className="today-week-strip" aria-label="This week">{week.map(day => <li key={day.toISOString()} aria-current={day.toISOString().slice(0, 10) === schedule.date ? 'date' : undefined}><span>{day.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })}</span><strong>{day.getUTCDate()}</strong></li>)}</ol>
  </header>
}
