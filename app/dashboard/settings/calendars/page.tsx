import Link from 'next/link'
import ConnectedCalendars from '@/components/ConnectedCalendars'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function ConnectedCalendarsPage() {
  await getDashboardContext()
  return <main className="schedule-page"><div className="schedule-shell"><header><Link href="/dashboard/account">Account settings</Link><h1>Your calendar connections</h1></header><ConnectedCalendars /></div></main>
}
