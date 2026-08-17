import ScheduleDashboardClient from './ScheduleDashboardClient'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyScheduleState } from '@/lib/schedule/service'

export default async function SchedulePage() {
  const { supabase, user, client } = await getDashboardContext()
  const schedule = await getDailyScheduleState({ supabase, user, client })

  return (
    <ScheduleDashboardClient
      initialSchedule={schedule}
      clientId={client.client_id}
    />
  )
}
