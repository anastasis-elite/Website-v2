import Link from 'next/link'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/config'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/detail-screens.css'

export default function SupportPage() {
  return <PhoneAppFrame backHref="/dashboard/account" backLabel="Account" eyebrow="Customer Support" title="Help with your account or billing." subtitle="Tell us what happened so we can help."><main className="detail-content">
    <section className="detail-panel"><h2>Contact support</h2><ul className="detail-support-list"><li>Account email and program</li><li>Page and error message</li><li>What you tried and what still needs fixing</li><li>A screenshot, if helpful</li></ul><p className="detail-note">Never include passwords, payment card details or private health information.</p><a className="detail-action" href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=Account%20Support`}>Email support</a><p className="detail-support-email">{LEGAL_CONTACT_EMAIL}</p></section>
    <section className="detail-panel"><h2>Billing help or cancellation</h2><p>Include your account email and purchase date or receipt reference. Manage an eligible paid subscription in Account; email support if billing management is unavailable.</p><nav className="detail-support-billing" aria-label="Billing support"><Link href="/dashboard/account#billing">Account billing <span aria-hidden="true">›</span></Link><Link href="/refund-policy">Billing and refund policy <span aria-hidden="true">›</span></Link></nav><p className="detail-note">Gifted access does not have a paid subscription to cancel.</p></section>
  </main></PhoneAppFrame>
}
