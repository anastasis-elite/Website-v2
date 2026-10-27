import ConnectedCalendars from '@/components/ConnectedCalendars'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/detail-screens.css'

export default async function ConnectedCalendarsPage() {
  await getDashboardContext()
  return <PhoneAppFrame backHref="/dashboard/schedule/settings" backLabel="Settings" eyebrow="Your daily rhythm" title="Connected Calendars" subtitle="Your commitments, together."><main className="detail-content"><ConnectedCalendars /></main></PhoneAppFrame>
}
