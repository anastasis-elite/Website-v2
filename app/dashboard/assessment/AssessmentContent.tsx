import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getTierCapabilities } from '@/lib/entitlements'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/assessments.css'

export default async function AssessmentContent() {
  const { client } = await getDashboardContext()
  const capabilities = getTierCapabilities(client.program)
  const groups = [
    { title: 'Planning & preferences', items: [
      { title: 'Quarterly Assessment', copy: 'Full assessment · three calendar months after completion', href: '/dashboard/assessment/start?assessmentType=quarterly' },
      { title: 'Monthly Review', copy: 'Confirm saved selections or edit what changed', href: '/dashboard/assessment/start?assessmentType=review' },
      { title: 'Daily Structure Review', copy: 'Daily anchors and training rhythm', href: '/dashboard/assessment/daily-structure' },
    ] },
    { title: 'Physical progress', items: [
      { title: 'Strength Assessment', copy: 'Your current capacity and previous results', href: '/dashboard/assessment/start2' },
      { title: 'Body Measurements', copy: 'Body and regional measurements · shared entry', href: '/dashboard/assessment/measurements' },
      { title: 'Structural Measurements', copy: 'Body lengths and advanced fields · shared entry', href: '/dashboard/assessment/measurements' },
      { title: 'Progress Photos', copy: 'Optional · private photo history', href: '/dashboard/assessment/photos' },
    ] },
  ]
  return <PhoneAppFrame eyebrow="Your account" title="Assessments" subtitle="Your full assessment library.">
    <main className="assessment-content">
      <p className="assessment-notice">Only currently due assessments appear in <Link href="/dashboard/assessment/monthly">Monthly Assessments</Link>. Your full list stays here.</p>
      <div className="assessment-library">
        {groups.map(group => <section key={group.title}><h2>{group.title}</h2>{group.items.map(item => <Link href={item.href} key={item.title}><span>{item.title}<small>{item.copy}</small></span><b aria-hidden="true">›</b></Link>)}</section>)}
        <section><h2>Posture</h2>{capabilities.postureAssessment
          ? <Link href="/dashboard/assessment/photos?type=posture"><span>Posture Assessment<small>Optional · Ignite & Phoenix</small></span><b aria-hidden="true">›</b></Link>
          : <p className="assessment-notice">Posture Assessment is available with Ignite &amp; Phoenix.</p>}</section>
      </div>
      <p className="assessment-notice"><Link href="/dashboard/check-in">Daily Check-In</Link> remains separate. <Link href="/dashboard/account">Back to Account</Link>.</p>
    </main>
  </PhoneAppFrame>
}
