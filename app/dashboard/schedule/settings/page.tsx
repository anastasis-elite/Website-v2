import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/detail-screens.css'

export default async function ScheduleSettingsPage() {
  const { client } = await getDashboardContext()
  return <PhoneAppFrame backHref={`/dashboard/program/${client.program || 'ember'}?view=plan`} backLabel="Plan" eyebrow="Your daily rhythm" title="Schedule Settings" subtitle="Make your plan fit your life.">
    <main className="detail-content"><nav className="detail-route-list" aria-label="Schedule settings">
      <Link href="/dashboard/schedule/settings/routine"><span className="detail-symbol" aria-hidden="true">▦</span><span><strong>Edit My Routine</strong><small>Update your rhythm, time anchors and training availability.</small></span><b aria-hidden="true">›</b></Link>
      <Link href="/dashboard/settings/calendars"><span className="detail-symbol" aria-hidden="true">↗</span><span><strong>Connected Calendars</strong><small>Manage existing connections and scheduling preferences.</small></span><b aria-hidden="true">›</b></Link>
    </nav><Link className="detail-action" href="/dashboard/schedule">Back to my day</Link></main>
  </PhoneAppFrame>
}
