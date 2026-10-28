import CalendarWorkspace from '@/components/CalendarWorkspace'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getClientDayRange } from '@/lib/schedule/time'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const { client } = await getDashboardContext()
  const { date } = await searchParams
  const selectedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : undefined
  const day = getClientDayRange(client, selectedDate)

  return <PhoneAppFrame title="Calendar" subtitle="Manage your events and connected calendars." eyebrow="Your calendar" backHref={`/dashboard/schedule?date=${day.date}`} backLabel="Schedule">
    <main><CalendarWorkspace key={day.date} date={day.date} timezone={day.timezone} /></main>
  </PhoneAppFrame>
}
