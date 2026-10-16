import ScheduleDashboardClient from './ScheduleDashboardClient'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyScheduleState } from '@/lib/schedule/service'

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { supabase, user, client } = await getDashboardContext()
  const { date } = await searchParams
  const schedule = await getDailyScheduleState({ supabase, user, client,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ? date : undefined })

  return (
    <ScheduleDashboardClient
      initialSchedule={schedule}
    />
  )
}
