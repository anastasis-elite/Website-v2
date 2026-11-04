import Link from 'next/link'

// Keep these destinations aligned with the public LegalFooter.
const links = [
  ['What is Anastasis?', '/what-is-anastasis'],
  ['Programs', '/program'],
  ['About Anastasis', '/about'],
  ['Terms', '/terms'],
  ['Privacy', '/privacy'],
  ['Health Disclaimer', '/health-disclaimer'],
  ['Billing / Refunds', '/refund-policy'],
  ['Research Consent', '/research-consent'],
  ['Customer support', '/support'],
]

export default function AccountInformationLinks() {
  return (
    <section className="account-panel account-information" aria-labelledby="account-information-title">
      <h2 id="account-information-title">About, policies &amp; support</h2>
      <nav aria-label="About, policies and support links">
        <ul className="account-information-links">
          {links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}
        </ul>
      </nav>
    </section>
  )
}
