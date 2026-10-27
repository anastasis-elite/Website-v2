import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getAssessmentHub } from '@/lib/assessment/assessmentHub'
import PhoneAppFrame, { PhoneAppCard } from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/assessments.css'

export default async function MonthlyAssessmentsPage() {
  const { supabase, client } = await getDashboardContext()
  const { due, unavailable } = await getAssessmentHub(supabase, client)
  return <PhoneAppFrame eyebrow="Assessments" title="Monthly Assessments" subtitle="Keep your system aligned.">
    <main className="assessment-content">
      <p>A little reflection. A clearer path forward.</p>
      <section className="assessment-section assessment-summary" aria-label="Currently due assessments">
        <strong>{due.length}</strong><p>{due.length === 1 ? 'assessment due' : 'assessments due'}<br /><small>Only what needs your attention now.</small></p>
      </section>
      {unavailable.length ? <p className="assessment-notice" role="status">We couldn’t confirm: {unavailable.join(', ')}. Refresh to check those schedules. Your saved records are unchanged.</p> : null}
      {due.length ? <div className="assessment-due-list">{due.map(item => <PhoneAppCard key={item.id} title={item.title} copy={item.copy} href={item.href} action={item.action} illustration={item.illustration} />)}</div>
        : !unavailable.length ? <section className="assessment-section"><h2>You’re up to date.</h2><p>There are no assessments due right now.</p></section> : null}
      <p className="assessment-notice">All assessments are available in <Link href="/dashboard/account">Account</Link>. <Link href="/dashboard/assessment">Open the full library</Link>.</p>
    </main>
  </PhoneAppFrame>
}
