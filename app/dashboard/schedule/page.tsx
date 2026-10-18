import ScheduleDashboardClient from './ScheduleDashboardClient'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyScheduleState } from '@/lib/schedule/service'

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const { supabase, user, client } = await getDashboardContext()
  const { date } = await searchParams
  const selectedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : undefined
  const schedule = await getDailyScheduleState({ supabase, user, client, date: selectedDate })

  return (
    <ScheduleDashboardClient
      initialSchedule={schedule}
    />
  )
}
